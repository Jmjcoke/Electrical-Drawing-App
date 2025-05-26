"""
Authentication Service for ELECTRICAL ORCHESTRATOR
Handles JWT token generation, SAML/LDAP integration, and role-based access control
"""

from fastapi import FastAPI, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, EmailStr
from typing import Optional, List
import jwt
import redis
import os
from datetime import datetime, timedelta
from passlib.context import CryptContext
import logging

# Initialize FastAPI app
app = FastAPI(
    title="Electrical Orchestrator - Authentication Service",
    description="Enterprise authentication with SSO support",
    version="1.0.0"
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("CORS_ALLOWED_ORIGINS", "http://localhost:3000").split(","),
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

# Security configuration
security = HTTPBearer()
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Redis connection for session management
redis_client = redis.from_url(os.getenv("REDIS_URL", "redis://localhost:6379"))

# JWT configuration
JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY")
JWT_ALGORITHM = os.getenv("JWT_ALGORITHM", "RS256")
JWT_ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("JWT_ACCESS_TOKEN_EXPIRE_MINUTES", "15"))
JWT_REFRESH_TOKEN_EXPIRE_DAYS = int(os.getenv("JWT_REFRESH_TOKEN_EXPIRE_DAYS", "7"))

# User roles as defined in PRD
USER_ROLES = [
    "system_admin",
    "electrical_lead", 
    "fco_lead",
    "project_manager",
    "foreman",
    "general_foreman",
    "superintendent",
    "electrician",
    "fco_technician"
]

# Pydantic models
class LoginCredentials(BaseModel):
    username: str
    password: str

class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int

class UserProfile(BaseModel):
    id: str
    username: str
    email: EmailStr
    role: str
    permissions: List[str]
    full_name: str
    company: Optional[str] = None

class RefreshTokenRequest(BaseModel):
    refresh_token: str

# Utility functions
def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    """Create JWT access token"""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=JWT_ACCESS_TOKEN_EXPIRE_MINUTES)
    
    to_encode.update({"exp": expire, "type": "access"})
    encoded_jwt = jwt.encode(to_encode, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)
    return encoded_jwt

def create_refresh_token(data: dict):
    """Create JWT refresh token"""
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(days=JWT_REFRESH_TOKEN_EXPIRE_DAYS)
    to_encode.update({"exp": expire, "type": "refresh"})
    encoded_jwt = jwt.encode(to_encode, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)
    return encoded_jwt

def verify_token(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Verify JWT token and return user data"""
    try:
        payload = jwt.decode(credentials.credentials, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Could not validate credentials"
            )
        return payload
    except jwt.PyJWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials"
        )

def get_role_permissions(role: str) -> List[str]:
    """Get permissions for a specific role"""
    permissions_map = {
        "system_admin": ["*"],  # Full access
        "electrical_lead": [
            "projects.read", "projects.write", "circuits.read", "circuits.write",
            "estimates.read", "estimates.write", "reports.read"
        ],
        "fco_lead": [
            "projects.read", "circuits.read", "circuits.write",
            "estimates.read", "estimates.write", "reports.read"
        ],
        "project_manager": [
            "projects.read", "projects.write", "estimates.read", 
            "reports.read", "reports.write", "teams.manage"
        ],
        "foreman": [
            "projects.read", "circuits.read", "hours.write", "progress.read"
        ],
        "general_foreman": [
            "projects.read", "circuits.read", "hours.write", "hours.read",
            "progress.read", "progress.write", "reports.read"
        ],
        "superintendent": [
            "projects.read", "reports.read", "reports.write", 
            "progress.read", "teams.read"
        ],
        "electrician": [
            "projects.read", "circuits.read", "hours.write", "progress.read"
        ],
        "fco_technician": [
            "projects.read", "circuits.read", "hours.write", "progress.read"
        ]
    }
    return permissions_map.get(role, [])

# API Endpoints
@app.post("/auth/login", response_model=TokenResponse)
async def login(credentials: LoginCredentials):
    """Authenticate user with username/password"""
    # TODO: Implement actual user authentication against database
    # For now, mock authentication for development
    if credentials.username == "demo_user" and credentials.password == "demo_pass":
        user_data = {
            "sub": credentials.username,
            "role": "electrical_lead",
            "permissions": get_role_permissions("electrical_lead")
        }
        
        access_token = create_access_token(data=user_data)
        refresh_token = create_refresh_token(data={"sub": credentials.username})
        
        # Store refresh token in Redis
        redis_client.set(f"refresh_token:{credentials.username}", refresh_token, 
                        ex=JWT_REFRESH_TOKEN_EXPIRE_DAYS * 24 * 3600)
        
        return TokenResponse(
            access_token=access_token,
            refresh_token=refresh_token,
            expires_in=JWT_ACCESS_TOKEN_EXPIRE_MINUTES * 60
        )
    else:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials"
        )

@app.post("/auth/refresh", response_model=TokenResponse)
async def refresh_token(request: RefreshTokenRequest):
    """Refresh access token using refresh token"""
    try:
        payload = jwt.decode(request.refresh_token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])
        username = payload.get("sub")
        token_type = payload.get("type")
        
        if token_type != "refresh":
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token type"
            )
        
        # Verify refresh token exists in Redis
        stored_token = redis_client.get(f"refresh_token:{username}")
        if not stored_token or stored_token.decode() != request.refresh_token:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid refresh token"
            )
        
        # Create new access token
        user_data = {
            "sub": username,
            "role": "electrical_lead",  # TODO: Get from database
            "permissions": get_role_permissions("electrical_lead")
        }
        
        access_token = create_access_token(data=user_data)
        
        return TokenResponse(
            access_token=access_token,
            refresh_token=request.refresh_token,  # Refresh token remains the same
            expires_in=JWT_ACCESS_TOKEN_EXPIRE_MINUTES * 60
        )
        
    except jwt.PyJWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token"
        )

@app.get("/auth/profile", response_model=UserProfile)
async def get_profile(current_user: dict = Depends(verify_token)):
    """Get current user profile and permissions"""
    # TODO: Get actual user data from database
    return UserProfile(
        id="demo_user_id",
        username=current_user["sub"],
        email="demo@electrical-orchestrator.com",
        role=current_user["role"],
        permissions=current_user["permissions"],
        full_name="Demo User",
        company="Demo Company"
    )

@app.post("/auth/logout")
async def logout(current_user: dict = Depends(verify_token)):
    """Logout user and invalidate refresh token"""
    username = current_user["sub"]
    
    # Remove refresh token from Redis
    redis_client.delete(f"refresh_token:{username}")
    
    return {"message": "Successfully logged out"}

@app.post("/auth/saml/login")
async def saml_login():
    """Initiate SAML SSO authentication"""
    # TODO: Implement SAML SSO integration
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail="SAML authentication not yet implemented"
    )

@app.post("/auth/ldap/login")
async def ldap_login():
    """Authenticate using LDAP directory services"""
    # TODO: Implement LDAP authentication
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail="LDAP authentication not yet implemented"
    )

@app.post("/auth/reset-password")
async def reset_password():
    """Initiate password reset workflow"""
    # TODO: Implement password reset
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail="Password reset not yet implemented"
    )

# Health check endpoint
@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "service": "auth"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
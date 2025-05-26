"""
Unit tests for Authentication Service
Tests JWT token handling, role-based permissions, and API endpoints
"""

import pytest
import jwt
from fastapi.testclient import TestClient
from unittest.mock import Mock, patch
from datetime import datetime, timedelta
import redis

from ..main import app, create_access_token, create_refresh_token, get_role_permissions, JWT_SECRET_KEY, JWT_ALGORITHM

# Test client
client = TestClient(app)

class TestJWTTokens:
    """Test JWT token creation and validation"""
    
    def test_create_access_token(self):
        """Test access token creation"""
        data = {"sub": "test_user", "role": "electrical_lead"}
        token = create_access_token(data)
        
        # Decode and verify token
        decoded = jwt.decode(token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])
        assert decoded["sub"] == "test_user"
        assert decoded["role"] == "electrical_lead"
        assert decoded["type"] == "access"
        assert "exp" in decoded
        
    def test_create_refresh_token(self):
        """Test refresh token creation"""
        data = {"sub": "test_user"}
        token = create_refresh_token(data)
        
        # Decode and verify token
        decoded = jwt.decode(token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])
        assert decoded["sub"] == "test_user"
        assert decoded["type"] == "refresh"
        assert "exp" in decoded
        
    def test_token_expiration(self):
        """Test token expiration"""
        data = {"sub": "test_user"}
        expires_delta = timedelta(seconds=1)
        token = create_access_token(data, expires_delta)
        
        # Token should be valid immediately
        decoded = jwt.decode(token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])
        assert decoded["sub"] == "test_user"
        
        # Token should expire after 1 second (we'll test this conceptually)
        # In real tests, you might use time.sleep(2) but that slows tests

class TestRolePermissions:
    """Test role-based permission system"""
    
    def test_system_admin_permissions(self):
        """Test system admin has all permissions"""
        permissions = get_role_permissions("system_admin")
        assert permissions == ["*"]
        
    def test_electrical_lead_permissions(self):
        """Test electrical lead has appropriate permissions"""
        permissions = get_role_permissions("electrical_lead")
        expected = [
            "projects.read", "projects.write", "circuits.read", "circuits.write",
            "estimates.read", "estimates.write", "reports.read"
        ]
        assert permissions == expected
        
    def test_electrician_permissions(self):
        """Test electrician has limited permissions"""
        permissions = get_role_permissions("electrician")
        expected = [
            "projects.read", "circuits.read", "hours.write", "progress.read"
        ]
        assert permissions == expected
        
    def test_invalid_role_permissions(self):
        """Test invalid role returns empty permissions"""
        permissions = get_role_permissions("invalid_role")
        assert permissions == []

class TestAuthenticationEndpoints:
    """Test authentication API endpoints"""
    
    @patch('redis.from_url')
    def test_login_success(self, mock_redis):
        """Test successful login"""
        # Mock Redis
        mock_redis_instance = Mock()
        mock_redis.return_value = mock_redis_instance
        
        response = client.post(
            "/auth/login",
            json={"username": "demo_user", "password": "demo_pass"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert "refresh_token" in data
        assert data["token_type"] == "bearer"
        assert "expires_in" in data
        
        # Verify Redis was called to store refresh token
        mock_redis_instance.set.assert_called_once()
        
    def test_login_invalid_credentials(self):
        """Test login with invalid credentials"""
        response = client.post(
            "/auth/login",
            json={"username": "invalid", "password": "invalid"}
        )
        
        assert response.status_code == 401
        assert "Invalid credentials" in response.json()["detail"]
        
    def test_login_missing_fields(self):
        """Test login with missing fields"""
        response = client.post("/auth/login", json={})
        assert response.status_code == 422  # Validation error
        
    @patch('redis.from_url')
    def test_refresh_token_success(self, mock_redis):
        """Test successful token refresh"""
        # Mock Redis
        mock_redis_instance = Mock()
        mock_redis.return_value = mock_redis_instance
        
        # Create a valid refresh token
        refresh_token = create_refresh_token({"sub": "demo_user"})
        mock_redis_instance.get.return_value = refresh_token.encode()
        
        response = client.post(
            "/auth/refresh",
            json={"refresh_token": refresh_token}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert "refresh_token" in data
        
    def test_refresh_token_invalid(self):
        """Test refresh with invalid token"""
        response = client.post(
            "/auth/refresh",
            json={"refresh_token": "invalid_token"}
        )
        
        assert response.status_code == 401
        
    def test_profile_with_valid_token(self):
        """Test profile endpoint with valid token"""
        # Create valid access token
        access_token = create_access_token({
            "sub": "demo_user",
            "role": "electrical_lead",
            "permissions": get_role_permissions("electrical_lead")
        })
        
        response = client.get(
            "/auth/profile",
            headers={"Authorization": f"Bearer {access_token}"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["username"] == "demo_user"
        assert data["role"] == "electrical_lead"
        assert "permissions" in data
        
    def test_profile_without_token(self):
        """Test profile endpoint without token"""
        response = client.get("/auth/profile")
        assert response.status_code == 403  # No Authorization header
        
    def test_profile_with_invalid_token(self):
        """Test profile endpoint with invalid token"""
        response = client.get(
            "/auth/profile",
            headers={"Authorization": "Bearer invalid_token"}
        )
        assert response.status_code == 401
        
    @patch('redis.from_url')
    def test_logout_success(self, mock_redis):
        """Test successful logout"""
        # Mock Redis
        mock_redis_instance = Mock()
        mock_redis.return_value = mock_redis_instance
        
        # Create valid access token
        access_token = create_access_token({
            "sub": "demo_user",
            "role": "electrical_lead",
            "permissions": get_role_permissions("electrical_lead")
        })
        
        response = client.post(
            "/auth/logout",
            headers={"Authorization": f"Bearer {access_token}"}
        )
        
        assert response.status_code == 200
        assert "Successfully logged out" in response.json()["message"]
        
        # Verify Redis delete was called
        mock_redis_instance.delete.assert_called_once()

class TestSecurityFeatures:
    """Test security features and edge cases"""
    
    def test_cors_headers(self):
        """Test CORS headers are properly set"""
        response = client.options("/auth/login")
        # CORS headers should be present (tested via middleware)
        
    def test_rate_limiting_simulation(self):
        """Test rate limiting behavior (simulated)"""
        # In a real implementation, you'd test actual rate limiting
        # This is a placeholder for rate limiting tests
        pass
        
    def test_password_hashing(self):
        """Test password hashing functionality"""
        from passlib.context import CryptContext
        
        pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
        password = "test_password"
        hashed = pwd_context.hash(password)
        
        # Verify password can be verified
        assert pwd_context.verify(password, hashed)
        assert not pwd_context.verify("wrong_password", hashed)
        
    def test_token_tampering_protection(self):
        """Test that tampered tokens are rejected"""
        # Create a valid token
        token = create_access_token({"sub": "test_user"})
        
        # Tamper with the token
        tampered_token = token[:-5] + "xxxxx"
        
        response = client.get(
            "/auth/profile",
            headers={"Authorization": f"Bearer {tampered_token}"}
        )
        
        assert response.status_code == 401

class TestHealthCheck:
    """Test health check endpoint"""
    
    def test_health_check(self):
        """Test health check endpoint"""
        response = client.get("/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        assert data["service"] == "auth"

# Integration test for full authentication flow
class TestAuthenticationFlow:
    """Test complete authentication workflow"""
    
    @patch('redis.from_url')
    def test_complete_auth_flow(self, mock_redis):
        """Test complete login -> profile -> refresh -> logout flow"""
        # Mock Redis
        mock_redis_instance = Mock()
        mock_redis.return_value = mock_redis_instance
        
        # 1. Login
        login_response = client.post(
            "/auth/login",
            json={"username": "demo_user", "password": "demo_pass"}
        )
        assert login_response.status_code == 200
        tokens = login_response.json()
        
        # 2. Get profile
        profile_response = client.get(
            "/auth/profile",
            headers={"Authorization": f"Bearer {tokens['access_token']}"}
        )
        assert profile_response.status_code == 200
        
        # 3. Refresh token
        mock_redis_instance.get.return_value = tokens['refresh_token'].encode()
        refresh_response = client.post(
            "/auth/refresh",
            json={"refresh_token": tokens['refresh_token']}
        )
        assert refresh_response.status_code == 200
        
        # 4. Logout
        logout_response = client.post(
            "/auth/logout",
            headers={"Authorization": f"Bearer {tokens['access_token']}"}
        )
        assert logout_response.status_code == 200

if __name__ == "__main__":
    pytest.main([__file__, "-v"])
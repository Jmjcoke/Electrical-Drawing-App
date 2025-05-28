"""
Simple PDF Processing Service for ELECTRICAL ORCHESTRATOR
Minimal version for basic PDF upload handling
"""

import os
import uuid
import tempfile
from pathlib import Path
from typing import Optional
from datetime import datetime
import logging

from fastapi import FastAPI, HTTPException, File, UploadFile, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import PyPDF2

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="PDF Processing Service",
    description="Simplified PDF upload and processing service",
    version="1.0.0"
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Response models
class DrawingUploadResponse(BaseModel):
    drawing_id: str
    filename: str
    page_count: int
    file_size: int
    status: str
    message: str

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "service": "pdf-processing",
        "version": "1.0.0",
        "timestamp": datetime.utcnow().isoformat()
    }

@app.post("/upload", response_model=DrawingUploadResponse)
async def upload_pdf(
    file: UploadFile = File(...),
    project_id: str = Form(...)
):
    """
    Upload and process PDF drawing
    Simplified version that just validates the PDF and returns basic info
    """
    try:
        # Validate file type
        if not file.filename.lower().endswith('.pdf'):
            raise HTTPException(
                status_code=400,
                detail="Only PDF files are allowed"
            )
        
        # Generate unique ID for this drawing
        drawing_id = str(uuid.uuid4())
        
        # Read file content
        content = await file.read()
        file_size = len(content)
        
        # Validate PDF and get page count
        try:
            with tempfile.NamedTemporaryFile(suffix='.pdf', delete=False) as temp_file:
                temp_file.write(content)
                temp_file.flush()
                
                # Use PyPDF2 to get page count
                with open(temp_file.name, 'rb') as pdf_file:
                    pdf_reader = PyPDF2.PdfReader(pdf_file)
                    page_count = len(pdf_reader.pages)
                
                # Clean up temp file
                os.unlink(temp_file.name)
                
        except Exception as e:
            logger.error(f"Error processing PDF: {e}")
            raise HTTPException(
                status_code=400,
                detail="Invalid PDF file or corrupted"
            )
        
        logger.info(f"Successfully processed PDF: {file.filename}, {page_count} pages, {file_size} bytes")
        
        return DrawingUploadResponse(
            drawing_id=drawing_id,
            filename=file.filename,
            page_count=page_count,
            file_size=file_size,
            status="processed",
            message="PDF uploaded and processed successfully"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Unexpected error during PDF upload: {e}")
        raise HTTPException(
            status_code=500,
            detail="Internal server error during PDF processing"
        )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8003)
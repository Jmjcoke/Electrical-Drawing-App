"""
Cloud Detection Integration for PDF Processing Service
Integrates cloud detection capabilities with the PDF processing pipeline
"""

import os
import logging
import aiohttp
from typing import Dict, Any
from datetime import datetime

logger = logging.getLogger(__name__)

async def perform_cloud_detection(file_content: bytes, drawing_id: str, cad_system_info: Dict[str, Any]) -> Dict[str, Any]:
    """
    Perform cloud detection on PDF content and return results.
    
    Args:
        file_content: PDF file content as bytes
        drawing_id: Drawing identifier
        cad_system_info: CAD system information from PDF analysis
        
    Returns:
        Cloud detection results with metadata
    """
    try:
        # Get CAD system from analysis results
        cad_system = cad_system_info.get('detected_system', 'generic')
        confidence = cad_system_info.get('confidence', 0.5)
        
        # Call AI Vision service for cloud detection
        ai_vision_url = os.getenv('AI_VISION_SERVICE_URL', 'http://localhost:8004')
        
        async with aiohttp.ClientSession() as session:
            # Prepare request data
            form_data = aiohttp.FormData()
            form_data.add_field('drawing_id', drawing_id)
            form_data.add_field('sensitivity', str(min(0.8, confidence + 0.3)))
            form_data.add_field('cad_system', cad_system)
            
            # Make request to AI vision service
            async with session.post(
                f"{ai_vision_url}/detect-clouds",
                data=form_data,
                timeout=aiohttp.ClientTimeout(total=300)  # 5 minute timeout for cloud detection
            ) as response:
                
                if response.status == 200:
                    cloud_results = await response.json()
                    
                    # Process and enhance results
                    enhanced_results = {
                        'detection_status': 'completed',
                        'clouds_detected': len(cloud_results.get('clouds', [])),
                        'detection_confidence': cloud_results.get('overall_confidence', 0.0),
                        'cad_system_used': cad_system,
                        'sensitivity_used': min(0.8, confidence + 0.3),
                        'detection_metadata': {
                            'processing_time': cloud_results.get('processing_time', 0),
                            'detection_method': 'hybrid',
                            'model_version': '2.2.0',
                            'detected_at': datetime.utcnow().isoformat(),
                            'service_version': 'pdf-processing-v1.0.0'
                        },
                        'clouds': cloud_results.get('clouds', []),
                        'pattern_statistics': cloud_results.get('pattern_statistics', {}),
                        'overlay_available': len(cloud_results.get('clouds', [])) > 0
                    }
                    
                    logger.info(f"Cloud detection completed for drawing {drawing_id}: {enhanced_results['clouds_detected']} clouds found")
                    return enhanced_results
                    
                else:
                    error_msg = f"AI Vision service error: {response.status}"
                    logger.warning(error_msg)
                    return {
                        'detection_status': 'failed',
                        'error': error_msg,
                        'clouds_detected': 0,
                        'clouds': [],
                        'overlay_available': False,
                        'detected_at': datetime.utcnow().isoformat()
                    }
                    
    except aiohttp.ClientError as e:
        error_msg = f"AI Vision service connection error: {str(e)}"
        logger.error(error_msg)
        return {
            'detection_status': 'service_unavailable',
            'error': error_msg,
            'clouds_detected': 0,
            'clouds': [],
            'overlay_available': False,
            'detected_at': datetime.utcnow().isoformat()
        }
    except Exception as e:
        error_msg = f"Cloud detection error: {str(e)}"
        logger.error(error_msg)
        return {
            'detection_status': 'failed',
            'error': error_msg,
            'clouds_detected': 0,
            'clouds': [],
            'overlay_available': False,
            'detected_at': datetime.utcnow().isoformat()
        }

async def generate_cloud_overlay_thumbnails(drawing_id: str, cloud_detection_results: Dict[str, Any]) -> Dict[str, Any]:
    """
    Generate thumbnail overlays with cloud detection results.
    
    Args:
        drawing_id: Drawing identifier
        cloud_detection_results: Results from cloud detection
        
    Returns:
        Overlay thumbnail generation results
    """
    try:
        if cloud_detection_results.get('detection_status') != 'completed':
            logger.warning(f"Skipping overlay generation for drawing {drawing_id}: detection not completed")
            return {
                'overlay_generated': False,
                'reason': 'cloud_detection_not_completed'
            }
        
        clouds = cloud_detection_results.get('clouds', [])
        if not clouds:
            logger.info(f"No clouds detected for drawing {drawing_id}, skipping overlay generation")
            return {
                'overlay_generated': False,
                'reason': 'no_clouds_detected'
            }
        
        # Call AI Vision service for enhanced overlay generation
        ai_vision_url = os.getenv('AI_VISION_SERVICE_URL', 'http://localhost:8004')
        
        async with aiohttp.ClientSession() as session:
            form_data = aiohttp.FormData()
            form_data.add_field('drawing_id', drawing_id)
            form_data.add_field('visualization_mode', 'standard')
            form_data.add_field('show_confidence', 'true')
            form_data.add_field('show_pattern_type', 'true')
            form_data.add_field('show_statistics', 'false')  # Keep thumbnails clean
            form_data.add_field('transparency', '0.4')
            
            async with session.post(
                f"{ai_vision_url}/generate-enhanced-overlay",
                data=form_data,
                timeout=aiohttp.ClientTimeout(total=60)
            ) as response:
                
                if response.status == 200:
                    overlay_results = await response.json()
                    
                    return {
                        'overlay_generated': True,
                        'overlay_image': overlay_results.get('overlay_image'),
                        'visualization_mode': overlay_results.get('visualization_mode'),
                        'clouds_shown': overlay_results.get('clouds_detected', 0),
                        'generation_time': overlay_results.get('generation_time'),
                        'quality_metrics': overlay_results.get('quality_metrics', {})
                    }
                else:
                    error_msg = f"Overlay generation service error: {response.status}"
                    logger.warning(error_msg)
                    return {
                        'overlay_generated': False,
                        'error': error_msg
                    }
                    
    except Exception as e:
        error_msg = f"Overlay generation error: {str(e)}"
        logger.error(error_msg)
        return {
            'overlay_generated': False,
            'error': error_msg
        }

def should_perform_cloud_detection(cad_system_info: Dict[str, Any], file_size: int) -> bool:
    """
    Determine if cloud detection should be performed based on drawing characteristics.
    
    Args:
        cad_system_info: CAD system analysis results
        file_size: File size in bytes
        
    Returns:
        True if cloud detection should be performed
    """
    # Skip detection for very large files (over 50MB)
    if file_size > 50 * 1024 * 1024:
        logger.info(f"Skipping cloud detection for large file: {file_size / (1024*1024):.1f}MB")
        return False
    
    # Skip detection if CAD system analysis failed
    if not cad_system_info or cad_system_info.get('confidence', 0) < 0.1:
        logger.info("Skipping cloud detection: CAD system analysis inconclusive")
        return False
    
    # Skip detection for non-electrical drawings
    electrical_classification = cad_system_info.get('electrical_classification', {})
    if electrical_classification.get('confidence', 0) < 0.3:
        logger.info("Skipping cloud detection: low electrical classification confidence")
        return False
    
    return True

def enhance_detection_results_with_metadata(
    cloud_results: Dict[str, Any], 
    analysis_results: Dict[str, Any],
    processing_time: float
) -> Dict[str, Any]:
    """
    Enhance cloud detection results with additional metadata from PDF analysis.
    
    Args:
        cloud_results: Raw cloud detection results
        analysis_results: PDF analysis results
        processing_time: Total processing time
        
    Returns:
        Enhanced results with additional metadata
    """
    enhanced = cloud_results.copy()
    
    # Add context from PDF analysis
    enhanced['pdf_context'] = {
        'page_count': analysis_results.get('content_analysis', {}).get('page_count', 1),
        'document_quality': analysis_results.get('quality_score', 0.0),
        'cad_system': analysis_results.get('cad_system', {}),
        'electrical_type': analysis_results.get('electrical_classification', {}).get('drawing_type', 'unknown'),
        'processing_context': {
            'total_processing_time': processing_time,
            'detection_percentage': cloud_results.get('detection_metadata', {}).get('processing_time', 0) / processing_time if processing_time > 0 else 0
        }
    }
    
    # Add quality assessment
    clouds_count = enhanced.get('clouds_detected', 0)
    detection_confidence = enhanced.get('detection_confidence', 0.0)
    
    enhanced['quality_assessment'] = {
        'detection_density': clouds_count / max(1, analysis_results.get('content_analysis', {}).get('page_count', 1)),
        'confidence_level': 'high' if detection_confidence > 0.7 else 'medium' if detection_confidence > 0.4 else 'low',
        'reliability_score': min(1.0, detection_confidence * (1.0 + analysis_results.get('quality_score', 0.0))),
        'recommended_review': clouds_count > 20 or detection_confidence < 0.5
    }
    
    return enhanced
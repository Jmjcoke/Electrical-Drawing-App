"""
Thumbnail Generation and Page Management for ELECTRICAL ORCHESTRATOR
Handles PDF page extraction, thumbnail generation, and page metadata management
"""

import io
import logging
from typing import List, Dict, Any, Optional, Tuple
from datetime import datetime
import fitz  # PyMuPDF
from PIL import Image, ImageDraw, ImageFont
import boto3
from botocore.exceptions import ClientError
import json
import hashlib

logger = logging.getLogger(__name__)

class ThumbnailGenerator:
    """Advanced thumbnail generation and page management for PDF drawings"""
    
    def __init__(self, s3_bucket: str, s3_region: str = 'us-east-1'):
        self.s3_bucket = s3_bucket
        self.s3_region = s3_region
        self.s3_client = boto3.client('s3', region_name=s3_region)
        
        # Thumbnail configurations
        self.thumbnail_sizes = {
            'small': (150, 200),    # For quick preview lists
            'medium': (300, 400),   # For preview panels
            'large': (600, 800),    # For detailed preview
        }
        
        # Image quality settings
        self.jpeg_quality = 85
        self.png_quality = 9  # For compression level
        
    def generate_page_thumbnails(self, file_content: bytes, drawing_id: str, filename: str) -> Dict[str, Any]:
        """
        Generate thumbnails for all pages in the PDF and upload to S3
        """
        try:
            result = {
                'drawing_id': drawing_id,
                'filename': filename,
                'generated_at': datetime.utcnow().isoformat(),
                'pages': [],
                'thumbnail_urls': {},
                'total_pages': 0,
                'success': False,
                'errors': []
            }
            
            # Open PDF document
            pdf_doc = fitz.open(stream=file_content, filetype="pdf")
            
            try:
                result['total_pages'] = pdf_doc.page_count
                
                # Process each page
                for page_num in range(pdf_doc.page_count):
                    page_info = self._process_page(
                        pdf_doc, page_num, drawing_id, filename
                    )
                    
                    if page_info['success']:
                        result['pages'].append(page_info)
                    else:
                        result['errors'].append(f"Page {page_num + 1}: {page_info.get('error', 'Unknown error')}")
                
                # Generate overview/composite thumbnails if multiple pages
                if pdf_doc.page_count > 1:
                    overview_info = self._generate_overview_thumbnail(
                        pdf_doc, drawing_id, filename
                    )
                    if overview_info['success']:
                        result['overview_thumbnail'] = overview_info
                
                result['success'] = len(result['pages']) > 0
                
                # Create thumbnail URL mapping for easy access
                for page_info in result['pages']:
                    page_num = page_info['page_number']
                    result['thumbnail_urls'][f'page_{page_num}'] = page_info['thumbnails']
                
            finally:
                pdf_doc.close()
                
            return result
            
        except Exception as e:
            logger.error(f"Thumbnail generation failed for {drawing_id}: {e}")
            return {
                'drawing_id': drawing_id,
                'success': False,
                'error': str(e),
                'generated_at': datetime.utcnow().isoformat()
            }

    def _process_page(self, pdf_doc: fitz.Document, page_num: int, drawing_id: str, filename: str) -> Dict[str, Any]:
        """Process a single PDF page to generate thumbnails and extract metadata"""
        try:
            page_info = {
                'page_number': page_num + 1,
                'success': False,
                'thumbnails': {},
                'metadata': {},
                'error': None
            }
            
            page = pdf_doc[page_num]
            
            # Extract page metadata
            page_metadata = self._extract_page_metadata(page, page_num)
            page_info['metadata'] = page_metadata
            
            # Generate thumbnails in different sizes
            for size_name, (width, height) in self.thumbnail_sizes.items():
                try:
                    thumbnail_info = self._generate_page_thumbnail(
                        page, page_num, drawing_id, filename, size_name, width, height
                    )
                    
                    if thumbnail_info['success']:
                        page_info['thumbnails'][size_name] = {
                            'url': thumbnail_info['s3_url'],
                            'key': thumbnail_info['s3_key'],
                            'size': thumbnail_info['size'],
                            'file_size': thumbnail_info['file_size']
                        }
                    else:
                        logger.warning(f"Failed to generate {size_name} thumbnail for page {page_num + 1}")
                        
                except Exception as e:
                    logger.error(f"Error generating {size_name} thumbnail for page {page_num + 1}: {e}")
            
            page_info['success'] = len(page_info['thumbnails']) > 0
            
            return page_info
            
        except Exception as e:
            logger.error(f"Error processing page {page_num + 1}: {e}")
            return {
                'page_number': page_num + 1,
                'success': False,
                'error': str(e)
            }

    def _generate_page_thumbnail(self, page: fitz.Page, page_num: int, drawing_id: str, 
                                filename: str, size_name: str, width: int, height: int) -> Dict[str, Any]:
        """Generate a single thumbnail for a page"""
        try:
            # Calculate optimal matrix for rendering
            page_rect = page.rect
            scale_x = width / page_rect.width
            scale_y = height / page_rect.height
            scale = min(scale_x, scale_y)  # Maintain aspect ratio
            
            matrix = fitz.Matrix(scale, scale)
            
            # Render page to pixmap
            pix = page.get_pixmap(matrix=matrix, alpha=False)
            img_data = pix.pil_tobytes(format="JPEG", optimize=True)
            
            # Convert to PIL Image for additional processing
            img = Image.open(io.BytesIO(img_data))
            
            # Create canvas with white background to maintain consistent size
            canvas = Image.new('RGB', (width, height), 'white')
            
            # Center the image on the canvas
            img_width, img_height = img.size
            x_offset = (width - img_width) // 2
            y_offset = (height - img_height) // 2
            canvas.paste(img, (x_offset, y_offset))
            
            # Add page number overlay for identification
            canvas = self._add_page_overlay(canvas, page_num + 1, size_name)
            
            # Convert to bytes
            output_buffer = io.BytesIO()
            canvas.save(output_buffer, format='JPEG', quality=self.jpeg_quality, optimize=True)
            thumbnail_data = output_buffer.getvalue()
            
            # Generate S3 key
            timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
            s3_key = f"thumbnails/{drawing_id}/page_{page_num + 1}_{size_name}_{timestamp}.jpg"
            
            # Upload to S3
            self.s3_client.put_object(
                Bucket=self.s3_bucket,
                Key=s3_key,
                Body=thumbnail_data,
                ContentType='image/jpeg',
                Metadata={
                    'drawing_id': drawing_id,
                    'page_number': str(page_num + 1),
                    'size': size_name,
                    'original_filename': filename,
                    'generated_at': datetime.utcnow().isoformat()
                }
            )
            
            # Generate presigned URL for access
            s3_url = self.s3_client.generate_presigned_url(
                'get_object',
                Params={'Bucket': self.s3_bucket, 'Key': s3_key},
                ExpiresIn=3600 * 24 * 7  # 7 days
            )
            
            return {
                'success': True,
                's3_key': s3_key,
                's3_url': s3_url,
                'size': f"{canvas.width}x{canvas.height}",
                'file_size': len(thumbnail_data)
            }
            
        except Exception as e:
            logger.error(f"Error generating thumbnail: {e}")
            return {'success': False, 'error': str(e)}

    def _extract_page_metadata(self, page: fitz.Page, page_num: int) -> Dict[str, Any]:
        """Extract metadata from a PDF page"""
        try:
            metadata = {
                'page_number': page_num + 1,
                'dimensions': {
                    'width': page.rect.width,
                    'height': page.rect.height,
                    'orientation': 'landscape' if page.rect.width > page.rect.height else 'portrait'
                },
                'text_content': {
                    'has_text': False,
                    'character_count': 0,
                    'word_count': 0,
                    'line_count': 0
                },
                'visual_content': {
                    'has_images': False,
                    'image_count': 0,
                    'has_drawings': False
                },
                'quality_indicators': {}
            }
            
            # Extract and analyze text
            text = page.get_text()
            if text.strip():
                metadata['text_content']['has_text'] = True
                metadata['text_content']['character_count'] = len(text)
                metadata['text_content']['word_count'] = len(text.split())
                metadata['text_content']['line_count'] = len(text.split('\n'))
            
            # Analyze images
            image_list = page.get_images()
            metadata['visual_content']['image_count'] = len(image_list)
            metadata['visual_content']['has_images'] = len(image_list) > 0
            
            # Analyze drawing elements (lines, shapes, etc.)
            drawings = page.get_drawings()
            metadata['visual_content']['has_drawings'] = len(drawings) > 0
            metadata['visual_content']['drawing_count'] = len(drawings)
            
            # Quality indicators
            page_area = page.rect.width * page.rect.height
            text_density = metadata['text_content']['character_count'] / page_area if page_area > 0 else 0
            
            metadata['quality_indicators'] = {
                'text_density': text_density,
                'content_ratio': {
                    'text': 0.7 if metadata['text_content']['has_text'] else 0.0,
                    'images': 0.2 if metadata['visual_content']['has_images'] else 0.0,
                    'drawings': 0.1 if metadata['visual_content']['has_drawings'] else 0.0
                }
            }
            
            return metadata
            
        except Exception as e:
            logger.error(f"Error extracting page metadata: {e}")
            return {'page_number': page_num + 1, 'error': str(e)}

    def _add_page_overlay(self, image: Image.Image, page_num: int, size_name: str) -> Image.Image:
        """Add page number overlay to thumbnail"""
        try:
            # Create a copy to avoid modifying the original
            img_with_overlay = image.copy()
            draw = ImageDraw.Draw(img_with_overlay)
            
            # Configure overlay based on size
            if size_name == 'small':
                font_size = 10
                padding = 3
            elif size_name == 'medium':
                font_size = 14
                padding = 5
            else:  # large
                font_size = 18
                padding = 8
            
            # Try to use a system font, fallback to default
            try:
                font = ImageFont.truetype("arial.ttf", font_size)
            except:
                try:
                    font = ImageFont.truetype("/System/Library/Fonts/Arial.ttf", font_size)
                except:
                    font = ImageFont.load_default()
            
            # Prepare text
            text = f"Page {page_num}"
            
            # Calculate text position (bottom-right corner)
            text_bbox = draw.textbbox((0, 0), text, font=font)
            text_width = text_bbox[2] - text_bbox[0]
            text_height = text_bbox[3] - text_bbox[1]
            
            x = image.width - text_width - padding - 5
            y = image.height - text_height - padding - 5
            
            # Draw background rectangle
            bg_rect = [
                x - padding, y - padding,
                x + text_width + padding, y + text_height + padding
            ]
            draw.rectangle(bg_rect, fill=(0, 0, 0, 180), outline=(255, 255, 255))
            
            # Draw text
            draw.text((x, y), text, fill=(255, 255, 255), font=font)
            
            return img_with_overlay
            
        except Exception as e:
            logger.warning(f"Failed to add page overlay: {e}")
            return image  # Return original image if overlay fails

    def _generate_overview_thumbnail(self, pdf_doc: fitz.Document, drawing_id: str, filename: str) -> Dict[str, Any]:
        """Generate an overview thumbnail showing multiple pages in a grid"""
        try:
            overview_info = {
                'success': False,
                'type': 'overview',
                's3_key': None,
                's3_url': None,
                'pages_included': pdf_doc.page_count
            }
            
            # Determine grid layout based on page count
            total_pages = pdf_doc.page_count
            if total_pages <= 4:
                grid_cols = 2
                grid_rows = 2
            elif total_pages <= 9:
                grid_cols = 3
                grid_rows = 3
            elif total_pages <= 16:
                grid_cols = 4
                grid_rows = 4
            else:
                # For more than 16 pages, show first 16
                grid_cols = 4
                grid_rows = 4
                total_pages = 16
            
            # Individual thumbnail size within the grid
            thumb_width = 200
            thumb_height = 260
            
            # Create overview canvas
            overview_width = grid_cols * thumb_width + (grid_cols + 1) * 10  # 10px padding
            overview_height = grid_rows * thumb_height + (grid_rows + 1) * 10
            overview_canvas = Image.new('RGB', (overview_width, overview_height), 'white')
            
            # Generate thumbnails for each page
            for i in range(min(total_pages, grid_cols * grid_rows)):
                page = pdf_doc[i]
                
                # Calculate position in grid
                row = i // grid_cols
                col = i % grid_cols
                
                x = col * thumb_width + (col + 1) * 10
                y = row * thumb_height + (row + 1) * 10
                
                # Generate page thumbnail
                page_rect = page.rect
                scale_x = thumb_width / page_rect.width
                scale_y = thumb_height / page_rect.height
                scale = min(scale_x, scale_y)
                
                matrix = fitz.Matrix(scale, scale)
                pix = page.get_pixmap(matrix=matrix, alpha=False)
                img_data = pix.pil_tobytes(format="JPEG")
                
                page_img = Image.open(io.BytesIO(img_data))
                
                # Create individual canvas for consistent sizing
                page_canvas = Image.new('RGB', (thumb_width, thumb_height), 'white')
                
                # Center the page image
                img_width, img_height = page_img.size
                x_offset = (thumb_width - img_width) // 2
                y_offset = (thumb_height - img_height) // 2
                page_canvas.paste(page_img, (x_offset, y_offset))
                
                # Add page number
                page_canvas = self._add_page_overlay(page_canvas, i + 1, 'small')
                
                # Paste onto overview canvas
                overview_canvas.paste(page_canvas, (x, y))
            
            # Convert overview to bytes
            output_buffer = io.BytesIO()
            overview_canvas.save(output_buffer, format='JPEG', quality=self.jpeg_quality, optimize=True)
            overview_data = output_buffer.getvalue()
            
            # Upload overview to S3
            timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
            s3_key = f"thumbnails/{drawing_id}/overview_{timestamp}.jpg"
            
            self.s3_client.put_object(
                Bucket=self.s3_bucket,
                Key=s3_key,
                Body=overview_data,
                ContentType='image/jpeg',
                Metadata={
                    'drawing_id': drawing_id,
                    'type': 'overview',
                    'pages_included': str(total_pages),
                    'original_filename': filename,
                    'generated_at': datetime.utcnow().isoformat()
                }
            )
            
            # Generate presigned URL
            s3_url = self.s3_client.generate_presigned_url(
                'get_object',
                Params={'Bucket': self.s3_bucket, 'Key': s3_key},
                ExpiresIn=3600 * 24 * 7  # 7 days
            )
            
            overview_info.update({
                'success': True,
                's3_key': s3_key,
                's3_url': s3_url,
                'size': f"{overview_canvas.width}x{overview_canvas.height}",
                'file_size': len(overview_data)
            })
            
            return overview_info
            
        except Exception as e:
            logger.error(f"Error generating overview thumbnail: {e}")
            return {'success': False, 'error': str(e), 'type': 'overview'}

    def get_page_navigation_data(self, file_content: bytes) -> Dict[str, Any]:
        """Generate page navigation data for frontend"""
        try:
            pdf_doc = fitz.open(stream=file_content, filetype="pdf")
            
            try:
                navigation_data = {
                    'total_pages': pdf_doc.page_count,
                    'pages': [],
                    'navigation_info': {
                        'has_bookmarks': False,
                        'has_outline': False,
                        'page_labels': []
                    }
                }
                
                # Get outline/bookmarks if available
                outline = pdf_doc.get_toc(simple=False)
                if outline:
                    navigation_data['navigation_info']['has_outline'] = True
                    navigation_data['navigation_info']['bookmarks'] = outline
                
                # Process each page for navigation
                for page_num in range(pdf_doc.page_count):
                    page = pdf_doc[page_num]
                    
                    # Extract basic page info for navigation
                    page_info = {
                        'page_number': page_num + 1,
                        'dimensions': {
                            'width': page.rect.width,
                            'height': page.rect.height,
                            'orientation': 'landscape' if page.rect.width > page.rect.height else 'portrait'
                        },
                        'has_content': {
                            'text': bool(page.get_text().strip()),
                            'images': len(page.get_images()) > 0,
                            'drawings': len(page.get_drawings()) > 0
                        }
                    }
                    
                    # Try to extract page title from text (first non-empty line)
                    text = page.get_text()
                    if text.strip():
                        lines = [line.strip() for line in text.split('\n') if line.strip()]
                        if lines:
                            # Take first line as potential title, limit length
                            potential_title = lines[0][:50]
                            page_info['title'] = potential_title
                    
                    navigation_data['pages'].append(page_info)
                
                return navigation_data
                
            finally:
                pdf_doc.close()
                
        except Exception as e:
            logger.error(f"Error generating navigation data: {e}")
            return {'error': str(e), 'total_pages': 0, 'pages': []}

    def cleanup_thumbnails(self, drawing_id: str) -> Dict[str, Any]:
        """Clean up all thumbnails for a drawing when it's deleted"""
        try:
            # List all thumbnails for this drawing
            prefix = f"thumbnails/{drawing_id}/"
            response = self.s3_client.list_objects_v2(Bucket=self.s3_bucket, Prefix=prefix)
            
            deleted_count = 0
            errors = []
            
            if 'Contents' in response:
                # Delete all thumbnail files
                objects_to_delete = [{'Key': obj['Key']} for obj in response['Contents']]
                
                if objects_to_delete:
                    delete_response = self.s3_client.delete_objects(
                        Bucket=self.s3_bucket,
                        Delete={'Objects': objects_to_delete}
                    )
                    
                    deleted_count = len(delete_response.get('Deleted', []))
                    errors = delete_response.get('Errors', [])
            
            return {
                'success': True,
                'deleted_count': deleted_count,
                'errors': errors
            }
            
        except Exception as e:
            logger.error(f"Error cleaning up thumbnails for {drawing_id}: {e}")
            return {'success': False, 'error': str(e)}
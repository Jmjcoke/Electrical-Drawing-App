"""
Advanced PDF Analysis Module for ELECTRICAL ORCHESTRATOR
Provides comprehensive PDF format verification, quality assessment, and electrical drawing classification
"""

import io
import re
import logging
from typing import Dict, Any, List, Tuple, Optional
from datetime import datetime
import fitz  # PyMuPDF
import PyPDF2
from PIL import Image
import numpy as np

logger = logging.getLogger(__name__)

class PDFAnalyzer:
    """Advanced PDF analysis for electrical drawings"""
    
    def __init__(self):
        self.electrical_keywords = [
            'electrical', 'circuit', 'wiring', 'schematic', 'panel', 'motor',
            'control', 'instrument', 'power', 'voltage', 'current', 'relay',
            'transformer', 'switch', 'breaker', 'fuse', 'cable', 'conduit',
            'junction', 'terminal', 'equipment', 'distribution', 'load',
            'feeder', 'branch', 'ground', 'neutral', 'phase', 'three-phase',
            'single-phase', 'dc', 'ac', 'plc', 'scada', 'dcs', 'hmi',
            'vfd', 'starter', 'contactor', 'mcc', 'switchgear', 'panelboard'
        ]
        
        self.cad_systems = {
            'autocad': ['autocad', 'acad', 'dwg', 'autodesk'],
            'microstation': ['microstation', 'bentley', 'dgn'],
            'solidworks': ['solidworks', 'sw electrical', 'solidworks electrical'],
            'eplan': ['eplan', 'eplan electric'],
            'inventor': ['inventor', 'autodesk inventor'],
            'revit': ['revit', 'autodesk revit'],
            'cadworx': ['cadworx', 'intergraph'],
            'smartplant': ['smartplant', 'hexagon', 'intergraph']
        }
        
        self.drawing_types = {
            'single_line': ['single line', 'one line', 'sld', 'old'],
            'schematic': ['schematic', 'elementary', 'control schematic'],
            'wiring': ['wiring diagram', 'connection diagram', 'interconnection'],
            'panel_layout': ['panel layout', 'panel arrangement', 'cubicle layout'],
            'loop_diagram': ['loop diagram', 'instrument loop', 'i&c loop'],
            'cable_schedule': ['cable schedule', 'cable list', 'wire schedule'],
            'load_list': ['load list', 'motor list', 'equipment list'],
            'plot_plan': ['plot plan', 'site plan', 'layout', 'arrangement'],
            'details': ['details', 'typical', 'standard', 'assembly']
        }

    def analyze_pdf(self, file_content: bytes, filename: str) -> Dict[str, Any]:
        """
        Comprehensive PDF analysis including format verification, quality assessment,
        and electrical drawing classification
        """
        try:
            analysis_results = {
                'filename': filename,
                'analysis_timestamp': datetime.utcnow().isoformat(),
                'file_size': len(file_content),
                'is_valid': False,
                'quality_score': 0.0,
                'format_info': {},
                'content_analysis': {},
                'electrical_classification': {},
                'warnings': [],
                'errors': []
            }
            
            # Basic format verification
            format_validation = self._validate_pdf_format(file_content)
            analysis_results['format_info'] = format_validation
            
            if not format_validation['is_valid']:
                analysis_results['errors'].append(format_validation.get('error', 'Invalid PDF format'))
                return analysis_results
            
            # Open PDF for detailed analysis
            pdf_doc = fitz.open(stream=file_content, filetype="pdf")
            
            try:
                # Content analysis
                content_analysis = self._analyze_content(pdf_doc, filename)
                analysis_results['content_analysis'] = content_analysis
                
                # Quality assessment
                quality_assessment = self._assess_quality(pdf_doc, file_content)
                analysis_results['quality_score'] = quality_assessment['overall_score']
                analysis_results['quality_details'] = quality_assessment
                
                # Electrical drawing classification
                electrical_classification = self._classify_electrical_drawing(
                    pdf_doc, filename, content_analysis
                )
                analysis_results['electrical_classification'] = electrical_classification
                
                # CAD system detection
                cad_info = self._detect_cad_system(pdf_doc, content_analysis)
                analysis_results['cad_system'] = cad_info
                
                # Generate warnings based on analysis
                warnings = self._generate_warnings(analysis_results)
                analysis_results['warnings'] = warnings
                
                analysis_results['is_valid'] = True
                
            finally:
                pdf_doc.close()
                
            return analysis_results
            
        except Exception as e:
            logger.error(f"PDF analysis error for {filename}: {e}")
            return {
                'filename': filename,
                'analysis_timestamp': datetime.utcnow().isoformat(),
                'is_valid': False,
                'error': str(e),
                'quality_score': 0.0
            }

    def _validate_pdf_format(self, file_content: bytes) -> Dict[str, Any]:
        """Validate PDF format and structure"""
        try:
            # Check PDF header
            if not file_content.startswith(b'%PDF-'):
                return {'is_valid': False, 'error': 'Missing PDF header'}
            
            # Extract PDF version
            header_line = file_content[:20].decode('ascii', errors='ignore')
            version_match = re.search(r'%PDF-(\d+\.\d+)', header_line)
            pdf_version = version_match.group(1) if version_match else 'unknown'
            
            # Check for EOF marker
            if b'%%EOF' not in file_content[-1024:]:
                return {
                    'is_valid': True,
                    'warning': 'Missing or corrupt EOF marker',
                    'pdf_version': pdf_version
                }
            
            # Try to parse with PyPDF2 for structure validation
            try:
                pdf_reader = PyPDF2.PdfReader(io.BytesIO(file_content))
                page_count = len(pdf_reader.pages)
                is_encrypted = pdf_reader.is_encrypted
                
                # Get metadata
                metadata = pdf_reader.metadata or {}
                
                return {
                    'is_valid': True,
                    'pdf_version': pdf_version,
                    'page_count': page_count,
                    'is_encrypted': is_encrypted,
                    'metadata': {
                        'title': metadata.get('/Title', ''),
                        'author': metadata.get('/Author', ''),
                        'subject': metadata.get('/Subject', ''),
                        'creator': metadata.get('/Creator', ''),
                        'producer': metadata.get('/Producer', ''),
                        'creation_date': str(metadata.get('/CreationDate', '')),
                        'modification_date': str(metadata.get('/ModDate', ''))
                    }
                }
                
            except Exception as pdf_error:
                # Try with PyMuPDF as fallback
                try:
                    pdf_doc = fitz.open(stream=file_content, filetype="pdf")
                    page_count = pdf_doc.page_count
                    is_encrypted = pdf_doc.needs_pass
                    metadata = pdf_doc.metadata
                    pdf_doc.close()
                    
                    return {
                        'is_valid': True,
                        'pdf_version': pdf_version,
                        'page_count': page_count,
                        'is_encrypted': is_encrypted,
                        'metadata': metadata,
                        'parsing_method': 'pymupdf_fallback'
                    }
                    
                except Exception:
                    return {
                        'is_valid': False,
                        'error': f'PDF structure validation failed: {pdf_error}'
                    }
                    
        except Exception as e:
            return {'is_valid': False, 'error': f'Format validation error: {e}'}

    def _analyze_content(self, pdf_doc: fitz.Document, filename: str) -> Dict[str, Any]:
        """Analyze PDF content for text, images, and structure"""
        try:
            content_info = {
                'page_count': pdf_doc.page_count,
                'has_text': False,
                'has_images': False,
                'text_content': '',
                'image_count': 0,
                'page_sizes': [],
                'text_stats': {},
                'language_detected': None
            }
            
            all_text = []
            total_images = 0
            
            for page_num in range(pdf_doc.page_count):
                page = pdf_doc[page_num]
                
                # Get page dimensions
                rect = page.rect
                content_info['page_sizes'].append({
                    'page': page_num + 1,
                    'width': rect.width,
                    'height': rect.height,
                    'orientation': 'landscape' if rect.width > rect.height else 'portrait'
                })
                
                # Extract text
                page_text = page.get_text()
                if page_text.strip():
                    content_info['has_text'] = True
                    all_text.append(page_text)
                
                # Count images
                image_list = page.get_images()
                total_images += len(image_list)
                if image_list:
                    content_info['has_images'] = True
            
            # Combine all text
            content_info['text_content'] = '\n'.join(all_text)
            content_info['image_count'] = total_images
            
            # Text statistics
            if content_info['text_content']:
                text = content_info['text_content']
                content_info['text_stats'] = {
                    'character_count': len(text),
                    'word_count': len(text.split()),
                    'line_count': len(text.split('\n')),
                    'average_words_per_line': len(text.split()) / max(len(text.split('\n')), 1)
                }
            
            return content_info
            
        except Exception as e:
            logger.error(f"Content analysis error: {e}")
            return {'error': str(e)}

    def _assess_quality(self, pdf_doc: fitz.Document, file_content: bytes) -> Dict[str, Any]:
        """Assess PDF quality for engineering drawing analysis"""
        try:
            quality_metrics = {
                'overall_score': 0.0,
                'resolution_score': 0.0,
                'text_quality_score': 0.0,
                'structure_score': 0.0,
                'size_score': 0.0,
                'readability_score': 0.0,
                'details': {}
            }
            
            # File size assessment (larger files often have higher quality)
            file_size_mb = len(file_content) / (1024 * 1024)
            if file_size_mb > 50:
                size_score = 1.0
            elif file_size_mb > 20:
                size_score = 0.8
            elif file_size_mb > 5:
                size_score = 0.6
            elif file_size_mb > 1:
                size_score = 0.4
            else:
                size_score = 0.2
            
            quality_metrics['size_score'] = size_score
            quality_metrics['details']['file_size_mb'] = file_size_mb
            
            # Page structure assessment
            page_count = pdf_doc.page_count
            structure_score = min(1.0, page_count / 20.0)  # Assume optimal around 20 pages
            quality_metrics['structure_score'] = structure_score
            quality_metrics['details']['page_count'] = page_count
            
            # Text quality assessment
            page = pdf_doc[0]  # Analyze first page
            text = page.get_text()
            
            if text:
                # Text density (characters per page area)
                rect = page.rect
                page_area = rect.width * rect.height
                text_density = len(text) / page_area if page_area > 0 else 0
                
                # Text readability (look for structured text patterns)
                lines = text.split('\n')
                non_empty_lines = [line for line in lines if line.strip()]
                avg_line_length = sum(len(line) for line in non_empty_lines) / max(len(non_empty_lines), 1)
                
                text_quality_score = min(1.0, (text_density * 1000 + avg_line_length / 50) / 2)
                quality_metrics['text_quality_score'] = text_quality_score
                quality_metrics['details']['text_density'] = text_density
                quality_metrics['details']['avg_line_length'] = avg_line_length
            else:
                quality_metrics['text_quality_score'] = 0.0
                quality_metrics['details']['text_available'] = False
            
            # Resolution assessment (approximate)
            try:
                # Get page as image to assess resolution
                mat = fitz.Matrix(2, 2)  # 2x zoom for better quality assessment
                pix = page.get_pixmap(matrix=mat)
                img_data = pix.pil_tobytes(format="PNG")
                img = Image.open(io.BytesIO(img_data))
                
                width, height = img.size
                total_pixels = width * height
                
                # Assess based on pixel density
                if total_pixels > 4000000:  # ~2000x2000
                    resolution_score = 1.0
                elif total_pixels > 2000000:
                    resolution_score = 0.8
                elif total_pixels > 1000000:
                    resolution_score = 0.6
                else:
                    resolution_score = 0.4
                
                quality_metrics['resolution_score'] = resolution_score
                quality_metrics['details']['estimated_resolution'] = f"{width}x{height}"
                
            except Exception:
                quality_metrics['resolution_score'] = 0.5  # Default if can't assess
            
            # Calculate overall score
            weights = {
                'size_score': 0.2,
                'structure_score': 0.2,
                'text_quality_score': 0.3,
                'resolution_score': 0.3
            }
            
            overall_score = sum(
                quality_metrics[metric] * weight 
                for metric, weight in weights.items()
            )
            
            quality_metrics['overall_score'] = round(overall_score, 2)
            
            return quality_metrics
            
        except Exception as e:
            logger.error(f"Quality assessment error: {e}")
            return {'overall_score': 0.0, 'error': str(e)}

    def _classify_electrical_drawing(self, pdf_doc: fitz.Document, filename: str, content_info: Dict) -> Dict[str, Any]:
        """Classify the type of electrical drawing and its characteristics"""
        try:
            classification = {
                'is_electrical': False,
                'confidence_score': 0.0,
                'drawing_types': [],
                'detected_keywords': [],
                'electrical_components': [],
                'voltage_levels': [],
                'system_types': []
            }
            
            # Combine filename and text content for analysis
            text_to_analyze = f"{filename.lower()} {content_info.get('text_content', '').lower()}"
            
            # Check for electrical keywords
            found_keywords = []
            for keyword in self.electrical_keywords:
                if keyword in text_to_analyze:
                    found_keywords.append(keyword)
            
            classification['detected_keywords'] = found_keywords
            
            # Calculate electrical confidence score
            keyword_score = len(found_keywords) / len(self.electrical_keywords)
            filename_score = 1.0 if any(kw in filename.lower() for kw in self.electrical_keywords[:10]) else 0.0
            
            confidence_score = (keyword_score * 0.7 + filename_score * 0.3)
            classification['confidence_score'] = round(confidence_score, 2)
            classification['is_electrical'] = confidence_score > 0.1
            
            # Classify drawing types
            detected_types = []
            for drawing_type, keywords in self.drawing_types.items():
                if any(keyword in text_to_analyze for keyword in keywords):
                    detected_types.append(drawing_type)
            
            classification['drawing_types'] = detected_types
            
            # Detect electrical components
            component_patterns = [
                r'\b(?:motor|mtr)\s*(?:\d+|[a-z]+)', r'\bpanel\s*(?:\d+|[a-z]+)',
                r'\btransformer\s*(?:\d+|[a-z]+)', r'\bbreaker\s*(?:\d+|[a-z]+)',
                r'\bfuse\s*(?:\d+|[a-z]+)', r'\brelay\s*(?:\d+|[a-z]+)',
                r'\bswitch\s*(?:\d+|[a-z]+)', r'\bcable\s*(?:\d+|[a-z]+)'
            ]
            
            detected_components = []
            for pattern in component_patterns:
                matches = re.findall(pattern, text_to_analyze)
                detected_components.extend(matches)
            
            classification['electrical_components'] = list(set(detected_components))
            
            # Detect voltage levels
            voltage_patterns = [
                r'\b(?:\d+(?:\.\d+)?)\s*(?:v|volt|volts|kv|kilovolt)\b',
                r'\b(?:480|277|240|208|120|24|12|4160|13800)(?:\s*v)?\b'
            ]
            
            voltage_levels = []
            for pattern in voltage_patterns:
                matches = re.findall(pattern, text_to_analyze)
                voltage_levels.extend(matches)
            
            classification['voltage_levels'] = list(set(voltage_levels))
            
            # Detect system types
            system_keywords = {
                'power': ['power', 'distribution', 'feeder', 'load'],
                'control': ['control', 'plc', 'scada', 'dcs', 'hmi'],
                'instrumentation': ['instrument', 'i&c', 'transmitter', 'analyzer'],
                'lighting': ['lighting', 'illumination', 'fixture'],
                'fire_safety': ['fire', 'alarm', 'safety', 'emergency'],
                'communication': ['communication', 'data', 'network', 'ethernet']
            }
            
            detected_systems = []
            for system_type, keywords in system_keywords.items():
                if any(keyword in text_to_analyze for keyword in keywords):
                    detected_systems.append(system_type)
            
            classification['system_types'] = detected_systems
            
            return classification
            
        except Exception as e:
            logger.error(f"Electrical classification error: {e}")
            return {'is_electrical': False, 'error': str(e)}

    def _detect_cad_system(self, pdf_doc: fitz.Document, content_info: Dict) -> Dict[str, Any]:
        """Detect the CAD system used to create the drawing"""
        try:
            cad_info = {
                'detected_system': None,
                'confidence': 0.0,
                'evidence': [],
                'version_info': None
            }
            
            # Check metadata for CAD system information
            metadata = pdf_doc.metadata
            
            # Combine metadata and text for analysis
            search_text = ' '.join([
                metadata.get('creator', '').lower(),
                metadata.get('producer', '').lower(),
                metadata.get('title', '').lower(),
                content_info.get('text_content', '').lower()[:2000]  # First 2000 chars
            ])
            
            best_match = None
            best_score = 0.0
            all_evidence = []
            
            for cad_system, keywords in self.cad_systems.items():
                evidence = []
                score = 0.0
                
                for keyword in keywords:
                    if keyword in search_text:
                        evidence.append(f"Found '{keyword}' in document")
                        score += 1.0 / len(keywords)  # Normalize by number of keywords
                
                if evidence:
                    all_evidence.extend(evidence)
                    if score > best_score:
                        best_score = score
                        best_match = cad_system
            
            cad_info['detected_system'] = best_match
            cad_info['confidence'] = round(best_score, 2)
            cad_info['evidence'] = all_evidence
            
            # Try to extract version information
            version_patterns = [
                r'autocad\s+(\d{4}|\d+\.\d+)',
                r'microstation\s+v(\d+)',
                r'solidworks\s+(\d{4})',
                r'version\s+(\d+\.\d+)',
                r'release\s+(\d+\.\d+)'
            ]
            
            for pattern in version_patterns:
                match = re.search(pattern, search_text)
                if match:
                    cad_info['version_info'] = match.group(1)
                    break
            
            return cad_info
            
        except Exception as e:
            logger.error(f"CAD system detection error: {e}")
            return {'detected_system': None, 'error': str(e)}

    def _generate_warnings(self, analysis_results: Dict[str, Any]) -> List[str]:
        """Generate warnings based on analysis results"""
        warnings = []
        
        try:
            # Quality warnings
            quality_score = analysis_results.get('quality_score', 0.0)
            if quality_score < 0.3:
                warnings.append("Low quality PDF - may affect analysis accuracy")
            elif quality_score < 0.5:
                warnings.append("Moderate quality PDF - some analysis limitations expected")
            
            # Content warnings
            content = analysis_results.get('content_analysis', {})
            if not content.get('has_text'):
                warnings.append("No text content detected - image-only PDF")
            
            if content.get('page_count', 0) > 50:
                warnings.append("Large document - processing may take longer")
            
            # Electrical classification warnings
            electrical = analysis_results.get('electrical_classification', {})
            if electrical.get('confidence_score', 0) < 0.1:
                warnings.append("Document may not be an electrical drawing")
            elif electrical.get('confidence_score', 0) < 0.3:
                warnings.append("Low confidence in electrical drawing classification")
            
            # Format warnings
            format_info = analysis_results.get('format_info', {})
            if format_info.get('is_encrypted'):
                warnings.append("Encrypted PDF - may limit processing capabilities")
            
            if 'warning' in format_info:
                warnings.append(f"Format issue: {format_info['warning']}")
            
        except Exception as e:
            logger.error(f"Warning generation error: {e}")
            warnings.append("Analysis incomplete due to processing error")
        
        return warnings
"""
Overlay Generation Module for ELECTRICAL ORCHESTRATOR
Creates visual overlays for detected cloud areas and analysis results
"""

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont
from typing import List, Dict, Any, Tuple, Optional
import io
import logging
import json
from datetime import datetime

logger = logging.getLogger(__name__)

class OverlayGenerator:
    """Generate visual overlays for cloud detection results"""
    
    def __init__(self):
        # Overlay style configurations
        self.styles = {
            'detection_overlay': {
                'bbox_color': (0, 255, 0),  # Green for detected areas
                'bbox_thickness': 2,
                'confidence_text_color': (255, 255, 255),
                'confidence_bg_color': (0, 0, 0, 180),
                'font_size': 12
            },
            'manual_overlay': {
                'bbox_color': (255, 0, 0),  # Red for manual annotations
                'bbox_thickness': 3,
                'confidence_text_color': (255, 255, 255),
                'confidence_bg_color': (255, 0, 0, 180),
                'font_size': 12
            },
            'confidence_high': {
                'bbox_color': (0, 255, 0),  # Green for high confidence
                'fill_color': (0, 255, 0, 50),
                'outline_thickness': 2
            },
            'confidence_medium': {
                'bbox_color': (255, 255, 0),  # Yellow for medium confidence
                'fill_color': (255, 255, 0, 50),
                'outline_thickness': 2
            },
            'confidence_low': {
                'bbox_color': (255, 165, 0),  # Orange for low confidence
                'fill_color': (255, 165, 0, 50),
                'outline_thickness': 1
            }
        }
        
        # Detection method colors
        self.method_colors = {
            'color': (0, 255, 255),    # Cyan
            'shape': (255, 0, 255),    # Magenta
            'texture': (0, 255, 0),    # Green
            'hybrid': (255, 255, 0),   # Yellow
            'manual': (255, 0, 0)      # Red
        }

    def generate_detection_overlay(self, image: np.ndarray, clouds: List[Dict[str, Any]], 
                                 options: Dict[str, Any] = None) -> np.ndarray:
        """Generate overlay image showing detected cloud areas"""
        try:
            if options is None:
                options = {}
            
            # Create copy of original image
            overlay_image = image.copy()
            
            # Create overlay layer for transparency effects
            overlay = np.zeros_like(image, dtype=np.uint8)
            
            for cloud in clouds:
                # Get cloud properties
                bbox = cloud.get('bbox', [])
                confidence = cloud.get('confidence_score', 0.0)
                method = cloud.get('detection_method', 'unknown')
                is_manual = cloud.get('is_manual', False)
                
                if len(bbox) != 4:
                    continue
                
                x, y, w, h = [int(coord) for coord in bbox]
                
                # Determine style based on confidence and manual status
                if is_manual:
                    style_key = 'manual_overlay'
                elif confidence >= 0.7:
                    style_key = 'confidence_high'
                elif confidence >= 0.4:
                    style_key = 'confidence_medium'
                else:
                    style_key = 'confidence_low'
                
                style = self.styles[style_key]
                
                # Draw bounding box
                if options.get('show_bounding_boxes', True):
                    color = self.method_colors.get(method, style['bbox_color'])
                    thickness = style.get('outline_thickness', 2)
                    cv2.rectangle(overlay_image, (x, y), (x + w, y + h), color, thickness)
                
                # Draw filled overlay with transparency
                if options.get('show_filled_areas', True) and 'fill_color' in style:
                    fill_color = style['fill_color'][:3]  # Remove alpha channel for OpenCV
                    cv2.rectangle(overlay, (x, y), (x + w, y + h), fill_color, -1)
                
                # Add confidence score text
                if options.get('show_confidence_scores', True):
                    self._add_confidence_text(overlay_image, x, y, confidence, method, style)
                
                # Add detection method indicator
                if options.get('show_detection_method', True):
                    self._add_method_indicator(overlay_image, x + w - 20, y + 5, method)
            
            # Blend overlay with original image
            if options.get('show_filled_areas', True):
                alpha = options.get('overlay_opacity', 0.3)
                overlay_image = cv2.addWeighted(overlay_image, 1.0, overlay, alpha, 0)
            
            # Add legend if requested
            if options.get('show_legend', False):
                overlay_image = self._add_legend(overlay_image, clouds)
            
            return overlay_image
            
        except Exception as e:
            logger.error(f"Error generating detection overlay: {e}")
            return image  # Return original image on error

    def generate_confidence_heatmap(self, image: np.ndarray, clouds: List[Dict[str, Any]]) -> np.ndarray:
        """Generate confidence heatmap overlay"""
        try:
            # Create heatmap overlay
            heatmap = np.zeros(image.shape[:2], dtype=np.float32)
            
            for cloud in clouds:
                bbox = cloud.get('bbox', [])
                confidence = cloud.get('confidence_score', 0.0)
                
                if len(bbox) != 4:
                    continue
                
                x, y, w, h = [int(coord) for coord in bbox]
                
                # Ensure coordinates are within image bounds
                x = max(0, min(x, image.shape[1] - 1))
                y = max(0, min(y, image.shape[0] - 1))
                w = min(w, image.shape[1] - x)
                h = min(h, image.shape[0] - y)
                
                # Add confidence value to heatmap
                heatmap[y:y+h, x:x+w] = np.maximum(heatmap[y:y+h, x:x+w], confidence)
            
            # Convert heatmap to color image
            heatmap_normalized = (heatmap * 255).astype(np.uint8)
            heatmap_colored = cv2.applyColorMap(heatmap_normalized, cv2.COLORMAP_JET)
            
            # Blend with original image
            alpha = 0.6
            result = cv2.addWeighted(image, 1.0 - alpha, heatmap_colored, alpha, 0)
            
            return result
            
        except Exception as e:
            logger.error(f"Error generating confidence heatmap: {e}")
            return image

    def generate_analysis_summary(self, image: np.ndarray, detection_result: Dict[str, Any]) -> np.ndarray:
        """Generate summary overlay with detection statistics"""
        try:
            summary_image = image.copy()
            
            # Prepare summary statistics
            total_clouds = detection_result.get('total_clouds_detected', 0)
            overall_confidence = detection_result.get('overall_confidence', 0.0)
            processing_time = detection_result.get('processing_time_seconds', 0.0)
            
            # Count clouds by confidence level
            clouds = []
            for page_data in detection_result.get('pages', []):
                clouds.extend(page_data.get('clouds', []))
            
            high_conf = sum(1 for c in clouds if c.get('confidence_score', 0) >= 0.7)
            med_conf = sum(1 for c in clouds if 0.4 <= c.get('confidence_score', 0) < 0.7)
            low_conf = sum(1 for c in clouds if c.get('confidence_score', 0) < 0.4)
            
            # Count clouds by detection method
            method_counts = {}
            for cloud in clouds:
                method = cloud.get('detection_method', 'unknown')
                method_counts[method] = method_counts.get(method, 0) + 1
            
            # Create summary overlay panel
            panel_height = 180
            panel_width = 350
            panel = np.zeros((panel_height, panel_width, 3), dtype=np.uint8)
            panel.fill(40)  # Dark gray background
            
            # Add border
            cv2.rectangle(panel, (0, 0), (panel_width-1, panel_height-1), (255, 255, 255), 2)
            
            # Add title
            self._add_text_to_panel(panel, "Cloud Detection Summary", 10, 20, (255, 255, 255), font_scale=0.7)
            
            # Add statistics
            y_pos = 45
            line_height = 20
            
            self._add_text_to_panel(panel, f"Total Clouds: {total_clouds}", 10, y_pos, (255, 255, 255))
            y_pos += line_height
            
            self._add_text_to_panel(panel, f"Overall Confidence: {overall_confidence:.2f}", 10, y_pos, (255, 255, 255))
            y_pos += line_height
            
            self._add_text_to_panel(panel, f"Processing Time: {processing_time:.1f}s", 10, y_pos, (255, 255, 255))
            y_pos += line_height
            
            # Confidence distribution
            self._add_text_to_panel(panel, f"High Conf: {high_conf}", 10, y_pos, (0, 255, 0))
            self._add_text_to_panel(panel, f"Med: {med_conf}", 120, y_pos, (255, 255, 0))
            self._add_text_to_panel(panel, f"Low: {low_conf}", 200, y_pos, (255, 165, 0))
            y_pos += line_height
            
            # Detection methods
            method_text = ", ".join([f"{method}: {count}" for method, count in method_counts.items()])
            if len(method_text) > 40:
                method_text = method_text[:37] + "..."
            self._add_text_to_panel(panel, f"Methods: {method_text}", 10, y_pos, (200, 200, 200))
            
            # Overlay panel on image (top-left corner)
            summary_image[10:10+panel_height, 10:10+panel_width] = panel
            
            return summary_image
            
        except Exception as e:
            logger.error(f"Error generating analysis summary: {e}")
            return image

    def generate_comparison_overlay(self, original: np.ndarray, detected_clouds: List[Dict[str, Any]], 
                                  manual_clouds: List[Dict[str, Any]] = None) -> np.ndarray:
        """Generate side-by-side comparison of original and detected clouds"""
        try:
            height, width = original.shape[:2]
            
            # Create side-by-side comparison
            comparison = np.zeros((height, width * 2, 3), dtype=np.uint8)
            
            # Left side: original image
            comparison[:, :width] = original
            
            # Right side: original with cloud overlays
            overlay_options = {
                'show_bounding_boxes': True,
                'show_filled_areas': True,
                'show_confidence_scores': True,
                'overlay_opacity': 0.4
            }
            
            right_side = self.generate_detection_overlay(original, detected_clouds, overlay_options)
            
            # Add manual clouds if provided
            if manual_clouds:
                right_side = self.generate_detection_overlay(right_side, manual_clouds, {
                    'show_bounding_boxes': True,
                    'show_filled_areas': False,
                    'show_confidence_scores': False
                })
            
            comparison[:, width:] = right_side
            
            # Add labels
            self._add_comparison_labels(comparison, width)
            
            return comparison
            
        except Exception as e:
            logger.error(f"Error generating comparison overlay: {e}")
            return original

    def _add_confidence_text(self, image: np.ndarray, x: int, y: int, confidence: float, 
                           method: str, style: Dict[str, Any]):
        """Add confidence score text to overlay"""
        try:
            text = f"{confidence:.2f}"
            font = cv2.FONT_HERSHEY_SIMPLEX
            font_scale = 0.4
            thickness = 1
            
            # Get text size
            (text_width, text_height), baseline = cv2.getTextSize(text, font, font_scale, thickness)
            
            # Position text above bounding box
            text_x = x
            text_y = max(y - 5, text_height + 5)
            
            # Draw background rectangle
            bg_color = style.get('confidence_bg_color', (0, 0, 0))[:3]  # Remove alpha
            cv2.rectangle(image, 
                         (text_x - 2, text_y - text_height - 2), 
                         (text_x + text_width + 2, text_y + baseline + 2), 
                         bg_color, -1)
            
            # Draw text
            text_color = style.get('confidence_text_color', (255, 255, 255))
            cv2.putText(image, text, (text_x, text_y), font, font_scale, text_color, thickness)
            
        except Exception as e:
            logger.error(f"Error adding confidence text: {e}")

    def _add_method_indicator(self, image: np.ndarray, x: int, y: int, method: str):
        """Add detection method indicator"""
        try:
            color = self.method_colors.get(method, (128, 128, 128))
            
            # Draw small circle indicator
            cv2.circle(image, (x, y), 5, color, -1)
            cv2.circle(image, (x, y), 5, (255, 255, 255), 1)
            
        except Exception as e:
            logger.error(f"Error adding method indicator: {e}")

    def _add_legend(self, image: np.ndarray, clouds: List[Dict[str, Any]]) -> np.ndarray:
        """Add legend showing detection methods and confidence levels"""
        try:
            # Create legend panel
            legend_height = 120
            legend_width = 200
            legend = np.zeros((legend_height, legend_width, 3), dtype=np.uint8)
            legend.fill(40)  # Dark gray background
            
            # Add border
            cv2.rectangle(legend, (0, 0), (legend_width-1, legend_height-1), (255, 255, 255), 1)
            
            # Add title
            self._add_text_to_panel(legend, "Legend", 10, 15, (255, 255, 255), font_scale=0.5)
            
            # Add method indicators
            y_pos = 35
            for method, color in self.method_colors.items():
                if any(c.get('detection_method') == method for c in clouds):
                    cv2.circle(legend, (15, y_pos), 3, color, -1)
                    self._add_text_to_panel(legend, method.capitalize(), 25, y_pos + 3, (255, 255, 255), font_scale=0.4)
                    y_pos += 15
            
            # Overlay legend on image (bottom-right corner)
            h, w = image.shape[:2]
            legend_x = w - legend_width - 10
            legend_y = h - legend_height - 10
            
            image[legend_y:legend_y+legend_height, legend_x:legend_x+legend_width] = legend
            
            return image
            
        except Exception as e:
            logger.error(f"Error adding legend: {e}")
            return image

    def _add_text_to_panel(self, panel: np.ndarray, text: str, x: int, y: int, 
                          color: Tuple[int, int, int], font_scale: float = 0.5):
        """Add text to a panel with proper font handling"""
        try:
            font = cv2.FONT_HERSHEY_SIMPLEX
            thickness = 1
            cv2.putText(panel, text, (x, y), font, font_scale, color, thickness)
            
        except Exception as e:
            logger.error(f"Error adding text to panel: {e}")

    def _add_comparison_labels(self, comparison: np.ndarray, split_x: int):
        """Add labels to comparison image"""
        try:
            height = comparison.shape[0]
            
            # Left label
            self._add_text_to_panel(comparison, "Original", 10, 25, (255, 255, 255), font_scale=0.7)
            
            # Right label
            self._add_text_to_panel(comparison, "Cloud Detection", split_x + 10, 25, (255, 255, 255), font_scale=0.7)
            
            # Add dividing line
            cv2.line(comparison, (split_x, 0), (split_x, height), (255, 255, 255), 2)
            
        except Exception as e:
            logger.error(f"Error adding comparison labels: {e}")

    def export_overlay_data(self, clouds: List[Dict[str, Any]], metadata: Dict[str, Any] = None) -> str:
        """Export cloud detection data as JSON for further processing"""
        try:
            export_data = {
                'timestamp': datetime.utcnow().isoformat(),
                'metadata': metadata or {},
                'clouds': clouds,
                'summary': {
                    'total_clouds': len(clouds),
                    'detection_methods': list(set(c.get('detection_method', 'unknown') for c in clouds)),
                    'confidence_stats': {
                        'min': min((c.get('confidence_score', 0) for c in clouds), default=0),
                        'max': max((c.get('confidence_score', 0) for c in clouds), default=0),
                        'avg': sum(c.get('confidence_score', 0) for c in clouds) / max(len(clouds), 1)
                    }
                }
            }
            
            return json.dumps(export_data, indent=2)
            
        except Exception as e:
            logger.error(f"Error exporting overlay data: {e}")
            return "{}"

    def create_overlay_thumbnail(self, image: np.ndarray, clouds: List[Dict[str, Any]], 
                               thumbnail_size: Tuple[int, int] = (300, 400)) -> np.ndarray:
        """Create thumbnail with cloud overlay for quick preview"""
        try:
            # Generate overlay
            overlay_image = self.generate_detection_overlay(image, clouds, {
                'show_bounding_boxes': True,
                'show_filled_areas': True,
                'show_confidence_scores': False,
                'overlay_opacity': 0.5
            })
            
            # Resize to thumbnail size while maintaining aspect ratio
            height, width = overlay_image.shape[:2]
            target_width, target_height = thumbnail_size
            
            # Calculate scaling factor
            scale = min(target_width / width, target_height / height)
            new_width = int(width * scale)
            new_height = int(height * scale)
            
            # Resize image
            thumbnail = cv2.resize(overlay_image, (new_width, new_height), interpolation=cv2.INTER_AREA)
            
            # Create canvas with white background
            canvas = np.ones((target_height, target_width, 3), dtype=np.uint8) * 255
            
            # Center thumbnail on canvas
            y_offset = (target_height - new_height) // 2
            x_offset = (target_width - new_width) // 2
            
            canvas[y_offset:y_offset+new_height, x_offset:x_offset+new_width] = thumbnail
            
            return canvas
            
        except Exception as e:
            logger.error(f"Error creating overlay thumbnail: {e}")
            return image
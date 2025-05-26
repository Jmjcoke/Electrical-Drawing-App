"""
Enhanced Overlay Generation Module for ELECTRICAL ORCHESTRATOR
Advanced visual overlays for cloud detection results with interactive features
"""

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont
from typing import List, Dict, Any, Tuple, Optional
import logging
from datetime import datetime
import json
import base64
import io

logger = logging.getLogger(__name__)

class EnhancedOverlayGenerator:
    """Enhanced overlay generator with advanced visualization capabilities"""
    
    def __init__(self):
        # Enhanced style configurations
        self.styles = {
            'revision_cloud': {
                'bbox_color': (255, 100, 100),  # Light red
                'fill_color': (255, 100, 100, 50),
                'outline_thickness': 2,
                'highlight_color': (255, 0, 0)
            },
            'polygon_cloud': {
                'bbox_color': (100, 255, 100),  # Light green
                'fill_color': (100, 255, 100, 50),
                'outline_thickness': 2,
                'highlight_color': (0, 255, 0)
            },
            'freehand_cloud': {
                'bbox_color': (100, 100, 255),  # Light blue
                'fill_color': (100, 100, 255, 50),
                'outline_thickness': 2,
                'highlight_color': (0, 0, 255)
            },
            'highlight_overlay': {
                'bbox_color': (255, 255, 100),  # Light yellow
                'fill_color': (255, 255, 100, 50),
                'outline_thickness': 1,
                'highlight_color': (255, 255, 0)
            },
            'bubble_cloud': {
                'bbox_color': (255, 150, 255),  # Light magenta
                'fill_color': (255, 150, 255, 50),
                'outline_thickness': 2,
                'highlight_color': (255, 0, 255)
            },
            'confidence_high': {
                'bbox_color': (0, 255, 0),  # Green
                'fill_color': (0, 255, 0, 60),
                'outline_thickness': 3
            },
            'confidence_medium': {
                'bbox_color': (255, 255, 0),  # Yellow
                'fill_color': (255, 255, 0, 40),
                'outline_thickness': 2
            },
            'confidence_low': {
                'bbox_color': (255, 165, 0),  # Orange
                'fill_color': (255, 165, 0, 30),
                'outline_thickness': 1
            },
            'selected': {
                'bbox_color': (0, 255, 255),  # Cyan
                'fill_color': (0, 255, 255, 80),
                'outline_thickness': 4
            },
            'hover': {
                'bbox_color': (255, 255, 0),  # Yellow
                'fill_color': (255, 255, 0, 60),
                'outline_thickness': 3
            }
        }
        
        # Visualization modes
        self.visualization_modes = {
            'standard': self._draw_standard_overlay,
            'heatmap': self._draw_heatmap_overlay,
            'outline': self._draw_outline_overlay,
            'contour': self._draw_contour_overlay,
            'pattern_specific': self._draw_pattern_specific_overlay
        }
    
    def generate_enhanced_overlay(self, image: np.ndarray, clouds: List[Dict[str, Any]], options: Dict[str, Any] = None) -> np.ndarray:
        """
        Generate enhanced overlay with advanced visualization options.
        
        Args:
            image: Original image
            clouds: List of detected cloud areas
            options: Advanced overlay options
            
        Returns:
            Image with enhanced overlay
        """
        try:
            if options is None:
                options = {}
            
            overlay_image = image.copy()
            
            # Enhanced options
            visualization_mode = options.get('visualization_mode', 'standard')
            show_confidence = options.get('show_confidence', True)
            show_pattern_type = options.get('show_pattern_type', True)
            show_contours = options.get('show_contours', True)
            show_statistics = options.get('show_statistics', False)
            show_details = options.get('show_details', False)
            transparency = options.get('transparency', 0.3)
            selected_cloud_id = options.get('selected_cloud_id', None)
            hover_cloud_id = options.get('hover_cloud_id', None)
            
            # Sort clouds by confidence for better rendering
            sorted_clouds = sorted(clouds, key=lambda c: c.get('confidence', 0.0))
            
            # Apply visualization mode
            if visualization_mode in self.visualization_modes:
                overlay_image = self.visualization_modes[visualization_mode](
                    overlay_image, sorted_clouds, options
                )
            
            # Add interactive elements
            if selected_cloud_id or hover_cloud_id:
                overlay_image = self._add_interactive_elements(
                    overlay_image, clouds, selected_cloud_id, hover_cloud_id
                )
            
            # Add annotations
            overlay_image = self._add_enhanced_annotations(
                overlay_image, clouds, options
            )
            
            # Add statistics panel
            if show_statistics:
                overlay_image = self._add_statistics_panel(overlay_image, clouds)
            
            return overlay_image
            
        except Exception as e:
            logger.error(f"Error generating enhanced overlay: {e}")
            return image
    
    def _draw_standard_overlay(self, image: np.ndarray, clouds: List[Dict[str, Any]], options: Dict[str, Any]) -> np.ndarray:
        """Draw standard bounding box overlay with pattern-specific colors."""
        for cloud in clouds:
            bbox = cloud.get('bbox', [])
            if len(bbox) < 4:
                continue
                
            x, y, w, h = [int(coord) for coord in bbox]
            shape_features = cloud.get('shape_features', {})
            pattern_type = shape_features.get('pattern_type', 'unknown')
            confidence = cloud.get('confidence', 0.0)
            
            # Get style based on pattern type or confidence
            style = self._get_style_for_cloud(cloud)
            
            # Draw filled area
            overlay = image.copy()
            cv2.rectangle(overlay, (x, y), (x + w, y + h), style['fill_color'][:3], -1)
            alpha = style['fill_color'][3] / 255.0 if len(style['fill_color']) > 3 else 0.3
            image[:] = cv2.addWeighted(image, 1 - alpha, overlay, alpha, 0)
            
            # Draw border
            cv2.rectangle(image, (x, y), (x + w, y + h), style['bbox_color'], style['outline_thickness'])
        
        return image
    
    def _draw_heatmap_overlay(self, image: np.ndarray, clouds: List[Dict[str, Any]], options: Dict[str, Any]) -> np.ndarray:
        """Draw heatmap-style overlay based on confidence levels."""
        heatmap = np.zeros(image.shape[:2], dtype=np.float32)
        
        for cloud in clouds:
            bbox = cloud.get('bbox', [])
            confidence = cloud.get('confidence', 0.0)
            
            if len(bbox) < 4:
                continue
                
            x, y, w, h = [int(coord) for coord in bbox]
            
            # Ensure bounds
            x = max(0, min(x, image.shape[1] - w))
            y = max(0, min(y, image.shape[0] - h))
            
            # Add to heatmap
            heatmap[y:y+h, x:x+w] = np.maximum(heatmap[y:y+h, x:x+w], confidence)
        
        # Convert to color
        heatmap_norm = (heatmap * 255).astype(np.uint8)
        heatmap_colored = cv2.applyColorMap(heatmap_norm, cv2.COLORMAP_JET)
        
        # Blend
        alpha = options.get('heatmap_intensity', 0.6)
        return cv2.addWeighted(image, 1 - alpha, heatmap_colored, alpha, 0)
    
    def _draw_outline_overlay(self, image: np.ndarray, clouds: List[Dict[str, Any]], options: Dict[str, Any]) -> np.ndarray:
        """Draw outline-only overlay for minimal visual impact."""
        for cloud in clouds:
            bbox = cloud.get('bbox', [])
            if len(bbox) < 4:
                continue
                
            x, y, w, h = [int(coord) for coord in bbox]
            style = self._get_style_for_cloud(cloud)
            
            # Draw dashed outline
            self._draw_dashed_rectangle(image, (x, y), (x + w, y + h), style['bbox_color'])
        
        return image
    
    def _draw_contour_overlay(self, image: np.ndarray, clouds: List[Dict[str, Any]], options: Dict[str, Any]) -> np.ndarray:
        """Draw contour-based overlay for precise shape highlighting."""
        for cloud in clouds:
            contour = cloud.get('contour', [])
            if not contour:
                continue
            
            try:
                # Convert contour to proper format
                if isinstance(contour, list):
                    contour_array = np.array(contour, dtype=np.int32)
                else:
                    contour_array = contour.astype(np.int32)
                
                if len(contour_array.shape) == 2:
                    contour_array = contour_array.reshape((-1, 1, 2))
                
                style = self._get_style_for_cloud(cloud)
                
                # Draw contour
                cv2.drawContours(image, [contour_array], -1, style['bbox_color'], style['outline_thickness'])
                
                # Fill contour with transparency
                overlay = image.copy()
                cv2.fillPoly(overlay, [contour_array], style['fill_color'][:3])
                alpha = style['fill_color'][3] / 255.0 if len(style['fill_color']) > 3 else 0.2
                image[:] = cv2.addWeighted(image, 1 - alpha, overlay, alpha, 0)
                
            except Exception as e:
                logger.warning(f"Error drawing contour overlay: {e}")
        
        return image
    
    def _draw_pattern_specific_overlay(self, image: np.ndarray, clouds: List[Dict[str, Any]], options: Dict[str, Any]) -> np.ndarray:
        """Draw pattern-specific overlays with specialized visualizations."""
        for cloud in clouds:
            shape_features = cloud.get('shape_features', {})
            pattern_type = shape_features.get('pattern_type', 'unknown')
            
            if pattern_type == 'revision_cloud':
                self._draw_revision_cloud_overlay(image, cloud)
            elif pattern_type == 'polygon_cloud':
                self._draw_polygon_cloud_overlay(image, cloud)
            elif pattern_type == 'freehand_cloud':
                self._draw_freehand_cloud_overlay(image, cloud)
            elif pattern_type == 'highlight_overlay':
                self._draw_highlight_overlay_visualization(image, cloud)
            else:
                # Fallback to standard overlay
                self._draw_standard_cloud_overlay(image, cloud)
        
        return image
    
    def _draw_revision_cloud_overlay(self, image: np.ndarray, cloud: Dict[str, Any]):
        """Draw specialized overlay for revision clouds."""
        bbox = cloud.get('bbox', [])
        if len(bbox) < 4:
            return
            
        x, y, w, h = [int(coord) for coord in bbox]
        
        # Draw scalloped border effect
        style = self.styles['revision_cloud']
        
        # Main border
        cv2.rectangle(image, (x, y), (x + w, y + h), style['bbox_color'], style['outline_thickness'])
        
        # Add scallop indicators
        scallop_size = 8
        for i in range(0, w, scallop_size * 2):
            cv2.circle(image, (x + i, y), scallop_size // 2, style['bbox_color'], 1)
            cv2.circle(image, (x + i, y + h), scallop_size // 2, style['bbox_color'], 1)
        
        for i in range(0, h, scallop_size * 2):
            cv2.circle(image, (x, y + i), scallop_size // 2, style['bbox_color'], 1)
            cv2.circle(image, (x + w, y + i), scallop_size // 2, style['bbox_color'], 1)
    
    def _draw_polygon_cloud_overlay(self, image: np.ndarray, cloud: Dict[str, Any]):
        """Draw specialized overlay for polygon clouds."""
        bbox = cloud.get('bbox', [])
        if len(bbox) < 4:
            return
            
        x, y, w, h = [int(coord) for coord in bbox]
        shape_features = cloud.get('shape_features', {})
        num_vertices = shape_features.get('num_vertices', 4)
        
        style = self.styles['polygon_cloud']
        
        # Draw polygon approximation
        cv2.rectangle(image, (x, y), (x + w, y + h), style['bbox_color'], style['outline_thickness'])
        
        # Add vertex indicators
        vertex_positions = [
            (x, y), (x + w, y), (x + w, y + h), (x, y + h)
        ]
        
        for i, pos in enumerate(vertex_positions[:num_vertices]):
            cv2.circle(image, pos, 3, style['highlight_color'], -1)
    
    def _draw_freehand_cloud_overlay(self, image: np.ndarray, cloud: Dict[str, Any]):
        """Draw specialized overlay for freehand clouds."""
        bbox = cloud.get('bbox', [])
        if len(bbox) < 4:
            return
            
        x, y, w, h = [int(coord) for coord in bbox]
        style = self.styles['freehand_cloud']
        
        # Draw wavy border to indicate freehand nature
        cv2.rectangle(image, (x, y), (x + w, y + h), style['bbox_color'], style['outline_thickness'])
        
        # Add organic shape indicators
        wave_points = []
        for i in range(0, w, 10):
            wave_y = y + (5 * np.sin(i * 0.5))
            wave_points.append((x + i, int(wave_y)))
        
        if len(wave_points) > 1:
            for i in range(len(wave_points) - 1):
                cv2.line(image, wave_points[i], wave_points[i + 1], style['highlight_color'], 1)
    
    def _draw_highlight_overlay_visualization(self, image: np.ndarray, cloud: Dict[str, Any]):
        """Draw specialized overlay for highlight overlays."""
        bbox = cloud.get('bbox', [])
        if len(bbox) < 4:
            return
            
        x, y, w, h = [int(coord) for coord in bbox]
        shape_features = cloud.get('shape_features', {})
        color_name = shape_features.get('color_name', 'unknown')
        
        style = self.styles['highlight_overlay']
        
        # Draw with transparency effect
        overlay = image.copy()
        cv2.rectangle(overlay, (x, y), (x + w, y + h), style['fill_color'][:3], -1)
        alpha = 0.4
        image[:] = cv2.addWeighted(image, 1 - alpha, overlay, alpha, 0)
        
        # Add color indicator
        cv2.putText(image, color_name.upper(), (x + 2, y + 15), cv2.FONT_HERSHEY_SIMPLEX, 0.4, style['highlight_color'], 1)
    
    def _draw_standard_cloud_overlay(self, image: np.ndarray, cloud: Dict[str, Any]):
        """Draw standard cloud overlay for unknown types."""
        bbox = cloud.get('bbox', [])
        if len(bbox) < 4:
            return
            
        x, y, w, h = [int(coord) for coord in bbox]
        confidence = cloud.get('confidence', 0.0)
        
        # Use confidence-based styling
        if confidence >= 0.7:
            style = self.styles['confidence_high']
        elif confidence >= 0.4:
            style = self.styles['confidence_medium']
        else:
            style = self.styles['confidence_low']
        
        cv2.rectangle(image, (x, y), (x + w, y + h), style['bbox_color'], style['outline_thickness'])
    
    def _add_interactive_elements(self, image: np.ndarray, clouds: List[Dict[str, Any]], selected_id: str, hover_id: str) -> np.ndarray:
        """Add interactive selection and hover indicators."""
        for cloud in clouds:
            cloud_id = cloud.get('id', '')
            bbox = cloud.get('bbox', [])
            
            if len(bbox) < 4:
                continue
                
            x, y, w, h = [int(coord) for coord in bbox]
            
            # Selected state
            if cloud_id == selected_id:
                style = self.styles['selected']
                cv2.rectangle(image, (x - 2, y - 2), (x + w + 2, y + h + 2), style['bbox_color'], style['outline_thickness'])
                
                # Add corner markers
                marker_size = 8
                corners = [(x, y), (x + w, y), (x + w, y + h), (x, y + h)]
                for corner in corners:
                    cv2.circle(image, corner, marker_size, style['bbox_color'], -1)
            
            # Hover state
            elif cloud_id == hover_id:
                style = self.styles['hover']
                cv2.rectangle(image, (x - 1, y - 1), (x + w + 1, y + h + 1), style['bbox_color'], style['outline_thickness'])
        
        return image
    
    def _add_enhanced_annotations(self, image: np.ndarray, clouds: List[Dict[str, Any]], options: Dict[str, Any]) -> np.ndarray:
        """Add enhanced text annotations."""
        show_confidence = options.get('show_confidence', True)
        show_pattern_type = options.get('show_pattern_type', True)
        show_details = options.get('show_details', False)
        
        for cloud in clouds:
            bbox = cloud.get('bbox', [])
            if len(bbox) < 4:
                continue
                
            x, y, w, h = [int(coord) for coord in bbox]
            
            annotations = []
            
            # Confidence
            if show_confidence:
                confidence = cloud.get('confidence', 0.0)
                annotations.append(f"Conf: {confidence:.2f}")
            
            # Pattern type
            if show_pattern_type:
                shape_features = cloud.get('shape_features', {})
                pattern_type = shape_features.get('pattern_type', 'unknown')
                if pattern_type != 'unknown':
                    annotations.append(f"Type: {pattern_type.replace('_', ' ').title()}")
            
            # Additional details
            if show_details:
                shape_features = cloud.get('shape_features', {})
                if 'num_vertices' in shape_features:
                    annotations.append(f"Vertices: {shape_features['num_vertices']}")
                if 'irregularity' in shape_features:
                    annotations.append(f"Irreg: {shape_features['irregularity']:.1f}")
            
            # Draw annotations
            self._draw_text_annotations(image, x, y, w, h, annotations)
        
        return image
    
    def _draw_text_annotations(self, image: np.ndarray, x: int, y: int, w: int, h: int, annotations: List[str]):
        """Draw text annotations with background."""
        for i, annotation in enumerate(annotations):
            text_y = y - 20 - (i * 15)
            if text_y < 15:
                text_y = y + h + 15 + (i * 15)
            
            text_size = cv2.getTextSize(annotation, cv2.FONT_HERSHEY_SIMPLEX, 0.4, 1)[0]
            
            # Background
            cv2.rectangle(image, (x, text_y - 12), (x + text_size[0] + 4, text_y + 2), (0, 0, 0, 180)[:3], -1)
            
            # Text
            cv2.putText(image, annotation, (x + 2, text_y - 2), cv2.FONT_HERSHEY_SIMPLEX, 0.4, (255, 255, 255), 1)
    
    def _add_statistics_panel(self, image: np.ndarray, clouds: List[Dict[str, Any]]) -> np.ndarray:
        """Add statistics panel to the overlay."""
        if not clouds:
            return image
        
        # Calculate statistics
        total_clouds = len(clouds)
        avg_confidence = np.mean([c.get('confidence', 0) for c in clouds])
        
        # Pattern type counts
        pattern_counts = {}
        for cloud in clouds:
            pattern_type = cloud.get('shape_features', {}).get('pattern_type', 'unknown')
            pattern_counts[pattern_type] = pattern_counts.get(pattern_type, 0) + 1
        
        # Create statistics text
        stats_lines = [
            f"Total Clouds: {total_clouds}",
            f"Avg Confidence: {avg_confidence:.2f}",
            ""
        ]
        
        for pattern_type, count in sorted(pattern_counts.items()):
            if pattern_type != 'unknown':
                display_name = pattern_type.replace('_', ' ').title()
                stats_lines.append(f"{display_name}: {count}")
        
        # Draw panel
        panel_height = len(stats_lines) * 18 + 20
        panel_width = 200
        
        # Background
        cv2.rectangle(image, (10, 10), (panel_width, panel_height), (0, 0, 0, 200)[:3], -1)
        cv2.rectangle(image, (10, 10), (panel_width, panel_height), (255, 255, 255), 1)
        
        # Text
        for i, line in enumerate(stats_lines):
            if line:  # Skip empty lines
                cv2.putText(image, line, (20, 30 + i * 18), cv2.FONT_HERSHEY_SIMPLEX, 0.4, (255, 255, 255), 1)
        
        return image
    
    def _get_style_for_cloud(self, cloud: Dict[str, Any]) -> Dict[str, Any]:
        """Get appropriate style for a cloud based on its properties."""
        shape_features = cloud.get('shape_features', {})
        pattern_type = shape_features.get('pattern_type', 'unknown')
        confidence = cloud.get('confidence', 0.0)
        
        # Use pattern-specific style if available
        if pattern_type in self.styles:
            return self.styles[pattern_type]
        
        # Fall back to confidence-based style
        if confidence >= 0.7:
            return self.styles['confidence_high']
        elif confidence >= 0.4:
            return self.styles['confidence_medium']
        else:
            return self.styles['confidence_low']
    
    def _draw_dashed_rectangle(self, image: np.ndarray, pt1: Tuple[int, int], pt2: Tuple[int, int], color: Tuple[int, int, int], thickness: int = 2):
        """Draw a dashed rectangle."""
        x1, y1 = pt1
        x2, y2 = pt2
        
        dash_length = 5
        gap_length = 3
        
        # Top and bottom edges
        for x in range(x1, x2, dash_length + gap_length):
            cv2.line(image, (x, y1), (min(x + dash_length, x2), y1), color, thickness)
            cv2.line(image, (x, y2), (min(x + dash_length, x2), y2), color, thickness)
        
        # Left and right edges
        for y in range(y1, y2, dash_length + gap_length):
            cv2.line(image, (x1, y), (x1, min(y + dash_length, y2)), color, thickness)
            cv2.line(image, (x2, y), (x2, min(y + dash_length, y2)), color, thickness)
    
    def export_overlay_config(self, options: Dict[str, Any]) -> str:
        """Export overlay configuration as JSON."""
        try:
            config = {
                'styles': self.styles,
                'options': options,
                'timestamp': datetime.now().isoformat()
            }
            return json.dumps(config, indent=2)
        except Exception as e:
            logger.error(f"Error exporting overlay config: {e}")
            return "{}"
    
    def import_overlay_config(self, config_json: str) -> bool:
        """Import overlay configuration from JSON."""
        try:
            config = json.loads(config_json)
            if 'styles' in config:
                self.styles.update(config['styles'])
            return True
        except Exception as e:
            logger.error(f"Error importing overlay config: {e}")
            return False
"""
Pattern Recognition Module for ELECTRICAL ORCHESTRATOR
Specialized pattern recognition for electrical drawing cloud conventions
"""

import cv2
import numpy as np
from typing import List, Dict, Any, Tuple, Optional
import logging
import json

logger = logging.getLogger(__name__)

class PatternRecognizer:
    """Pattern recognition for electrical drawing cloud conventions across different CAD systems"""
    
    def __init__(self):
        # Enhanced CAD configurations with cloud area constraints
        self.cad_configurations = {
            'autocad': {
                'min_cloud_area': 200,
                'max_cloud_area': 50000,
                'cloud_bubble_size': (10, 50),
                'bubble_spacing': (5, 20),
                'line_thickness': (1, 4),
                'typical_colors': ['yellow', 'cyan', 'light_blue'],
                'shape_characteristics': {
                    'circularity_range': (0.3, 0.8),
                    'solidity_range': (0.4, 0.9)
                },
                'detection_params': {
                    'edge_low_thresh': 40,
                    'edge_high_thresh': 120,
                    'contour_epsilon': 0.02
                }
            },
            'microstation': {
                'min_cloud_area': 150,
                'max_cloud_area': 45000,
                'cloud_bubble_size': (8, 45),
                'bubble_spacing': (4, 18),
                'line_thickness': (1, 3),
                'typical_colors': ['light_gray', 'cyan', 'yellow'],
                'shape_characteristics': {
                    'circularity_range': (0.4, 0.9),
                    'solidity_range': (0.5, 0.95)
                },
                'detection_params': {
                    'edge_low_thresh': 35,
                    'edge_high_thresh': 100,
                    'contour_epsilon': 0.015
                }
            },
            'solidworks': {
                'min_cloud_area': 300,
                'max_cloud_area': 60000,
                'cloud_bubble_size': (12, 60),
                'bubble_spacing': (6, 25),
                'line_thickness': (2, 5),
                'typical_colors': ['light_green', 'yellow', 'pink'],
                'shape_characteristics': {
                    'circularity_range': (0.5, 0.9),
                    'solidity_range': (0.6, 0.95)
                },
                'detection_params': {
                    'edge_low_thresh': 45,
                    'edge_high_thresh': 130,
                    'contour_epsilon': 0.025
                }
            },
            'generic': {
                'min_cloud_area': 100,
                'max_cloud_area': 50000,
                'cloud_bubble_size': (8, 60),
                'bubble_spacing': (4, 25),
                'line_thickness': (1, 5),
                'typical_colors': ['yellow', 'cyan', 'light_blue', 'light_gray'],
                'shape_characteristics': {
                    'circularity_range': (0.2, 0.9),
                    'solidity_range': (0.3, 0.95)
                },
                'detection_params': {
                    'edge_low_thresh': 35,
                    'edge_high_thresh': 110,
                    'contour_epsilon': 0.02
                }
            }
        }
        
        # CAD system specific patterns (legacy support)
        self.cad_patterns = self.cad_configurations
        
        # Pattern templates for template matching
        self.bubble_templates = self._create_bubble_templates()
        
        # Drawing convention patterns
        self.convention_patterns = {
            'revision_clouds': {
                'characteristics': ['connected_bubbles', 'irregular_boundary', 'annotation_nearby'],
                'typical_size_range': (500, 20000),  # pixels
                'aspect_ratio_range': (0.3, 4.0)
            },
            'highlight_areas': {
                'characteristics': ['solid_fill', 'transparent_overlay', 'regular_shape'],
                'typical_size_range': (200, 15000),
                'aspect_ratio_range': (0.5, 3.0)
            },
            'markup_annotations': {
                'characteristics': ['text_nearby', 'leader_lines', 'geometric_shapes'],
                'typical_size_range': (100, 5000),
                'aspect_ratio_range': (0.2, 5.0)
            }
        }

    def _create_bubble_templates(self) -> Dict[str, List[np.ndarray]]:
        """Create template patterns for different bubble types"""
        templates = {}
        
        # Create bubble templates for different sizes
        sizes = [10, 15, 20, 25, 30, 40]
        
        for size in sizes:
            # Circular bubble template
            template = np.zeros((size*2, size*2), dtype=np.uint8)
            cv2.circle(template, (size, size), size-2, 255, 2)
            
            if 'circular' not in templates:
                templates['circular'] = []
            templates['circular'].append(template)
            
            # Scalloped bubble template (more CAD-like)
            scalloped = self._create_scalloped_bubble(size)
            if 'scalloped' not in templates:
                templates['scalloped'] = []
            templates['scalloped'].append(scalloped)
        
        return templates

    def _create_scalloped_bubble(self, radius: int) -> np.ndarray:
        """Create a scalloped bubble pattern typical in CAD cloud symbols"""
        size = radius * 2
        template = np.zeros((size, size), dtype=np.uint8)
        
        # Number of scallops around the circumference
        num_scallops = max(6, radius // 3)
        
        center = (radius, radius)
        
        # Draw scalloped edge
        for i in range(num_scallops):
            angle1 = (2 * np.pi * i) / num_scallops
            angle2 = (2 * np.pi * (i + 1)) / num_scallops
            
            # Calculate scallop points
            x1 = int(center[0] + (radius - 2) * np.cos(angle1))
            y1 = int(center[1] + (radius - 2) * np.sin(angle1))
            x2 = int(center[0] + (radius - 2) * np.cos(angle2))
            y2 = int(center[1] + (radius - 2) * np.sin(angle2))
            
            # Mid point for scallop curve
            mid_angle = (angle1 + angle2) / 2
            scallop_radius = radius // 4
            x_mid = int(center[0] + radius * np.cos(mid_angle))
            y_mid = int(center[1] + radius * np.sin(mid_angle))
            
            # Draw scallop arc
            cv2.circle(template, (x_mid, y_mid), scallop_radius, 255, 1)
        
        return template

    def detect_patterns(self, image: np.ndarray, cad_system: str = 'generic', sensitivity: float = 0.7) -> List[Dict[str, Any]]:
        """
        Detect cloud patterns based on CAD system conventions.
        
        Args:
            image: Input image as numpy array
            cad_system: Target CAD system ('autocad', 'microstation', 'solidworks', 'generic')
            sensitivity: Detection sensitivity (0.0-1.0)
            
        Returns:
            List of detected patterns with metadata
        """
        patterns = []
        
        # Get CAD-specific configuration
        cad_config = self.cad_configurations.get(cad_system, self.cad_configurations['generic'])
        
        # Convert to grayscale if needed
        if len(image.shape) == 3:
            gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        else:
            gray = image.copy()
            
        # Apply different pattern detection methods
        bubble_patterns = self._detect_bubble_patterns(gray, cad_config, sensitivity)
        revision_patterns = self._detect_revision_clouds(gray, cad_config, sensitivity)
        highlight_patterns = self._detect_highlight_overlays(image, cad_config, sensitivity)
        polygon_patterns = self._detect_polygon_clouds(gray, cad_config, sensitivity)
        freehand_patterns = self._detect_freehand_clouds(gray, cad_config, sensitivity)
        
        patterns.extend(bubble_patterns)
        patterns.extend(revision_patterns) 
        patterns.extend(highlight_patterns)
        patterns.extend(polygon_patterns)
        patterns.extend(freehand_patterns)
        
        # Filter by confidence threshold
        confidence_threshold = 0.3 + (sensitivity * 0.4)  # 0.3-0.7 range
        patterns = [p for p in patterns if p['confidence'] >= confidence_threshold]
        
        # Non-maximum suppression to remove overlapping detections
        patterns = self._apply_nms(patterns, overlap_threshold=0.3)
        
        return patterns
    
    def recognize_cad_patterns(self, image: np.ndarray, cad_system: str = 'generic') -> List[Dict[str, Any]]:
        """Legacy method - calls detect_patterns with default sensitivity"""
        return self.detect_patterns(image, cad_system, sensitivity=0.7)

    def _detect_bubble_patterns(self, gray: np.ndarray, cad_config: Dict[str, Any], sensitivity: float = 0.7) -> List[Dict[str, Any]]:
        """Detect individual bubble patterns that form cloud boundaries"""
        patterns = []
        
        try:
            # Use Hough Circle detection for bubble identification
            min_radius, max_radius = cad_config['cloud_bubble_size']
            
            circles = cv2.HoughCircles(
                gray,
                cv2.HOUGH_GRADIENT,
                dp=1,
                minDist=min_radius,
                param1=50,
                param2=30,
                minRadius=min_radius,
                maxRadius=max_radius
            )
            
            if circles is not None:
                circles = np.round(circles[0, :]).astype("int")
                
                # Group nearby circles into potential cloud patterns
                circle_groups = self._group_nearby_circles(circles, cad_config['bubble_spacing'][1])
                
                for group in circle_groups:
                    if len(group) >= 3:  # Minimum bubbles to form a cloud
                        pattern = {
                            'type': 'bubble_cloud',
                            'bubbles': group,
                            'confidence': min(1.0, len(group) / 10.0),  # More bubbles = higher confidence
                            'bounding_box': self._calculate_group_bbox(group),
                            'characteristics': {
                                'bubble_count': len(group),
                                'avg_bubble_size': np.mean([r for _, _, r in group]),
                                'pattern_density': self._calculate_pattern_density(group)
                            }
                        }
                        patterns.append(pattern)
            
        except Exception as e:
            logger.error(f"Bubble pattern detection error: {e}")
        
        return patterns

    def _detect_revision_clouds(self, gray: np.ndarray, cad_config: Dict[str, Any], sensitivity: float = 0.7) -> List[Dict[str, Any]]:
        """Detect revision cloud patterns (connected bubble boundaries)"""
        patterns = []
        
        try:
            # Apply edge detection to find cloud boundaries
            edges = cv2.Canny(gray, 50, 150)
            
            # Morphological operations to connect edge fragments
            kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))
            edges = cv2.morphologyEx(edges, cv2.MORPH_CLOSE, kernel)
            
            # Find contours
            contours, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
            
            for contour in contours:
                area = cv2.contourArea(contour)
                conv_range = self.convention_patterns['revision_clouds']['typical_size_range']
                
                if conv_range[0] <= area <= conv_range[1]:
                    # Analyze contour for revision cloud characteristics
                    characteristics = self._analyze_revision_cloud_characteristics(contour, gray)
                    
                    if characteristics['is_revision_cloud']:
                        x, y, w, h = cv2.boundingRect(contour)
                        pattern = {
                            'type': 'revision_cloud',
                            'contour': contour.tolist(),
                            'confidence': characteristics['confidence'],
                            'bounding_box': [x, y, w, h],
                            'characteristics': characteristics
                        }
                        patterns.append(pattern)
        
        except Exception as e:
            logger.error(f"Revision cloud detection error: {e}")
        
        return patterns

    def _detect_highlight_overlays(self, image: np.ndarray, cad_config: Dict[str, Any], sensitivity: float = 0.7) -> List[Dict[str, Any]]:
        """Detect highlight overlay patterns (colored fills, transparency)"""
        patterns = []
        
        try:
            # Convert to HSV for better color analysis
            hsv = cv2.cvtColor(image, cv2.COLOR_BGR2HSV)
            
            # Detect colored overlay regions
            for color_name in cad_config['typical_colors']:
                if color_name in ['yellow', 'cyan', 'light_blue', 'light_green', 'pink']:
                    color_patterns = self._detect_color_overlays(hsv, color_name)
                    patterns.extend(color_patterns)
        
        except Exception as e:
            logger.error(f"Highlight overlay detection error: {e}")
        
        return patterns

    def _group_nearby_circles(self, circles: np.ndarray, max_distance: int) -> List[List[Tuple[int, int, int]]]:
        """Group circles that are close together into potential cloud patterns"""
        if len(circles) == 0:
            return []
        
        groups = []
        used = set()
        
        for i, (x1, y1, r1) in enumerate(circles):
            if i in used:
                continue
            
            # Start new group
            group = [(x1, y1, r1)]
            used.add(i)
            
            # Find nearby circles
            for j, (x2, y2, r2) in enumerate(circles[i+1:], i+1):
                if j in used:
                    continue
                
                # Calculate distance between circle centers
                distance = np.sqrt((x2 - x1)**2 + (y2 - y1)**2)
                
                if distance <= max_distance:
                    group.append((x2, y2, r2))
                    used.add(j)
            
            if len(group) >= 2:  # At least 2 circles to form a pattern
                groups.append(group)
        
        return groups

    def _calculate_group_bbox(self, group: List[Tuple[int, int, int]]) -> List[int]:
        """Calculate bounding box for a group of circles"""
        if not group:
            return [0, 0, 0, 0]
        
        x_coords = [x - r for x, y, r in group] + [x + r for x, y, r in group]
        y_coords = [y - r for x, y, r in group] + [y + r for x, y, r in group]
        
        min_x, max_x = min(x_coords), max(x_coords)
        min_y, max_y = min(y_coords), max(y_coords)
        
        return [min_x, min_y, max_x - min_x, max_y - min_y]

    def _calculate_pattern_density(self, group: List[Tuple[int, int, int]]) -> float:
        """Calculate the density of bubbles in a pattern"""
        if len(group) < 2:
            return 0.0
        
        # Calculate average distance between bubbles
        distances = []
        for i, (x1, y1, r1) in enumerate(group):
            for x2, y2, r2 in group[i+1:]:
                distance = np.sqrt((x2 - x1)**2 + (y2 - y1)**2)
                distances.append(distance)
        
        if not distances:
            return 0.0
        
        avg_distance = np.mean(distances)
        avg_radius = np.mean([r for _, _, r in group])
        
        # Density = expected distance / actual distance
        # Higher density when bubbles are closer together
        expected_distance = avg_radius * 2.5  # Reasonable spacing
        density = expected_distance / max(avg_distance, 1.0)
        
        return min(1.0, density)

    def _analyze_revision_cloud_characteristics(self, contour: np.ndarray, gray: np.ndarray) -> Dict[str, Any]:
        """Analyze contour characteristics to determine if it's a revision cloud"""
        
        characteristics = {
            'is_revision_cloud': False,
            'confidence': 0.0,
            'bubble_like_boundary': False,
            'irregular_shape': False,
            'moderate_size': False
        }
        
        try:
            # Calculate basic shape properties
            area = cv2.contourArea(contour)
            perimeter = cv2.arcLength(contour, True)
            hull = cv2.convexHull(contour)
            hull_area = cv2.contourArea(hull)
            
            # Shape metrics
            solidity = area / hull_area if hull_area > 0 else 0
            circularity = 4 * np.pi * area / (perimeter * perimeter) if perimeter > 0 else 0
            
            # Check for irregular shape (typical of revision clouds)
            if 0.3 <= solidity <= 0.8 and 0.1 <= circularity <= 0.6:
                characteristics['irregular_shape'] = True
            
            # Check size range
            size_range = self.convention_patterns['revision_clouds']['typical_size_range']
            if size_range[0] <= area <= size_range[1]:
                characteristics['moderate_size'] = True
            
            # Analyze boundary for bubble-like characteristics
            # Sample points along the contour and check for regular undulations
            if len(contour) > 10:
                boundary_analysis = self._analyze_boundary_undulations(contour)
                characteristics['bubble_like_boundary'] = boundary_analysis['has_regular_undulations']
            
            # Calculate overall confidence
            score = 0.0
            if characteristics['irregular_shape']:
                score += 0.4
            if characteristics['moderate_size']:
                score += 0.3
            if characteristics['bubble_like_boundary']:
                score += 0.3
            
            characteristics['confidence'] = score
            characteristics['is_revision_cloud'] = score >= 0.6
            
        except Exception as e:
            logger.error(f"Error analyzing revision cloud characteristics: {e}")
        
        return characteristics

    def _analyze_boundary_undulations(self, contour: np.ndarray) -> Dict[str, Any]:
        """Analyze contour boundary for bubble-like undulations"""
        
        analysis = {
            'has_regular_undulations': False,
            'undulation_frequency': 0.0,
            'undulation_amplitude': 0.0
        }
        
        try:
            # Sample points along contour
            num_samples = min(100, len(contour))
            indices = np.linspace(0, len(contour) - 1, num_samples, dtype=int)
            sampled_points = contour[indices].reshape((-1, 2))
            
            # Calculate distances from centroid
            centroid = np.mean(sampled_points, axis=0)
            distances = np.sqrt(np.sum((sampled_points - centroid) ** 2, axis=1))
            
            # Analyze distance variations (undulations)
            if len(distances) > 10:
                # Smooth the distance signal
                smoothed = np.convolve(distances, np.ones(5)/5, mode='same')
                
                # Calculate variations from smooth curve
                variations = np.abs(distances - smoothed)
                
                # Check for regular patterns
                mean_variation = np.mean(variations)
                std_variation = np.std(variations)
                
                # Regular undulations should have moderate variation
                if 0.5 <= std_variation / (mean_variation + 1e-6) <= 2.0:
                    analysis['has_regular_undulations'] = True
                    analysis['undulation_amplitude'] = std_variation
                    
                    # Estimate frequency (number of peaks)
                    from scipy.signal import find_peaks
                    peaks, _ = find_peaks(variations, height=mean_variation)
                    analysis['undulation_frequency'] = len(peaks) / len(distances)
        
        except Exception as e:
            logger.error(f"Error analyzing boundary undulations: {e}")
            # Fallback analysis without scipy
            if len(distances) > 10:
                # Simple peak detection without scipy
                mean_dist = np.mean(distances)
                peaks = 0
                for i in range(1, len(distances) - 1):
                    if distances[i] > distances[i-1] and distances[i] > distances[i+1] and distances[i] > mean_dist:
                        peaks += 1
                analysis['undulation_frequency'] = peaks / len(distances)
                analysis['has_regular_undulations'] = peaks >= 3
        
        return analysis

    def _detect_color_overlays(self, hsv: np.ndarray, color_name: str) -> List[Dict[str, Any]]:
        """Detect colored overlay patterns for a specific color"""
        patterns = []
        
        # Define HSV ranges for different colors
        color_ranges = {
            'yellow': ([20, 100, 100], [30, 255, 255]),
            'cyan': ([85, 100, 100], [95, 255, 255]),
            'light_blue': ([100, 50, 50], [130, 255, 255]),
            'light_green': ([40, 50, 50], [80, 255, 255]),
            'pink': ([160, 50, 50], [180, 255, 255])
        }
        
        if color_name not in color_ranges:
            return patterns
        
        try:
            lower, upper = color_ranges[color_name]
            mask = cv2.inRange(hsv, np.array(lower), np.array(upper))
            
            # Clean up mask
            kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
            mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel)
            mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, kernel)
            
            # Find contours
            contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
            
            for contour in contours:
                area = cv2.contourArea(contour)
                size_range = self.convention_patterns['highlight_areas']['typical_size_range']
                
                if size_range[0] <= area <= size_range[1]:
                    x, y, w, h = cv2.boundingRect(contour)
                    
                    pattern = {
                        'type': 'color_overlay',
                        'color': color_name,
                        'contour': contour.tolist(),
                        'confidence': 0.7,  # Color detection is generally reliable
                        'bounding_box': [x, y, w, h],
                        'characteristics': {
                            'area': area,
                            'color_consistency': self._calculate_color_consistency(hsv, contour)
                        }
                    }
                    patterns.append(pattern)
        
        except Exception as e:
            logger.error(f"Color overlay detection error for {color_name}: {e}")
        
        return patterns

    def _calculate_color_consistency(self, hsv: np.ndarray, contour: np.ndarray) -> float:
        """Calculate how consistent the color is within a region"""
        try:
            # Create mask for the contour region
            mask = np.zeros(hsv.shape[:2], dtype=np.uint8)
            cv2.fillPoly(mask, [contour], 255)
            
            # Get HSV values within the region
            region_hsv = hsv[mask > 0]
            
            if len(region_hsv) == 0:
                return 0.0
            
            # Calculate standard deviation for each channel
            h_std = np.std(region_hsv[:, 0])
            s_std = np.std(region_hsv[:, 1])
            v_std = np.std(region_hsv[:, 2])
            
            # Lower standard deviation = higher consistency
            # Normalize to 0-1 scale
            consistency = max(0.0, 1.0 - (h_std + s_std + v_std) / (3 * 50))
            
            return consistency
            
        except Exception as e:
            logger.error(f"Error calculating color consistency: {e}")
            return 0.0
    
    def _detect_polygon_clouds(self, gray: np.ndarray, cad_config: Dict[str, Any], sensitivity: float) -> List[Dict[str, Any]]:
        """
        Detect polygon-shaped cloud patterns with straight edges.
        """
        patterns = []
        
        # Preprocessing for polygon detection
        blur_kernel = 3 if sensitivity > 0.7 else 5
        blurred = cv2.GaussianBlur(gray, (blur_kernel, blur_kernel), 0)
        
        # Edge detection with adaptive thresholds
        base_params = cad_config.get('detection_params', {'edge_low_thresh': 35, 'edge_high_thresh': 110})
        low_threshold = int(base_params['edge_low_thresh'] + (1 - sensitivity) * 30)
        high_threshold = int(base_params['edge_high_thresh'] + (1 - sensitivity) * 80)
        edges = cv2.Canny(blurred, low_threshold, high_threshold)
        
        # Dilate edges to connect nearby lines
        kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (2, 2))
        edges = cv2.dilate(edges, kernel, iterations=1)
        
        # Find contours
        contours, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        
        for contour in contours:
            area = cv2.contourArea(contour)
            min_area = cad_config['min_cloud_area'] * (0.4 if sensitivity > 0.8 else 1.0)
            max_area = cad_config['max_cloud_area'] * (1.3 if sensitivity > 0.8 else 1.0)
            
            if area < min_area or area > max_area:
                continue
                
            # Approximate contour to polygon
            perimeter = cv2.arcLength(contour, True)
            if perimeter == 0:
                continue
                
            epsilon = cad_config.get('detection_params', {}).get('contour_epsilon', 0.02) * perimeter
            approx = cv2.approxPolyDP(contour, epsilon, True)
            
            # Check for polygon characteristics
            num_vertices = len(approx)
            if 3 <= num_vertices <= 12:  # Reasonable polygon range
                # Calculate polygon quality metrics
                hull = cv2.convexHull(contour)
                hull_area = cv2.contourArea(hull)
                convexity = area / hull_area if hull_area > 0 else 0
                
                # Check for straight edges by analyzing line segments
                straight_edge_score = self._analyze_straight_edges(approx)
                
                # Size appropriateness
                size_score = min(area / (cad_config['max_cloud_area'] * 0.2), 1.0)
                
                # Polygon confidence calculation
                vertex_score = 1.0 - abs(num_vertices - 6) / 10.0  # Prefer 4-8 vertices
                confidence = (convexity * 0.3 + straight_edge_score * 0.4 + 
                            size_score * 0.2 + vertex_score * 0.1) * sensitivity
                
                if confidence > 0.3:  # Minimum threshold
                    patterns.append({
                        'type': 'polygon_cloud',
                        'confidence': min(confidence, 1.0),
                        'bbox': cv2.boundingRect(contour),
                        'contour': contour,
                        'properties': {
                            'area': area,
                            'num_vertices': num_vertices,
                            'convexity': convexity,
                            'straight_edge_score': straight_edge_score,
                            'perimeter': perimeter
                        }
                    })
        
        return patterns
    
    def _detect_freehand_clouds(self, gray: np.ndarray, cad_config: Dict[str, Any], sensitivity: float) -> List[Dict[str, Any]]:
        """
        Detect freehand-drawn cloud patterns with irregular boundaries.
        """
        patterns = []
        
        # Preprocessing optimized for freehand detection
        # Use bilateral filter to preserve edges while smoothing
        filtered = cv2.bilateralFilter(gray, 7, 50, 50)
        
        # Multi-scale edge detection for different line thicknesses
        edges1 = cv2.Canny(filtered, 30, 90)  # Thin lines
        edges2 = cv2.Canny(filtered, 50, 150)  # Medium lines
        
        # Combine edge maps
        edges = cv2.bitwise_or(edges1, edges2)
        
        # Morphological operations to connect broken curves
        kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))
        edges = cv2.morphologyEx(edges, cv2.MORPH_CLOSE, kernel)
        
        # Find contours
        contours, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        
        for contour in contours:
            area = cv2.contourArea(contour)
            min_area = cad_config['min_cloud_area'] * (0.3 if sensitivity > 0.8 else 1.0)
            max_area = cad_config['max_cloud_area'] * (1.5 if sensitivity > 0.8 else 1.0)
            
            if area < min_area or area > max_area:
                continue
                
            perimeter = cv2.arcLength(contour, True)
            if perimeter == 0:
                continue
                
            # Analyze curve characteristics for freehand detection
            curve_analysis = self._analyze_curve_characteristics(contour)
            
            # Check for freehand indicators
            if curve_analysis['is_freehand']:
                # Calculate confidence based on freehand characteristics
                irregularity_score = curve_analysis['irregularity']
                smoothness_score = curve_analysis['smoothness']
                organic_score = curve_analysis['organic_shape']
                
                # Size appropriateness
                size_score = min(area / (cad_config['max_cloud_area'] * 0.2), 1.0)
                
                # Combined confidence
                confidence = (irregularity_score * 0.3 + smoothness_score * 0.3 + 
                            organic_score * 0.3 + size_score * 0.1) * sensitivity
                
                patterns.append({
                    'type': 'freehand_cloud',
                    'confidence': min(confidence, 1.0),
                    'bbox': cv2.boundingRect(contour),
                    'contour': contour,
                    'properties': {
                        'area': area,
                        'perimeter': perimeter,
                        'irregularity': irregularity_score,
                        'smoothness': smoothness_score,
                        'organic_shape': organic_score,
                        'curve_complexity': curve_analysis['complexity']
                    }
                })
        
        return patterns
    
    def _analyze_straight_edges(self, approx_contour: np.ndarray) -> float:
        """
        Analyze how straight the edges of a polygon are.
        """
        if len(approx_contour) < 3:
            return 0.0
            
        straight_scores = []
        
        for i in range(len(approx_contour)):
            p1 = approx_contour[i][0]
            p2 = approx_contour[(i + 1) % len(approx_contour)][0]
            
            # Calculate edge length
            edge_length = np.linalg.norm(p2 - p1)
            
            if edge_length > 10:  # Only analyze significant edges
                # For now, assume edges are reasonably straight in approximated polygon
                straight_scores.append(0.8)
        
        return np.mean(straight_scores) if straight_scores else 0.0
    
    def _analyze_curve_characteristics(self, contour: np.ndarray) -> Dict[str, Any]:
        """
        Analyze curve characteristics to determine if it's freehand-drawn.
        """
        if len(contour) < 5:
            return {'is_freehand': False, 'irregularity': 0, 'smoothness': 0, 'organic_shape': 0, 'complexity': 0}
        
        # Calculate curvature variations along the contour
        curvatures = []
        for i in range(2, len(contour) - 2):
            p1 = contour[i - 2][0]
            p2 = contour[i][0]
            p3 = contour[i + 2][0]
            
            # Calculate angle change (simplified curvature)
            v1 = p2 - p1
            v2 = p3 - p2
            
            if np.linalg.norm(v1) > 0 and np.linalg.norm(v2) > 0:
                cos_angle = np.dot(v1, v2) / (np.linalg.norm(v1) * np.linalg.norm(v2))
                cos_angle = np.clip(cos_angle, -1, 1)
                angle = np.arccos(cos_angle)
                curvatures.append(angle)
        
        if not curvatures:
            return {'is_freehand': False, 'irregularity': 0, 'smoothness': 0, 'organic_shape': 0, 'complexity': 0}
        
        # Analyze curvature characteristics
        curvature_std = np.std(curvatures)
        curvature_mean = np.mean(curvatures)
        
        # Irregularity: high variation in curvature indicates freehand
        irregularity = min(curvature_std / 0.5, 1.0)
        
        # Smoothness: continuous curves vs sharp corners
        smoothness = 1.0 - min(curvature_mean / np.pi, 1.0)
        
        # Organic shape: overall shape complexity
        perimeter = cv2.arcLength(contour, True)
        area = cv2.contourArea(contour)
        
        if area > 0:
            compactness = (perimeter * perimeter) / area
            organic_shape = min((compactness - 12.57) / 20.0, 1.0)  # 12.57 is circle compactness
            organic_shape = max(organic_shape, 0.0)
        else:
            organic_shape = 0.0
        
        # Overall complexity
        complexity = len(contour) / perimeter if perimeter > 0 else 0
        
        # Determine if this looks like freehand drawing
        is_freehand = (irregularity > 0.3 and smoothness > 0.2) or organic_shape > 0.4
        
        return {
            'is_freehand': is_freehand,
            'irregularity': irregularity,
            'smoothness': smoothness,
            'organic_shape': organic_shape,
            'complexity': complexity
        }
    
    def _apply_nms(self, patterns: List[Dict[str, Any]], overlap_threshold: float = 0.3) -> List[Dict[str, Any]]:
        """
        Apply non-maximum suppression to remove overlapping detections.
        """
        if not patterns:
            return patterns
        
        # Sort by confidence (descending)
        patterns = sorted(patterns, key=lambda x: x['confidence'], reverse=True)
        
        # Calculate IoU for all pairs and suppress overlaps
        keep = []
        
        for i, pattern in enumerate(patterns):
            should_keep = True
            bbox1 = pattern.get('bbox', [0, 0, 0, 0])
            
            for kept_pattern in keep:
                bbox2 = kept_pattern.get('bbox', [0, 0, 0, 0])
                iou = self._calculate_iou(bbox1, bbox2)
                
                if iou > overlap_threshold:
                    should_keep = False
                    break
            
            if should_keep:
                keep.append(pattern)
        
        return keep
    
    def _calculate_iou(self, bbox1: List[int], bbox2: List[int]) -> float:
        """
        Calculate Intersection over Union (IoU) for two bounding boxes.
        """
        if len(bbox1) != 4 or len(bbox2) != 4:
            return 0.0
        
        x1, y1, w1, h1 = bbox1
        x2, y2, w2, h2 = bbox2
        
        # Calculate intersection
        x_left = max(x1, x2)
        y_top = max(y1, y2)
        x_right = min(x1 + w1, x2 + w2)
        y_bottom = min(y1 + h1, y2 + h2)
        
        if x_right < x_left or y_bottom < y_top:
            return 0.0
        
        intersection_area = (x_right - x_left) * (y_bottom - y_top)
        
        # Calculate union
        bbox1_area = w1 * h1
        bbox2_area = w2 * h2
        union_area = bbox1_area + bbox2_area - intersection_area
        
        if union_area == 0:
            return 0.0
        
        return intersection_area / union_area
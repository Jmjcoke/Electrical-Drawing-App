"""
Cloud Detection Engine for ELECTRICAL ORCHESTRATOR
Advanced computer vision algorithms for detecting clouded areas in electrical drawings
"""

import cv2
import numpy as np
from typing import List, Dict, Any, Tuple, Optional
import logging
from datetime import datetime
import uuid
from dataclasses import dataclass
from .pattern_recognizer import PatternRecognizer

logger = logging.getLogger(__name__)

@dataclass
class CloudCandidate:
    """Temporary cloud candidate during detection"""
    contour: np.ndarray
    bbox: Tuple[int, int, int, int]  # x, y, w, h
    area: float
    confidence: float
    detection_method: str
    center: Tuple[float, float]
    shape_features: Dict[str, Any]

class CloudDetector:
    """Advanced cloud detection using multiple computer vision techniques"""
    
    def __init__(self):
        # Initialize pattern recognizer for enhanced detection
        self.pattern_recognizer = PatternRecognizer()
        
        # Color detection parameters
        self.color_params = {
            'cloud_colors': {
                # Common cloud colors in electrical drawings
                'yellow': ([20, 100, 100], [30, 255, 255]),  # HSV ranges
                'cyan': ([85, 100, 100], [95, 255, 255]),
                'light_blue': ([100, 50, 50], [130, 255, 255]),
                'light_gray': ([0, 0, 180], [180, 30, 230]),
                'light_green': ([40, 50, 50], [80, 255, 255]),
                'pink': ([160, 50, 50], [180, 255, 255]),
            },
            'transparency_threshold': 0.3,
            'saturation_threshold': 100,
            'brightness_range': (50, 200)
        }
        
        # Shape detection parameters
        self.shape_params = {
            'min_contour_area': 100,
            'max_contour_area': 50000,
            'aspect_ratio_range': (0.2, 5.0),
            'solidity_threshold': 0.3,  # Ratio of contour area to convex hull area
            'extent_threshold': 0.2,    # Ratio of contour area to bounding rectangle area
            'circularity_threshold': 0.1
        }
        
        # Texture detection parameters
        self.texture_params = {
            'lbp_radius': 3,
            'lbp_n_points': 24,
            'glcm_distances': [1, 2, 3],
            'glcm_angles': [0, 45, 90, 135],
            'gabor_frequencies': [0.1, 0.3, 0.5],
            'gabor_orientations': [0, 45, 90, 135]
        }

    def detect_by_color(self, image: np.ndarray, sensitivity: float = 0.7) -> List['CloudArea']:
        """Detect clouds based on color characteristics"""
        try:
            clouds = []
            
            # Convert to different color spaces for analysis
            hsv = cv2.cvtColor(image, cv2.COLOR_BGR2HSV)
            lab = cv2.cvtColor(image, cv2.COLOR_BGR2LAB)
            gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
            
            # Create combined mask for all cloud colors
            combined_mask = np.zeros(gray.shape, dtype=np.uint8)
            
            for color_name, (lower, upper) in self.color_params['cloud_colors'].items():
                # Create mask for this color range
                lower_bound = np.array(lower)
                upper_bound = np.array(upper)
                
                # Adjust bounds based on sensitivity
                sensitivity_factor = (sensitivity - 0.5) * 0.4  # -0.2 to +0.2
                lower_bound = np.clip(lower_bound + sensitivity_factor * 50, 0, 255).astype(np.uint8)
                upper_bound = np.clip(upper_bound - sensitivity_factor * 50, 0, 255).astype(np.uint8)
                
                mask = cv2.inRange(hsv, lower_bound, upper_bound)
                combined_mask = cv2.bitwise_or(combined_mask, mask)
            
            # Detect transparency/light areas
            transparency_mask = self._detect_transparency(image, gray, sensitivity)
            combined_mask = cv2.bitwise_or(combined_mask, transparency_mask)
            
            # Clean up mask with morphological operations
            kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
            combined_mask = cv2.morphologyEx(combined_mask, cv2.MORPH_CLOSE, kernel)
            combined_mask = cv2.morphologyEx(combined_mask, cv2.MORPH_OPEN, kernel)
            
            # Find contours
            contours, _ = cv2.findContours(combined_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
            
            for contour in contours:
                candidate = self._analyze_contour(contour, "color", sensitivity)
                if candidate and self._validate_cloud_candidate(candidate):
                    cloud = self._candidate_to_cloud_area(candidate)
                    clouds.append(cloud)
            
            logger.debug(f"Color detection found {len(clouds)} clouds")
            return clouds
            
        except Exception as e:
            logger.error(f"Color detection error: {e}")
            return []

    def detect_by_shape(self, image: np.ndarray, sensitivity: float = 0.7) -> List['CloudArea']:
        """Detect clouds based on shape characteristics"""
        try:
            clouds = []
            
            # Convert to grayscale
            gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
            
            # Apply Gaussian blur to reduce noise
            blurred = cv2.GaussianBlur(gray, (5, 5), 0)
            
            # Edge detection with adaptive thresholding
            edges = cv2.Canny(blurred, 50, 150)
            
            # Adjust edge detection based on sensitivity
            if sensitivity < 0.5:
                # More conservative edge detection
                edges = cv2.Canny(blurred, 100, 200)
            elif sensitivity > 0.7:
                # More aggressive edge detection
                edges = cv2.Canny(blurred, 30, 100)
            
            # Morphological operations to connect edge fragments
            kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))
            edges = cv2.morphologyEx(edges, cv2.MORPH_CLOSE, kernel)
            
            # Find contours
            contours, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
            
            for contour in contours:
                candidate = self._analyze_contour(contour, "shape", sensitivity)
                if candidate and self._validate_cloud_candidate(candidate):
                    # Additional shape-specific validation
                    if self._is_cloud_like_shape(candidate):
                        cloud = self._candidate_to_cloud_area(candidate)
                        clouds.append(cloud)
            
            logger.debug(f"Shape detection found {len(clouds)} clouds")
            return clouds
            
        except Exception as e:
            logger.error(f"Shape detection error: {e}")
            return []

    def detect_by_texture(self, image: np.ndarray, sensitivity: float = 0.7) -> List['CloudArea']:
        """Detect clouds based on texture analysis"""
        try:
            clouds = []
            
            # Convert to grayscale
            gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
            
            # Apply texture filters
            texture_response = self._analyze_texture_features(gray, sensitivity)
            
            # Threshold texture response
            threshold = np.percentile(texture_response, 85 + (sensitivity - 0.5) * 20)
            texture_mask = (texture_response > threshold).astype(np.uint8) * 255
            
            # Clean up texture mask
            kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (7, 7))
            texture_mask = cv2.morphologyEx(texture_mask, cv2.MORPH_CLOSE, kernel)
            texture_mask = cv2.morphologyEx(texture_mask, cv2.MORPH_OPEN, kernel)
            
            # Find contours
            contours, _ = cv2.findContours(texture_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
            
            for contour in contours:
                candidate = self._analyze_contour(contour, "texture", sensitivity)
                if candidate and self._validate_cloud_candidate(candidate):
                    cloud = self._candidate_to_cloud_area(candidate)
                    clouds.append(cloud)
            
            logger.debug(f"Texture detection found {len(clouds)} clouds")
            return clouds
            
        except Exception as e:
            logger.error(f"Texture detection error: {e}")
            return []

    def _detect_transparency(self, image: np.ndarray, gray: np.ndarray, sensitivity: float) -> np.ndarray:
        """Detect transparent/light areas that might indicate clouds"""
        
        # Detect very light areas
        light_threshold = 200 - (sensitivity - 0.5) * 50
        light_mask = (gray > light_threshold).astype(np.uint8) * 255
        
        # Detect low contrast areas (potential transparency)
        kernel = np.ones((9, 9), np.float32) / 81
        smoothed = cv2.filter2D(gray, -1, kernel)
        contrast = cv2.absdiff(gray, smoothed.astype(np.uint8))
        
        contrast_threshold = 20 + (sensitivity - 0.5) * 20
        low_contrast_mask = (contrast < contrast_threshold).astype(np.uint8) * 255
        
        # Combine masks
        transparency_mask = cv2.bitwise_and(light_mask, low_contrast_mask)
        
        return transparency_mask

    def _analyze_texture_features(self, gray: np.ndarray, sensitivity: float) -> np.ndarray:
        """Analyze texture features to identify cloud-like patterns"""
        
        # Initialize texture response
        texture_response = np.zeros_like(gray, dtype=np.float32)
        
        # Local Binary Pattern (LBP) analysis
        try:
            lbp = self._compute_lbp(gray, self.texture_params['lbp_radius'], 
                                  self.texture_params['lbp_n_points'])
            
            # Compute LBP variance (texture measure)
            kernel_size = 15
            kernel = np.ones((kernel_size, kernel_size), np.float32) / (kernel_size * kernel_size)
            lbp_mean = cv2.filter2D(lbp.astype(np.float32), -1, kernel)
            lbp_var = cv2.filter2D((lbp.astype(np.float32) - lbp_mean) ** 2, -1, kernel)
            
            texture_response += lbp_var * 0.3
            
        except Exception as e:
            logger.warning(f"LBP computation failed: {e}")
        
        # Gabor filter responses
        try:
            for freq in self.texture_params['gabor_frequencies']:
                for angle in self.texture_params['gabor_orientations']:
                    gabor_real, _ = cv2.getGaborKernel((21, 21), 5, np.radians(angle), 
                                                     2 * np.pi * freq, 0.5, 0, ktype=cv2.CV_32F)
                    gabor_response = cv2.filter2D(gray, cv2.CV_8UC3, gabor_real)
                    texture_response += np.abs(gabor_response.astype(np.float32)) * 0.1
        
        except Exception as e:
            logger.warning(f"Gabor filter computation failed: {e}")
        
        # Edge density analysis
        try:
            edges = cv2.Canny(gray, 50, 150)
            kernel = np.ones((15, 15), np.float32) / 225
            edge_density = cv2.filter2D(edges.astype(np.float32), -1, kernel)
            
            # Cloud areas typically have low edge density
            texture_response += (255 - edge_density) * 0.2
            
        except Exception as e:
            logger.warning(f"Edge density computation failed: {e}")
        
        return texture_response

    def _compute_lbp(self, image: np.ndarray, radius: int, n_points: int) -> np.ndarray:
        """Compute Local Binary Pattern"""
        height, width = image.shape
        lbp = np.zeros((height, width), dtype=np.uint8)
        
        # Calculate offsets for neighboring pixels
        angles = 2 * np.pi * np.arange(n_points) / n_points
        offsets = [(int(round(radius * np.cos(angle))), int(round(radius * np.sin(angle)))) 
                  for angle in angles]
        
        for y in range(radius, height - radius):
            for x in range(radius, width - radius):
                center_pixel = image[y, x]
                binary_string = ""
                
                for dy, dx in offsets:
                    neighbor_pixel = image[y + dy, x + dx]
                    binary_string += '1' if neighbor_pixel >= center_pixel else '0'
                
                lbp[y, x] = int(binary_string, 2)
        
        return lbp

    def _analyze_contour(self, contour: np.ndarray, method: str, sensitivity: float) -> Optional[CloudCandidate]:
        """Analyze a contour to determine if it's a cloud candidate"""
        try:
            # Calculate basic properties
            area = cv2.contourArea(contour)
            if area < self.shape_params['min_contour_area']:
                return None
            
            # Bounding rectangle
            x, y, w, h = cv2.boundingRect(contour)
            
            # Calculate shape features
            perimeter = cv2.arcLength(contour, True)
            hull = cv2.convexHull(contour)
            hull_area = cv2.contourArea(hull)
            
            # Shape metrics
            aspect_ratio = w / h if h > 0 else 0
            solidity = area / hull_area if hull_area > 0 else 0
            extent = area / (w * h) if (w * h) > 0 else 0
            
            # Circularity (4π * area / perimeter²)
            circularity = 4 * np.pi * area / (perimeter * perimeter) if perimeter > 0 else 0
            
            # Calculate confidence based on method and features
            confidence = self._calculate_confidence(
                method, area, aspect_ratio, solidity, extent, circularity, sensitivity
            )
            
            if confidence < 0.3:  # Minimum confidence threshold
                return None
            
            # Calculate center
            M = cv2.moments(contour)
            if M["m00"] != 0:
                center_x = M["m10"] / M["m00"]
                center_y = M["m01"] / M["m00"]
            else:
                center_x, center_y = x + w/2, y + h/2
            
            return CloudCandidate(
                contour=contour,
                bbox=(x, y, w, h),
                area=area,
                confidence=confidence,
                detection_method=method,
                center=(center_x, center_y),
                shape_features={
                    'aspect_ratio': aspect_ratio,
                    'solidity': solidity,
                    'extent': extent,
                    'circularity': circularity,
                    'perimeter': perimeter
                }
            )
            
        except Exception as e:
            logger.error(f"Error analyzing contour: {e}")
            return None

    def _calculate_confidence(self, method: str, area: float, aspect_ratio: float, 
                            solidity: float, extent: float, circularity: float, 
                            sensitivity: float) -> float:
        """Calculate confidence score for cloud detection"""
        
        base_confidence = 0.5
        
        # Area-based confidence
        if 500 <= area <= 10000:  # Optimal area range
            area_conf = 0.3
        elif 100 <= area <= 25000:  # Acceptable range
            area_conf = 0.2
        else:
            area_conf = 0.1
        
        # Shape-based confidence
        shape_conf = 0.0
        
        # Clouds often have irregular shapes (low circularity)
        if 0.1 <= circularity <= 0.6:
            shape_conf += 0.15
        
        # Moderate solidity (not too convex)
        if 0.3 <= solidity <= 0.8:
            shape_conf += 0.1
        
        # Reasonable aspect ratio
        if 0.3 <= aspect_ratio <= 3.0:
            shape_conf += 0.1
        
        # Method-specific adjustments
        method_conf = 0.0
        if method == "color":
            method_conf = 0.2  # Color detection is quite reliable
        elif method == "shape":
            method_conf = 0.15  # Shape detection is moderately reliable
        elif method == "texture":
            method_conf = 0.1   # Texture detection is less reliable but valuable
        
        # Sensitivity adjustment
        sensitivity_adj = (sensitivity - 0.5) * 0.2
        
        total_confidence = min(1.0, base_confidence + area_conf + shape_conf + method_conf + sensitivity_adj)
        return max(0.0, total_confidence)

    def _validate_cloud_candidate(self, candidate: CloudCandidate) -> bool:
        """Validate if a candidate is likely to be a cloud"""
        
        # Area constraints
        if not (self.shape_params['min_contour_area'] <= candidate.area <= self.shape_params['max_contour_area']):
            return False
        
        # Aspect ratio constraints
        aspect_ratio = candidate.shape_features['aspect_ratio']
        if not (self.shape_params['aspect_ratio_range'][0] <= aspect_ratio <= self.shape_params['aspect_ratio_range'][1]):
            return False
        
        # Minimum confidence
        if candidate.confidence < 0.3:
            return False
        
        return True

    def _is_cloud_like_shape(self, candidate: CloudCandidate) -> bool:
        """Additional validation for cloud-like shapes"""
        
        features = candidate.shape_features
        
        # Clouds are typically irregular (low circularity)
        if features['circularity'] > 0.8:
            return False
        
        # Clouds should have moderate solidity (not perfect convex shapes)
        if features['solidity'] > 0.95:
            return False
        
        # Very thin or very thick shapes are unlikely to be clouds
        if features['aspect_ratio'] < 0.1 or features['aspect_ratio'] > 10:
            return False
        
        return True

    def _candidate_to_cloud_area(self, candidate: CloudCandidate) -> 'CloudArea':
        """Convert CloudCandidate to CloudArea"""
        from .main import CloudArea  # Import here to avoid circular import
        
        x, y, w, h = candidate.bbox
        
        # Determine shape type based on features
        shape_type = self._classify_shape_type(candidate.shape_features)
        
        return CloudArea(
            id=str(uuid.uuid4()),
            page_number=1,  # Will be set by caller
            bbox=[float(x), float(y), float(w), float(h)],
            confidence_score=candidate.confidence,
            detection_method=candidate.detection_method,
            area_pixels=int(candidate.area),
            center_point=[candidate.center[0], candidate.center[1]],
            shape_type=shape_type,
            is_manual=False,
            created_at=datetime.utcnow().isoformat(),
            metadata={
                'shape_features': candidate.shape_features,
                'detection_timestamp': datetime.utcnow().isoformat()
            }
        )

    def _classify_shape_type(self, features: Dict[str, Any]) -> str:
        """Classify the type of shape based on features"""
        
        circularity = features['circularity']
        aspect_ratio = features['aspect_ratio']
        solidity = features['solidity']
        
        if circularity > 0.7:
            return "circular"
        elif 0.8 <= aspect_ratio <= 1.2 and solidity > 0.8:
            return "rectangular"
        elif aspect_ratio > 2.0 or aspect_ratio < 0.5:
            return "elongated"
        elif solidity < 0.6:
            return "irregular"
        else:
            return "freeform"
    
    def detect_clouds(self, image: np.ndarray, sensitivity: float = 0.7, cad_system: str = 'generic') -> List[Dict[str, Any]]:
        """
        Main cloud detection method combining pattern recognition with traditional detection.
        
        Args:
            image: Input image as numpy array
            sensitivity: Detection sensitivity (0.0-1.0)
            cad_system: Target CAD system for optimized detection
            
        Returns:
            List of detected cloud areas with metadata
        """
        try:
            start_time = datetime.now()
            
            # Validate inputs
            if image is None or image.size == 0:
                logger.warning("Invalid input image for cloud detection")
                return []
            
            # Store original image for reference
            original_image = image.copy()
            
            # Use enhanced pattern recognition as primary detection method
            pattern_clouds = self.pattern_recognizer.detect_patterns(image, cad_system, sensitivity)
            
            # Convert pattern detection results to CloudCandidate format
            pattern_candidates = self._convert_patterns_to_candidates(pattern_clouds)
            
            # Combine with traditional detection methods for comprehensive coverage
            color_clouds = self.detect_by_color(image, sensitivity)
            shape_clouds = self.detect_by_shape(image, sensitivity)
            texture_clouds = self.detect_by_texture(image, sensitivity)
            
            # Merge all detection results
            all_candidates = pattern_candidates + color_clouds + shape_clouds + texture_clouds
            merged_clouds = self._merge_overlapping_detections(all_candidates)
            
            # Filter by confidence threshold
            min_confidence = 0.3 * sensitivity  # Adjust threshold based on sensitivity
            filtered_clouds = [cloud for cloud in merged_clouds if cloud.confidence >= min_confidence]
            
            # Convert to output format
            result_clouds = []
            for cloud in filtered_clouds:
                cloud_area = {
                    'id': str(uuid.uuid4()),
                    'bbox': cloud.bbox,
                    'area': cloud.area,
                    'confidence': cloud.confidence,
                    'detection_method': cloud.detection_method,
                    'center': cloud.center,
                    'contour': cloud.contour.tolist() if cloud.contour is not None else [],
                    'shape_features': cloud.shape_features,
                    'timestamp': start_time.isoformat()
                }
                result_clouds.append(cloud_area)
            
            processing_time = (datetime.now() - start_time).total_seconds()
            logger.info(f"Enhanced cloud detection completed in {processing_time:.2f}s - Found {len(result_clouds)} clouds")
            
            return result_clouds
            
        except Exception as e:
            logger.error(f"Cloud detection error: {e}")
            return []
    
    def _convert_patterns_to_candidates(self, patterns: List[Dict[str, Any]]) -> List[CloudCandidate]:
        """
        Convert pattern recognition results to CloudCandidate format.
        """
        candidates = []
        
        for pattern in patterns:
            try:
                # Extract pattern data
                bbox = pattern.get('bbox', [0, 0, 0, 0])
                confidence = pattern.get('confidence', 0.0)
                pattern_type = pattern.get('type', 'unknown')
                contour = pattern.get('contour', None)
                properties = pattern.get('properties', {})
                
                # Convert contour if available
                if contour is not None:
                    if isinstance(contour, list):
                        contour = np.array(contour)
                    elif not isinstance(contour, np.ndarray):
                        contour = None
                
                # Calculate area and center
                area = properties.get('area', bbox[2] * bbox[3] if len(bbox) >= 4 else 0)
                center_x = bbox[0] + bbox[2] / 2 if len(bbox) >= 4 else 0
                center_y = bbox[1] + bbox[3] / 2 if len(bbox) >= 4 else 0
                
                # Create enhanced shape features
                shape_features = {
                    'pattern_type': pattern_type,
                    'original_properties': properties,
                    'detection_source': 'pattern_recognition',
                    'circularity': properties.get('circularity', 0.0),
                    'aspect_ratio': properties.get('width', 1.0) / max(properties.get('height', 1.0), 1.0) if 'width' in properties and 'height' in properties else 1.0,
                    'solidity': properties.get('solidity', 0.0),
                    'compactness': properties.get('compactness', 0.0)
                }
                
                # Add type-specific features
                if pattern_type == 'revision_cloud':
                    shape_features.update({
                        'scallop_ratio': properties.get('scallop_ratio', 0),
                        'hull_area': properties.get('hull_area', 0)
                    })
                elif pattern_type == 'polygon_cloud':
                    shape_features.update({
                        'num_vertices': properties.get('num_vertices', 0),
                        'convexity': properties.get('convexity', 0),
                        'straight_edge_score': properties.get('straight_edge_score', 0)
                    })
                elif pattern_type == 'freehand_cloud':
                    shape_features.update({
                        'irregularity': properties.get('irregularity', 0),
                        'smoothness': properties.get('smoothness', 0),
                        'organic_shape': properties.get('organic_shape', 0)
                    })
                elif pattern_type == 'highlight_overlay':
                    shape_features.update({
                        'color_name': properties.get('color_name', 'unknown'),
                        'coverage': properties.get('coverage', 0),
                        'color_consistency': properties.get('color_consistency', 0)
                    })
                
                candidate = CloudCandidate(
                    contour=contour,
                    bbox=tuple(bbox[:4]) if len(bbox) >= 4 else (0, 0, 0, 0),
                    area=area,
                    confidence=confidence,
                    detection_method=f'pattern_{pattern_type}',
                    center=(center_x, center_y),
                    shape_features=shape_features
                )
                
                candidates.append(candidate)
                
            except Exception as e:
                logger.warning(f"Error converting pattern to candidate: {e}")
                continue
        
        return candidates
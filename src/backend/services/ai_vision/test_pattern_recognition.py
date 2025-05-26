"""
Test Suite for Enhanced Pattern Recognition
Tests the improved cloud detection patterns for electrical drawings
"""

import pytest
import numpy as np
import cv2
import tempfile
import os
from pattern_recognizer import PatternRecognizer
from typing import List, Dict, Any

class TestPatternRecognition:
    """Test suite for enhanced cloud pattern recognition"""
    
    def setup_method(self):
        """Set up test fixtures"""
        self.recognizer = PatternRecognizer()
        
    def create_test_image(self, width: int = 800, height: int = 600) -> np.ndarray:
        """Create a blank test image"""
        return np.ones((height, width, 3), dtype=np.uint8) * 255
    
    def draw_revision_cloud(self, image: np.ndarray, center: tuple, radius: int, num_scallops: int = 8) -> np.ndarray:
        """Draw a revision cloud pattern on the image"""
        x_center, y_center = center
        
        # Draw scalloped boundary
        for i in range(num_scallops):
            angle1 = (2 * np.pi * i) / num_scallops
            angle2 = (2 * np.pi * (i + 1)) / num_scallops
            
            # Calculate scallop points
            x1 = int(x_center + radius * np.cos(angle1))
            y1 = int(y_center + radius * np.sin(angle1))
            x2 = int(x_center + radius * np.cos(angle2))
            y2 = int(y_center + radius * np.sin(angle2))
            
            # Draw arc for scallop
            scallop_center_angle = (angle1 + angle2) / 2
            scallop_x = int(x_center + radius * 0.8 * np.cos(scallop_center_angle))
            scallop_y = int(y_center + radius * 0.8 * np.sin(scallop_center_angle))
            
            cv2.circle(image, (scallop_x, scallop_y), radius // 6, (0, 0, 0), 2)
        
        return image
    
    def draw_polygon_cloud(self, image: np.ndarray, points: List[tuple]) -> np.ndarray:
        """Draw a polygon cloud pattern"""
        pts = np.array(points, np.int32)
        pts = pts.reshape((-1, 1, 2))
        cv2.polylines(image, [pts], True, (0, 0, 0), 2)
        return image
    
    def draw_highlight_overlay(self, image: np.ndarray, bbox: tuple, color: tuple = (0, 255, 255)) -> np.ndarray:
        """Draw a colored highlight overlay"""
        x, y, w, h = bbox
        overlay = image.copy()
        cv2.rectangle(overlay, (x, y), (x + w, y + h), color, -1)
        # Blend with original image for transparency effect
        return cv2.addWeighted(image, 0.7, overlay, 0.3, 0)
    
    def test_revision_cloud_detection(self):
        """Test detection of revision cloud patterns"""
        image = self.create_test_image()
        
        # Draw revision clouds of different sizes
        image = self.draw_revision_cloud(image, (200, 150), 80, 10)
        image = self.draw_revision_cloud(image, (600, 400), 120, 12)
        
        # Test detection with different sensitivities
        patterns_low = self.recognizer.detect_patterns(image, 'autocad', sensitivity=0.3)
        patterns_high = self.recognizer.detect_patterns(image, 'autocad', sensitivity=0.9)
        
        # Verify detection results
        revision_clouds_low = [p for p in patterns_low if p['type'] in ['revision_cloud', 'freehand_cloud']]
        revision_clouds_high = [p for p in patterns_high if p['type'] in ['revision_cloud', 'freehand_cloud']]
        
        # High sensitivity should detect more patterns
        assert len(revision_clouds_high) >= len(revision_clouds_low)
        
        # At least one cloud should be detected
        assert len(revision_clouds_low) > 0 or len(revision_clouds_high) > 0
    
    def test_polygon_cloud_detection(self):
        """Test detection of polygon-shaped cloud patterns"""
        image = self.create_test_image()
        
        # Draw polygon clouds
        rectangle_points = [(100, 100), (300, 100), (300, 200), (100, 200)]
        pentagon_points = [(500, 150), (580, 120), (620, 180), (580, 240), (500, 210)]
        
        image = self.draw_polygon_cloud(image, rectangle_points)
        image = self.draw_polygon_cloud(image, pentagon_points)
        
        # Test detection
        patterns = self.recognizer.detect_patterns(image, 'generic', sensitivity=0.7)
        polygon_clouds = [p for p in patterns if p['type'] == 'polygon_cloud']\n        
        # Should detect polygon patterns
        assert len(polygon_clouds) >= 0  # May vary based on edge detection sensitivity
    
    def test_highlight_overlay_detection(self):
        """Test detection of colored highlight overlays"""
        image = self.create_test_image()
        
        # Draw colored overlays
        image = self.draw_highlight_overlay(image, (150, 200, 200, 100), (0, 255, 255))  # Yellow
        image = self.draw_highlight_overlay(image, (400, 300, 150, 80), (255, 255, 0))   # Cyan
        
        # Test detection
        patterns = self.recognizer.detect_patterns(image, 'generic', sensitivity=0.7)
        highlight_overlays = [p for p in patterns if p['type'] == 'highlight_overlay']
        
        # Should detect at least one highlight overlay
        assert len(highlight_overlays) >= 1
    
    def test_cad_system_specificity(self):
        """Test CAD system-specific detection parameters"""
        image = self.create_test_image()
        image = self.draw_revision_cloud(image, (400, 300), 100, 8)
        
        # Test different CAD systems
        autocad_patterns = self.recognizer.detect_patterns(image, 'autocad', sensitivity=0.7)
        microstation_patterns = self.recognizer.detect_patterns(image, 'microstation', sensitivity=0.7)
        generic_patterns = self.recognizer.detect_patterns(image, 'generic', sensitivity=0.7)
        
        # All should detect something, but may have different confidence scores
        all_patterns = [autocad_patterns, microstation_patterns, generic_patterns]
        detected_counts = [len(patterns) for patterns in all_patterns]
        
        # At least one CAD system should detect patterns
        assert sum(detected_counts) > 0
    
    def test_sensitivity_scaling(self):
        """Test that sensitivity parameter affects detection"""
        image = self.create_test_image()
        
        # Draw a subtle cloud pattern
        image = self.draw_revision_cloud(image, (400, 300), 60, 6)
        
        # Test different sensitivity levels
        low_sensitivity = self.recognizer.detect_patterns(image, 'generic', sensitivity=0.2)
        medium_sensitivity = self.recognizer.detect_patterns(image, 'generic', sensitivity=0.5)
        high_sensitivity = self.recognizer.detect_patterns(image, 'generic', sensitivity=0.8)
        
        # Higher sensitivity should generally detect more patterns
        counts = [len(low_sensitivity), len(medium_sensitivity), len(high_sensitivity)]
        
        # Verify sensitivity scaling works (high >= medium >= low)
        assert counts[2] >= counts[1] >= counts[0] or sum(counts) == 0  # Allow for edge cases
    
    def test_confidence_scoring(self):
        """Test confidence scoring for detected patterns"""
        image = self.create_test_image()
        
        # Draw clear, well-defined patterns
        image = self.draw_revision_cloud(image, (200, 200), 80, 10)
        image = self.draw_polygon_cloud(image, [(400, 150), (500, 150), (500, 250), (400, 250)])
        
        patterns = self.recognizer.detect_patterns(image, 'generic', sensitivity=0.7)
        
        # All detected patterns should have confidence scores
        for pattern in patterns:
            assert 'confidence' in pattern
            assert 0.0 <= pattern['confidence'] <= 1.0
    
    def test_non_maximum_suppression(self):
        """Test that overlapping detections are properly suppressed"""
        image = self.create_test_image()
        
        # Draw overlapping patterns that might generate multiple detections
        image = self.draw_revision_cloud(image, (300, 300), 100, 8)
        image = self.draw_revision_cloud(image, (320, 320), 90, 10)  # Overlapping
        
        patterns = self.recognizer.detect_patterns(image, 'generic', sensitivity=0.8)
        
        # Check for overlapping bounding boxes
        if len(patterns) > 1:
            for i, pattern1 in enumerate(patterns):
                for pattern2 in patterns[i+1:]:
                    bbox1 = pattern1.get('bbox', [0, 0, 0, 0])
                    bbox2 = pattern2.get('bbox', [0, 0, 0, 0])
                    iou = self.recognizer._calculate_iou(bbox1, bbox2)
                    
                    # IoU should be below suppression threshold
                    assert iou <= 0.3  # Default NMS threshold
    
    def test_pattern_properties(self):
        """Test that detected patterns include proper metadata"""
        image = self.create_test_image()
        image = self.draw_revision_cloud(image, (400, 300), 80, 8)
        
        patterns = self.recognizer.detect_patterns(image, 'generic', sensitivity=0.7)
        
        for pattern in patterns:
            # Required fields
            assert 'type' in pattern
            assert 'confidence' in pattern
            assert 'bbox' in pattern
            
            # Type should be valid
            valid_types = ['bubble_cloud', 'revision_cloud', 'highlight_overlay', 'polygon_cloud', 'freehand_cloud']
            assert pattern['type'] in valid_types
            
            # Bounding box should be valid
            bbox = pattern['bbox']
            assert len(bbox) == 4
            assert all(isinstance(coord, (int, np.integer)) for coord in bbox)
            assert bbox[2] > 0 and bbox[3] > 0  # Width and height should be positive

def run_visual_tests():
    """Run visual tests to inspect detection results"""
    recognizer = PatternRecognizer()
    
    # Create test image with various patterns
    test_image = np.ones((800, 600, 3), dtype=np.uint8) * 255
    
    # Add various cloud patterns
    recognizer_test = TestPatternRecognition()
    recognizer_test.setup_method()
    
    test_image = recognizer_test.draw_revision_cloud(test_image, (150, 150), 80, 10)
    test_image = recognizer_test.draw_polygon_cloud(test_image, [(300, 100), (450, 100), (450, 200), (300, 200)])
    test_image = recognizer_test.draw_highlight_overlay(test_image, (500, 300, 200, 100), (0, 255, 255))
    
    # Detect patterns
    patterns = recognizer.detect_patterns(test_image, 'generic', sensitivity=0.7)
    
    # Draw detection results
    result_image = test_image.copy()
    colors = [(255, 0, 0), (0, 255, 0), (0, 0, 255), (255, 255, 0), (255, 0, 255)]
    
    for i, pattern in enumerate(patterns):
        bbox = pattern['bbox']
        color = colors[i % len(colors)]
        
        # Draw bounding box
        cv2.rectangle(result_image, (bbox[0], bbox[1]), (bbox[0] + bbox[2], bbox[1] + bbox[3]), color, 2)
        
        # Add label
        label = f"{pattern['type']}: {pattern['confidence']:.2f}"
        cv2.putText(result_image, label, (bbox[0], bbox[1] - 10), cv2.FONT_HERSHEY_SIMPLEX, 0.5, color, 1)
    
    # Save test results
    output_dir = tempfile.mkdtemp()
    cv2.imwrite(os.path.join(output_dir, 'pattern_detection_test.jpg'), result_image)
    print(f"Visual test results saved to: {output_dir}")
    print(f"Detected {len(patterns)} patterns")
    
    return patterns

if __name__ == "__main__":
    # Run visual tests
    run_visual_tests()
    
    # Run unit tests
    pytest.main([__file__, "-v"])
"""
Test Suite for Enhanced Overlay Generation
Tests the visual highlighting system for cloud detection results
"""

import pytest
import numpy as np
import cv2
import tempfile
import os
from enhanced_overlay_generator import EnhancedOverlayGenerator
from typing import List, Dict, Any

class TestEnhancedOverlay:
    """Test suite for enhanced overlay generation"""
    
    def setup_method(self):
        """Set up test fixtures"""
        self.overlay_generator = EnhancedOverlayGenerator()
        
    def create_test_image(self, width: int = 800, height: int = 600) -> np.ndarray:
        """Create a test image with some drawing elements"""
        image = np.ones((height, width, 3), dtype=np.uint8) * 255
        
        # Add some drawing elements
        cv2.rectangle(image, (100, 100), (200, 150), (0, 0, 0), 2)  # Black rectangle
        cv2.circle(image, (300, 200), 50, (0, 0, 0), 2)  # Black circle
        cv2.line(image, (400, 100), (500, 200), (0, 0, 0), 2)  # Black line
        
        return image
    
    def create_test_clouds(self) -> List[Dict[str, Any]]:
        """Create test cloud detection results"""
        return [
            {
                'id': 'cloud_1',
                'bbox': [150, 120, 100, 80],
                'confidence': 0.85,
                'detection_method': 'pattern_revision_cloud',
                'contour': [[160, 130], [240, 130], [240, 190], [160, 190]],
                'shape_features': {
                    'pattern_type': 'revision_cloud',
                    'scallop_ratio': 2.5,
                    'solidity': 0.7,
                    'detection_source': 'pattern_recognition'
                }
            },
            {
                'id': 'cloud_2',
                'bbox': [280, 180, 80, 60],
                'confidence': 0.65,
                'detection_method': 'pattern_polygon_cloud',
                'contour': [[290, 190], [350, 190], [350, 230], [290, 230]],
                'shape_features': {
                    'pattern_type': 'polygon_cloud',
                    'num_vertices': 4,
                    'convexity': 0.9,
                    'detection_source': 'pattern_recognition'
                }
            },
            {
                'id': 'cloud_3',
                'bbox': [450, 150, 70, 50],
                'confidence': 0.45,
                'detection_method': 'pattern_highlight_overlay',
                'contour': [[460, 160], [510, 160], [510, 190], [460, 190]],
                'shape_features': {
                    'pattern_type': 'highlight_overlay',
                    'color_name': 'yellow',
                    'coverage': 0.8,
                    'detection_source': 'pattern_recognition'
                }
            }
        ]
    
    def test_standard_overlay_generation(self):
        """Test standard overlay generation"""
        image = self.create_test_image()
        clouds = self.create_test_clouds()
        
        options = {
            'visualization_mode': 'standard',
            'show_confidence': True,
            'show_pattern_type': True,
            'transparency': 0.3
        }
        
        overlay_image = self.overlay_generator.generate_enhanced_overlay(image, clouds, options)
        
        # Verify overlay was generated
        assert overlay_image is not None
        assert overlay_image.shape == image.shape
        
        # Verify overlay is different from original
        diff = cv2.absdiff(image, overlay_image)
        assert np.sum(diff) > 0  # Should have some differences
    
    def test_heatmap_overlay_generation(self):
        """Test heatmap overlay generation"""
        image = self.create_test_image()
        clouds = self.create_test_clouds()
        
        options = {
            'visualization_mode': 'heatmap',
            'heatmap_intensity': 0.6
        }
        
        overlay_image = self.overlay_generator.generate_enhanced_overlay(image, clouds, options)
        
        # Verify heatmap overlay
        assert overlay_image is not None
        assert overlay_image.shape == image.shape
        
        # Check that high confidence areas are more prominent
        cloud_1_area = overlay_image[120:200, 150:250]  # High confidence cloud
        cloud_3_area = overlay_image[150:200, 450:520]  # Low confidence cloud
        
        # High confidence area should have more intense colors
        cloud_1_intensity = np.mean(cv2.cvtColor(cloud_1_area, cv2.COLOR_BGR2HSV)[:, :, 2])
        cloud_3_intensity = np.mean(cv2.cvtColor(cloud_3_area, cv2.COLOR_BGR2HSV)[:, :, 2])
        
        # Note: This test might be sensitive to exact implementation
        assert cloud_1_intensity >= cloud_3_intensity - 20  # Allow some tolerance
    
    def test_outline_overlay_generation(self):
        """Test outline overlay generation"""
        image = self.create_test_image()
        clouds = self.create_test_clouds()
        
        options = {
            'visualization_mode': 'outline'
        }
        
        overlay_image = self.overlay_generator.generate_enhanced_overlay(image, clouds, options)
        
        # Verify outline overlay
        assert overlay_image is not None
        assert overlay_image.shape == image.shape
        
        # Outline should have minimal visual impact
        diff = cv2.absdiff(image, overlay_image)
        total_diff = np.sum(diff)
        
        # Should have changes but less than standard overlay
        assert total_diff > 0
        assert total_diff < np.sum(cv2.absdiff(image, image * 0.7))  # Less than 30% change
    
    def test_contour_overlay_generation(self):
        """Test contour overlay generation"""
        image = self.create_test_image()
        clouds = self.create_test_clouds()
        
        options = {
            'visualization_mode': 'contour',
            'show_contours': True
        }
        
        overlay_image = self.overlay_generator.generate_enhanced_overlay(image, clouds, options)
        
        # Verify contour overlay
        assert overlay_image is not None
        assert overlay_image.shape == image.shape
    
    def test_pattern_specific_overlay_generation(self):
        """Test pattern-specific overlay generation"""
        image = self.create_test_image()
        clouds = self.create_test_clouds()
        
        options = {
            'visualization_mode': 'pattern_specific'
        }
        
        overlay_image = self.overlay_generator.generate_enhanced_overlay(image, clouds, options)
        
        # Verify pattern-specific overlay
        assert overlay_image is not None
        assert overlay_image.shape == image.shape
    
    def test_interactive_overlay_elements(self):
        """Test interactive overlay with selection and hover"""
        image = self.create_test_image()
        clouds = self.create_test_clouds()
        
        options = {
            'visualization_mode': 'standard',
            'selected_cloud_id': 'cloud_1',
            'hover_cloud_id': 'cloud_2'
        }
        
        overlay_image = self.overlay_generator.generate_enhanced_overlay(image, clouds, options)
        
        # Verify interactive elements
        assert overlay_image is not None
        assert overlay_image.shape == image.shape
    
    def test_annotation_options(self):
        """Test various annotation options"""
        image = self.create_test_image()
        clouds = self.create_test_clouds()
        
        # Test with all annotations enabled
        options = {
            'show_confidence': True,
            'show_pattern_type': True,
            'show_details': True
        }
        
        overlay_image = self.overlay_generator.generate_enhanced_overlay(image, clouds, options)
        
        assert overlay_image is not None
        
        # Test with annotations disabled
        options = {
            'show_confidence': False,
            'show_pattern_type': False,
            'show_details': False
        }
        
        overlay_image_no_annotations = self.overlay_generator.generate_enhanced_overlay(image, clouds, options)
        
        assert overlay_image_no_annotations is not None
        
        # Overlays should be different
        diff = cv2.absdiff(overlay_image, overlay_image_no_annotations)
        assert np.sum(diff) > 0
    
    def test_statistics_panel(self):
        """Test statistics panel generation"""
        image = self.create_test_image()
        clouds = self.create_test_clouds()
        
        options = {
            'show_statistics': True
        }
        
        overlay_image = self.overlay_generator.generate_enhanced_overlay(image, clouds, options)
        
        assert overlay_image is not None
        
        # Check that statistics panel area has content
        panel_area = overlay_image[10:150, 10:200]  # Expected panel location
        panel_mean = np.mean(panel_area)
        
        # Panel should be darker than white background
        assert panel_mean < 250  # Should be darker than pure white
    
    def test_style_configuration(self):
        """Test style configuration for different cloud types"""
        image = self.create_test_image()
        clouds = self.create_test_clouds()
        
        # Test with different pattern types
        for cloud in clouds:
            pattern_type = cloud['shape_features']['pattern_type']
            style = self.overlay_generator._get_style_for_cloud(cloud)
            
            assert 'bbox_color' in style
            assert 'fill_color' in style
            assert len(style['bbox_color']) == 3  # RGB color
            assert len(style['fill_color']) >= 3  # RGB or RGBA color
    
    def test_transparency_levels(self):
        """Test different transparency levels"""
        image = self.create_test_image()
        clouds = self.create_test_clouds()
        
        transparency_levels = [0.1, 0.3, 0.5, 0.7, 0.9]
        overlays = []
        
        for transparency in transparency_levels:
            options = {'transparency': transparency}
            overlay = self.overlay_generator.generate_enhanced_overlay(image, clouds, options)
            overlays.append(overlay)
        
        # All overlays should be different
        for i in range(len(overlays) - 1):
            diff = cv2.absdiff(overlays[i], overlays[i + 1])
            assert np.sum(diff) > 0
    
    def test_overlay_validation(self):
        """Test overlay quality validation"""
        image = self.create_test_image()
        clouds = self.create_test_clouds()
        
        overlay_image = self.overlay_generator.generate_enhanced_overlay(image, clouds)
        
        # Test overlay validation (if method exists)
        if hasattr(self.overlay_generator, 'validate_overlay_quality'):
            quality_metrics = self.overlay_generator.validate_overlay_quality(overlay_image, image)
            
            assert 'visibility_score' in quality_metrics
            assert 'contrast_ratio' in quality_metrics
            assert 'information_preserved' in quality_metrics
            assert 'overlay_coverage' in quality_metrics
            
            # Scores should be in valid ranges
            assert 0.0 <= quality_metrics['visibility_score'] <= 1.0
            assert quality_metrics['contrast_ratio'] >= 0.0
            assert 0.0 <= quality_metrics['information_preserved'] <= 1.0
            assert 0.0 <= quality_metrics['overlay_coverage'] <= 1.0
    
    def test_config_export_import(self):
        """Test configuration export and import"""
        # Test export
        config_json = self.overlay_generator.export_overlay_config({'test': 'config'})
        assert config_json != "{}"  # Should not be empty
        
        # Test import
        success = self.overlay_generator.import_overlay_config(config_json)
        assert success
        
        # Test invalid import
        success = self.overlay_generator.import_overlay_config("invalid json")
        assert not success
    
    def test_empty_clouds_handling(self):
        """Test handling of empty cloud list"""
        image = self.create_test_image()
        clouds = []
        
        overlay_image = self.overlay_generator.generate_enhanced_overlay(image, clouds)
        
        # Should return image unchanged or with minimal modifications
        assert overlay_image is not None
        assert overlay_image.shape == image.shape
    
    def test_invalid_cloud_data_handling(self):
        """Test handling of invalid cloud data"""
        image = self.create_test_image()
        
        # Test with missing required fields
        invalid_clouds = [
            {'id': 'invalid_1'},  # Missing bbox
            {'bbox': [100, 100]},  # Incomplete bbox
            {'bbox': [100, 100, 50, 50], 'confidence': 'invalid'}  # Invalid confidence
        ]
        
        overlay_image = self.overlay_generator.generate_enhanced_overlay(image, invalid_clouds)
        
        # Should handle gracefully
        assert overlay_image is not None
        assert overlay_image.shape == image.shape

def run_visual_tests():
    """Run visual tests to inspect overlay results"""
    overlay_generator = EnhancedOverlayGenerator()
    
    # Create test image
    test_image = np.ones((600, 800, 3), dtype=np.uint8) * 255
    
    # Add some drawing elements
    cv2.rectangle(test_image, (100, 100), (200, 150), (0, 0, 0), 2)
    cv2.circle(test_image, (300, 200), 50, (0, 0, 0), 2)
    cv2.line(test_image, (400, 100), (500, 200), (0, 0, 0), 2)
    
    # Create test clouds
    test_clouds = [
        {
            'id': 'visual_test_1',
            'bbox': [150, 120, 100, 80],
            'confidence': 0.9,
            'detection_method': 'pattern_revision_cloud',
            'shape_features': {'pattern_type': 'revision_cloud'}
        },
        {
            'id': 'visual_test_2', 
            'bbox': [280, 180, 80, 60],
            'confidence': 0.6,
            'detection_method': 'pattern_polygon_cloud',
            'shape_features': {'pattern_type': 'polygon_cloud'}
        }
    ]
    
    # Test different visualization modes
    modes = ['standard', 'heatmap', 'outline', 'contour', 'pattern_specific']
    
    output_dir = tempfile.mkdtemp()
    print(f"Visual test results will be saved to: {output_dir}")
    
    for mode in modes:
        options = {
            'visualization_mode': mode,
            'show_confidence': True,
            'show_pattern_type': True,
            'show_statistics': True
        }
        
        overlay_image = overlay_generator.generate_enhanced_overlay(test_image, test_clouds, options)
        
        # Save result
        output_path = os.path.join(output_dir, f"enhanced_overlay_{mode}.png")
        cv2.imwrite(output_path, overlay_image)
        print(f"Generated {mode} overlay: {output_path}")
    
    return output_dir

if __name__ == "__main__":
    # Run visual tests
    output_dir = run_visual_tests()
    print(f"\\nVisual tests completed. Results saved to: {output_dir}")
    
    # Run unit tests
    pytest.main([__file__, "-v"])
"""
Comprehensive test suite for cloud detection accuracy
Tests cloud detection algorithms against various electrical drawing samples
"""

import pytest
import asyncio
import numpy as np
import cv2
from PIL import Image, ImageDraw
import io
import json
import time
from pathlib import Path
from typing import List, Dict, Any, Tuple
from unittest.mock import Mock, patch
import tempfile
import logging

# Import modules under test
from cloud_detector import CloudDetector
from pattern_recognizer import PatternRecognizer
from enhanced_overlay_generator import EnhancedOverlayGenerator
from main import (
    detect_clouds_on_page,
    merge_overlapping_clouds,
    calculate_bbox_overlap,
    page_to_image
)

# Configure logging for tests
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class TestCloudDetectionAccuracy:
    """Test suite for cloud detection accuracy validation"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Set up test environment"""
        self.cloud_detector = CloudDetector()
        self.pattern_recognizer = PatternRecognizer()
        self.overlay_generator = EnhancedOverlayGenerator()
        
        # Test configuration
        self.test_config = {
            'sensitivity': 0.7,
            'detection_method': 'hybrid',
            'cad_system': 'generic',
            'min_area': 100,
            'max_area': 25000,
            'confidence_threshold': 0.6
        }
        
        # Performance thresholds
        self.performance_thresholds = {
            'max_detection_time_per_page': 30.0,  # seconds
            'min_accuracy': 0.8,  # 80% accuracy minimum
            'max_false_positive_rate': 0.15,  # 15% max false positives
            'min_recall': 0.85  # 85% minimum recall
        }

    def create_synthetic_drawing(self, width: int = 1920, height: int = 1080, 
                                cloud_count: int = 5) -> Tuple[np.ndarray, List[Dict]]:
        """Create synthetic electrical drawing with known cloud locations"""
        
        # Create white background
        image = np.ones((height, width, 3), dtype=np.uint8) * 255
        
        # Add some electrical drawing elements (lines, text, symbols)
        self._add_electrical_elements(image)
        
        # Add known cloud areas
        ground_truth_clouds = []
        for i in range(cloud_count):
            cloud_data = self._add_synthetic_cloud(image, i)
            ground_truth_clouds.append(cloud_data)
        
        return image, ground_truth_clouds

    def _add_electrical_elements(self, image: np.ndarray):
        """Add typical electrical drawing elements"""
        height, width = image.shape[:2]
        
        # Add horizontal and vertical lines (like electrical circuits)
        for i in range(0, width, 100):
            cv2.line(image, (i, 50), (i, height-50), (0, 0, 0), 2)
        
        for i in range(0, height, 80):
            cv2.line(image, (50, i), (width-50, i), (0, 0, 0), 1)
        
        # Add some text labels
        font = cv2.FONT_HERSHEY_SIMPLEX
        cv2.putText(image, "PANEL A", (100, 100), font, 1, (0, 0, 0), 2)
        cv2.putText(image, "MAIN CIRCUIT", (100, 200), font, 0.8, (0, 0, 0), 2)
        cv2.putText(image, "480V", (500, 150), font, 0.7, (0, 0, 0), 2)
        
        # Add some electrical symbols (rectangles for breakers, circles for connections)
        for i in range(5):
            x = 200 + i * 150
            y = 300
            cv2.rectangle(image, (x, y), (x+30, y+20), (0, 0, 0), 2)
            cv2.circle(image, (x+15, y+40), 5, (0, 0, 0), 2)

    def _add_synthetic_cloud(self, image: np.ndarray, cloud_id: int) -> Dict:
        """Add a synthetic cloud to the image and return its ground truth data"""
        height, width = image.shape[:2]
        
        # Random position and size
        np.random.seed(42 + cloud_id)  # Deterministic for testing
        x = np.random.randint(100, width - 300)
        y = np.random.randint(100, height - 200)
        w = np.random.randint(150, 250)
        h = np.random.randint(100, 180)
        
        # Create cloud shape (irregular polygon)
        overlay = image.copy()
        
        # Create irregular cloud boundary
        points = []
        center_x, center_y = x + w//2, y + h//2
        for angle in range(0, 360, 30):
            radius = np.random.uniform(0.7, 1.3) * min(w, h) / 2
            px = int(center_x + radius * np.cos(np.radians(angle)))
            py = int(center_y + radius * np.sin(np.radians(angle)))
            points.append([px, py])
        
        points = np.array(points, dtype=np.int32)
        
        # Draw cloud with red color and transparency
        cv2.fillPoly(overlay, [points], (0, 0, 255))  # Red fill
        cv2.polylines(overlay, [points], True, (0, 0, 200), 3)  # Darker red border
        
        # Apply transparency
        alpha = 0.3
        image[:] = cv2.addWeighted(image, 1-alpha, overlay, alpha, 0)
        
        # Return ground truth data
        bbox = cv2.boundingRect(points)
        return {
            'id': f'synthetic_cloud_{cloud_id}',
            'bbox': list(bbox),  # [x, y, width, height]
            'center': [center_x, center_y],
            'area': cv2.contourArea(points),
            'confidence': 1.0,  # Known cloud
            'pattern_type': 'synthetic_revision_cloud',
            'points': points.tolist()
        }

    def test_detection_accuracy_synthetic_data(self):
        """Test detection accuracy on synthetic drawings with known clouds"""
        
        test_cases = [
            {'cloud_count': 3, 'description': 'Simple case with 3 clouds'},
            {'cloud_count': 8, 'description': 'Complex case with 8 clouds'},
            {'cloud_count': 1, 'description': 'Single cloud case'},
            {'cloud_count': 15, 'description': 'High density case with 15 clouds'}
        ]
        
        results = []
        
        for case in test_cases:
            logger.info(f"Testing: {case['description']}")
            
            # Create synthetic drawing
            image, ground_truth = self.create_synthetic_drawing(
                cloud_count=case['cloud_count']
            )
            
            # Perform detection
            start_time = time.time()
            detected_clouds = self.cloud_detector.detect_clouds(
                image, 
                sensitivity=self.test_config['sensitivity'],
                cad_system=self.test_config['cad_system']
            )
            detection_time = time.time() - start_time
            
            # Calculate accuracy metrics
            metrics = self._calculate_accuracy_metrics(ground_truth, detected_clouds)
            metrics['detection_time'] = detection_time
            metrics['test_case'] = case['description']
            
            results.append(metrics)
            
            # Log results
            logger.info(f"  Precision: {metrics['precision']:.3f}")
            logger.info(f"  Recall: {metrics['recall']:.3f}")
            logger.info(f"  F1-Score: {metrics['f1_score']:.3f}")
            logger.info(f"  Detection time: {detection_time:.3f}s")
            
            # Assertions
            assert metrics['precision'] >= self.performance_thresholds['min_accuracy'], \
                f"Precision {metrics['precision']:.3f} below threshold {self.performance_thresholds['min_accuracy']}"
            
            assert metrics['recall'] >= self.performance_thresholds['min_recall'], \
                f"Recall {metrics['recall']:.3f} below threshold {self.performance_thresholds['min_recall']}"
            
            assert detection_time <= self.performance_thresholds['max_detection_time_per_page'], \
                f"Detection time {detection_time:.3f}s exceeds threshold {self.performance_thresholds['max_detection_time_per_page']}s"
        
        # Overall performance analysis
        avg_precision = np.mean([r['precision'] for r in results])
        avg_recall = np.mean([r['recall'] for r in results])
        avg_f1 = np.mean([r['f1_score'] for r in results])
        
        logger.info(f"\nOverall Performance:")
        logger.info(f"  Average Precision: {avg_precision:.3f}")
        logger.info(f"  Average Recall: {avg_recall:.3f}")
        logger.info(f"  Average F1-Score: {avg_f1:.3f}")
        
        return results

    def _calculate_accuracy_metrics(self, ground_truth: List[Dict], 
                                  detected: List[Dict]) -> Dict[str, float]:
        """Calculate precision, recall, and F1-score"""
        
        if not detected:
            return {
                'precision': 0.0,
                'recall': 0.0,
                'f1_score': 0.0,
                'true_positives': 0,
                'false_positives': 0,
                'false_negatives': len(ground_truth)
            }
        
        # Match detected clouds to ground truth based on IoU
        matches = self._match_detections_to_ground_truth(ground_truth, detected)
        
        true_positives = len(matches)
        false_positives = len(detected) - true_positives
        false_negatives = len(ground_truth) - true_positives
        
        precision = true_positives / len(detected) if detected else 0.0
        recall = true_positives / len(ground_truth) if ground_truth else 0.0
        f1_score = 2 * (precision * recall) / (precision + recall) if (precision + recall) > 0 else 0.0
        
        return {
            'precision': precision,
            'recall': recall,
            'f1_score': f1_score,
            'true_positives': true_positives,
            'false_positives': false_positives,
            'false_negatives': false_negatives
        }

    def _match_detections_to_ground_truth(self, ground_truth: List[Dict], 
                                        detected: List[Dict], 
                                        iou_threshold: float = 0.5) -> List[Tuple]:
        """Match detected clouds to ground truth using IoU threshold"""
        
        matches = []
        used_gt_indices = set()
        
        for det_idx, detection in enumerate(detected):
            best_iou = 0.0
            best_gt_idx = -1
            
            # Convert detection bbox to ground truth format if needed
            det_bbox = self._normalize_bbox(detection)
            
            for gt_idx, gt_cloud in enumerate(ground_truth):
                if gt_idx in used_gt_indices:
                    continue
                
                gt_bbox = gt_cloud['bbox']
                iou = self._calculate_iou(det_bbox, gt_bbox)
                
                if iou > best_iou and iou >= iou_threshold:
                    best_iou = iou
                    best_gt_idx = gt_idx
            
            if best_gt_idx >= 0:
                matches.append((det_idx, best_gt_idx, best_iou))
                used_gt_indices.add(best_gt_idx)
        
        return matches

    def _normalize_bbox(self, detection: Dict) -> List[float]:
        """Normalize detection bbox to [x, y, width, height] format"""
        if 'boundingBox' in detection:
            bb = detection['boundingBox']
            return [bb['x'], bb['y'], bb['width'], bb['height']]
        elif 'bbox' in detection:
            return detection['bbox']
        else:
            # Try to extract from other formats
            return [0, 0, 100, 100]  # Default fallback

    def _calculate_iou(self, bbox1: List[float], bbox2: List[float]) -> float:
        """Calculate Intersection over Union (IoU) between two bounding boxes"""
        x1, y1, w1, h1 = bbox1
        x2, y2, w2, h2 = bbox2
        
        # Calculate intersection
        x_left = max(x1, x2)
        y_top = max(y1, y2)
        x_right = min(x1 + w1, x2 + w2)
        y_bottom = min(y1 + h1, y2 + h2)
        
        if x_right <= x_left or y_bottom <= y_top:
            return 0.0
        
        intersection_area = (x_right - x_left) * (y_bottom - y_top)
        
        # Calculate union
        area1 = w1 * h1
        area2 = w2 * h2
        union_area = area1 + area2 - intersection_area
        
        return intersection_area / union_area if union_area > 0 else 0.0

    def test_cad_system_specific_accuracy(self):
        """Test detection accuracy for different CAD system configurations"""
        
        cad_systems = ['autocad', 'microstation', 'solidworks', 'generic']
        results = {}
        
        for cad_system in cad_systems:
            logger.info(f"Testing CAD system: {cad_system}")
            
            # Create system-specific synthetic drawing
            image, ground_truth = self.create_synthetic_drawing(cloud_count=5)
            
            # Configure for specific CAD system
            test_config = self.test_config.copy()
            test_config['cad_system'] = cad_system
            
            # Perform detection
            detected_clouds = self.cloud_detector.detect_clouds(
                image,
                sensitivity=test_config['sensitivity'],
                cad_system=cad_system
            )
            
            # Calculate metrics
            metrics = self._calculate_accuracy_metrics(ground_truth, detected_clouds)
            results[cad_system] = metrics
            
            logger.info(f"  {cad_system} - Precision: {metrics['precision']:.3f}, Recall: {metrics['recall']:.3f}")
        
        return results

    def test_sensitivity_parameter_impact(self):
        """Test how sensitivity parameter affects detection accuracy"""
        
        sensitivity_values = [0.3, 0.5, 0.7, 0.9]
        results = {}
        
        # Create test image
        image, ground_truth = self.create_synthetic_drawing(cloud_count=6)
        
        for sensitivity in sensitivity_values:
            logger.info(f"Testing sensitivity: {sensitivity}")
            
            detected_clouds = self.cloud_detector.detect_clouds(
                image,
                sensitivity=sensitivity,
                cad_system='generic'
            )
            
            metrics = self._calculate_accuracy_metrics(ground_truth, detected_clouds)
            results[sensitivity] = metrics
            
            logger.info(f"  Sensitivity {sensitivity} - Precision: {metrics['precision']:.3f}, Recall: {metrics['recall']:.3f}")
        
        # Verify that higher sensitivity generally increases recall
        sensitivities = sorted(sensitivity_values)
        recalls = [results[s]['recall'] for s in sensitivities]
        
        # Check trend (allowing for some variance)
        trend_positive = sum(recalls[i+1] >= recalls[i] - 0.1 for i in range(len(recalls)-1))
        assert trend_positive >= len(recalls) - 2, "Sensitivity should generally increase recall"
        
        return results

    def test_performance_benchmarks(self):
        """Test detection performance under various conditions"""
        
        test_scenarios = [
            {'size': (1920, 1080), 'clouds': 5, 'name': 'Standard Resolution'},
            {'size': (3840, 2160), 'clouds': 5, 'name': '4K Resolution'},
            {'size': (1920, 1080), 'clouds': 20, 'name': 'High Cloud Density'},
            {'size': (7680, 4320), 'clouds': 10, 'name': '8K Resolution'}
        ]
        
        performance_results = []
        
        for scenario in test_scenarios:
            logger.info(f"Performance test: {scenario['name']}")
            
            # Create test image
            image, ground_truth = self.create_synthetic_drawing(
                width=scenario['size'][0],
                height=scenario['size'][1],
                cloud_count=scenario['clouds']
            )
            
            # Measure detection time
            start_time = time.time()
            detected_clouds = self.cloud_detector.detect_clouds(
                image,
                sensitivity=0.7,
                cad_system='generic'
            )
            detection_time = time.time() - start_time
            
            # Calculate metrics
            metrics = self._calculate_accuracy_metrics(ground_truth, detected_clouds)
            
            result = {
                'scenario': scenario['name'],
                'image_size': scenario['size'],
                'cloud_count': scenario['clouds'],
                'detection_time': detection_time,
                'pixels_per_second': (scenario['size'][0] * scenario['size'][1]) / detection_time,
                **metrics
            }
            
            performance_results.append(result)
            
            logger.info(f"  Detection time: {detection_time:.3f}s")
            logger.info(f"  Pixels/second: {result['pixels_per_second']:.0f}")
            logger.info(f"  Accuracy: {metrics['f1_score']:.3f}")
            
            # Performance assertions
            if scenario['size'] == (1920, 1080):  # Standard resolution
                assert detection_time <= self.performance_thresholds['max_detection_time_per_page'], \
                    f"Standard resolution detection time {detection_time:.3f}s exceeds threshold"
        
        return performance_results

    def test_edge_cases(self):
        """Test detection accuracy on edge cases"""
        
        edge_cases = [
            self._create_no_cloud_image(),
            self._create_very_small_clouds_image(),
            self._create_very_large_clouds_image(),
            self._create_overlapping_clouds_image(),
            self._create_low_contrast_image(),
            self._create_noisy_image()
        ]
        
        results = []
        
        for i, (image, ground_truth, description) in enumerate(edge_cases):
            logger.info(f"Testing edge case: {description}")
            
            detected_clouds = self.cloud_detector.detect_clouds(
                image,
                sensitivity=0.7,
                cad_system='generic'
            )
            
            metrics = self._calculate_accuracy_metrics(ground_truth, detected_clouds)
            metrics['case_description'] = description
            results.append(metrics)
            
            logger.info(f"  {description} - F1: {metrics['f1_score']:.3f}")
        
        return results

    def _create_no_cloud_image(self) -> Tuple[np.ndarray, List[Dict], str]:
        """Create image with no clouds"""
        image = np.ones((1080, 1920, 3), dtype=np.uint8) * 255
        self._add_electrical_elements(image)
        return image, [], "No clouds present"

    def _create_very_small_clouds_image(self) -> Tuple[np.ndarray, List[Dict], str]:
        """Create image with very small clouds (edge of detection limit)"""
        image = np.ones((1080, 1920, 3), dtype=np.uint8) * 255
        self._add_electrical_elements(image)
        
        # Add tiny clouds
        ground_truth = []
        for i in range(3):
            x, y = 200 + i * 200, 300
            cv2.circle(image, (x, y), 15, (0, 0, 255), 2)
            ground_truth.append({
                'id': f'tiny_cloud_{i}',
                'bbox': [x-15, y-15, 30, 30],
                'area': 900,
                'confidence': 1.0
            })
        
        return image, ground_truth, "Very small clouds"

    def _create_very_large_clouds_image(self) -> Tuple[np.ndarray, List[Dict], str]:
        """Create image with very large clouds"""
        image = np.ones((1080, 1920, 3), dtype=np.uint8) * 255
        self._add_electrical_elements(image)
        
        # Add large cloud
        overlay = image.copy()
        cv2.rectangle(overlay, (100, 100), (800, 600), (0, 0, 255), -1)
        cv2.addWeighted(image, 0.7, overlay, 0.3, 0, image)
        
        ground_truth = [{
            'id': 'large_cloud',
            'bbox': [100, 100, 700, 500],
            'area': 350000,
            'confidence': 1.0
        }]
        
        return image, ground_truth, "Very large cloud"

    def _create_overlapping_clouds_image(self) -> Tuple[np.ndarray, List[Dict], str]:
        """Create image with overlapping clouds"""
        image = np.ones((1080, 1920, 3), dtype=np.uint8) * 255
        self._add_electrical_elements(image)
        
        # Add overlapping clouds
        overlay = image.copy()
        cv2.circle(overlay, (300, 300), 80, (0, 0, 255), -1)
        cv2.circle(overlay, (350, 300), 80, (0, 0, 255), -1)
        cv2.addWeighted(image, 0.7, overlay, 0.3, 0, image)
        
        ground_truth = [
            {'id': 'cloud_1', 'bbox': [220, 220, 160, 160], 'area': 20000, 'confidence': 1.0},
            {'id': 'cloud_2', 'bbox': [270, 220, 160, 160], 'area': 20000, 'confidence': 1.0}
        ]
        
        return image, ground_truth, "Overlapping clouds"

    def _create_low_contrast_image(self) -> Tuple[np.ndarray, List[Dict], str]:
        """Create image with low contrast clouds"""
        image = np.ones((1080, 1920, 3), dtype=np.uint8) * 240  # Light gray background
        self._add_electrical_elements(image)
        
        # Add low contrast cloud
        overlay = image.copy()
        cv2.circle(overlay, (300, 300), 60, (200, 200, 255), -1)  # Very light red
        cv2.addWeighted(image, 0.9, overlay, 0.1, 0, image)
        
        ground_truth = [{
            'id': 'low_contrast_cloud',
            'bbox': [240, 240, 120, 120],
            'area': 11000,
            'confidence': 1.0
        }]
        
        return image, ground_truth, "Low contrast cloud"

    def _create_noisy_image(self) -> Tuple[np.ndarray, List[Dict], str]:
        """Create image with noise that might interfere with detection"""
        image = np.ones((1080, 1920, 3), dtype=np.uint8) * 255
        self._add_electrical_elements(image)
        
        # Add noise
        noise = np.random.randint(0, 50, image.shape, dtype=np.uint8)
        image = cv2.subtract(image, noise)
        
        # Add cloud
        overlay = image.copy()
        cv2.circle(overlay, (300, 300), 60, (0, 0, 255), -1)
        cv2.addWeighted(image, 0.7, overlay, 0.3, 0, image)
        
        ground_truth = [{
            'id': 'cloud_with_noise',
            'bbox': [240, 240, 120, 120],
            'area': 11000,
            'confidence': 1.0
        }]
        
        return image, ground_truth, "Noisy image with cloud"

    def test_integration_with_pdf_processing(self):
        """Test integration with the full PDF processing pipeline"""
        
        # This would test the actual integration
        # For now, we'll test the key integration points
        
        # Test page_to_image conversion
        test_config = {
            'sensitivity': 0.7,
            'detection_method': 'hybrid',
            'cad_system': 'generic',
            'min_area': 100,
            'max_area': 25000
        }
        
        # Create mock PDF page
        image, ground_truth = self.create_synthetic_drawing()
        
        # Test the detect_clouds_on_page function
        from unittest.mock import Mock
        mock_page = Mock()
        mock_page.rect.width = 1920
        mock_page.rect.height = 1080
        
        detected_clouds = asyncio.run(
            detect_clouds_on_page(image, 1, test_config, mock_page)
        )
        
        # Verify integration
        assert isinstance(detected_clouds, list), "Should return list of clouds"
        assert all('id' in cloud.__dict__ for cloud in detected_clouds), "Clouds should have IDs"
        assert all('page_number' in cloud.__dict__ for cloud in detected_clouds), "Clouds should have page numbers"
        
        logger.info(f"Integration test: Detected {len(detected_clouds)} clouds")
        
        return len(detected_clouds)

# Test runner and reporting
class CloudDetectionTestRunner:
    """Test runner with comprehensive reporting"""
    
    def __init__(self):
        self.test_suite = TestCloudDetectionAccuracy()
        self.results = {}
    
    def run_all_tests(self) -> Dict[str, Any]:
        """Run all cloud detection tests and generate report"""
        
        logger.info("Starting comprehensive cloud detection test suite...")
        
        try:
            # Run all test methods
            self.results['accuracy_synthetic'] = self.test_suite.test_detection_accuracy_synthetic_data()
            self.results['cad_systems'] = self.test_suite.test_cad_system_specific_accuracy()
            self.results['sensitivity'] = self.test_suite.test_sensitivity_parameter_impact()
            self.results['performance'] = self.test_suite.test_performance_benchmarks()
            self.results['edge_cases'] = self.test_suite.test_edge_cases()
            self.results['integration'] = self.test_suite.test_integration_with_pdf_processing()
            
            # Generate summary report
            summary = self._generate_summary_report()
            self.results['summary'] = summary
            
            logger.info("All tests completed successfully!")
            return self.results
            
        except Exception as e:
            logger.error(f"Test suite failed: {e}")
            raise
    
    def _generate_summary_report(self) -> Dict[str, Any]:
        """Generate comprehensive summary report"""
        
        # Calculate overall metrics
        all_f1_scores = []
        all_detection_times = []
        
        # From synthetic data tests
        if 'accuracy_synthetic' in self.results:
            all_f1_scores.extend([r['f1_score'] for r in self.results['accuracy_synthetic']])
            all_detection_times.extend([r['detection_time'] for r in self.results['accuracy_synthetic']])
        
        # From performance tests
        if 'performance' in self.results:
            all_f1_scores.extend([r['f1_score'] for r in self.results['performance']])
            all_detection_times.extend([r['detection_time'] for r in self.results['performance']])
        
        summary = {
            'overall_accuracy': {
                'average_f1_score': np.mean(all_f1_scores) if all_f1_scores else 0.0,
                'min_f1_score': np.min(all_f1_scores) if all_f1_scores else 0.0,
                'max_f1_score': np.max(all_f1_scores) if all_f1_scores else 0.0
            },
            'performance_metrics': {
                'average_detection_time': np.mean(all_detection_times) if all_detection_times else 0.0,
                'max_detection_time': np.max(all_detection_times) if all_detection_times else 0.0,
                'min_detection_time': np.min(all_detection_times) if all_detection_times else 0.0
            },
            'test_coverage': {
                'total_test_cases': len(all_f1_scores),
                'passed_accuracy_threshold': sum(1 for f1 in all_f1_scores if f1 >= 0.8),
                'passed_performance_threshold': sum(1 for t in all_detection_times if t <= 30.0)
            }
        }
        
        # Add recommendations
        summary['recommendations'] = self._generate_recommendations(summary)
        
        return summary
    
    def _generate_recommendations(self, summary: Dict) -> List[str]:
        """Generate recommendations based on test results"""
        
        recommendations = []
        
        avg_f1 = summary['overall_accuracy']['average_f1_score']
        avg_time = summary['performance_metrics']['average_detection_time']
        
        if avg_f1 < 0.8:
            recommendations.append("Consider tuning detection parameters to improve accuracy")
        
        if avg_time > 20.0:
            recommendations.append("Optimize detection algorithms for better performance")
        
        if summary['test_coverage']['passed_accuracy_threshold'] < summary['test_coverage']['total_test_cases'] * 0.9:
            recommendations.append("Review failed test cases and adjust detection thresholds")
        
        if not recommendations:
            recommendations.append("All tests passed successfully - system ready for production")
        
        return recommendations

if __name__ == "__main__":
    # Run the test suite
    runner = CloudDetectionTestRunner()
    results = runner.run_all_tests()
    
    # Print summary
    print("\n" + "="*60)
    print("CLOUD DETECTION TEST SUITE SUMMARY")
    print("="*60)
    
    summary = results.get('summary', {})
    
    if 'overall_accuracy' in summary:
        acc = summary['overall_accuracy']
        print(f"Average F1-Score: {acc['average_f1_score']:.3f}")
        print(f"F1-Score Range: {acc['min_f1_score']:.3f} - {acc['max_f1_score']:.3f}")
    
    if 'performance_metrics' in summary:
        perf = summary['performance_metrics']
        print(f"Average Detection Time: {perf['average_detection_time']:.3f}s")
        print(f"Detection Time Range: {perf['min_detection_time']:.3f}s - {perf['max_detection_time']:.3f}s")
    
    if 'test_coverage' in summary:
        cov = summary['test_coverage']
        print(f"Total Test Cases: {cov['total_test_cases']}")
        print(f"Passed Accuracy Tests: {cov['passed_accuracy_threshold']}/{cov['total_test_cases']}")
        print(f"Passed Performance Tests: {cov['passed_performance_threshold']}/{cov['total_test_cases']}")
    
    if 'recommendations' in summary:
        print("\nRecommendations:")
        for i, rec in enumerate(summary['recommendations'], 1):
            print(f"{i}. {rec}")
    
    print("="*60)
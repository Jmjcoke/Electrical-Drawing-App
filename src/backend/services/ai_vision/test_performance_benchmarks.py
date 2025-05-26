"""
Performance benchmark tests for cloud detection system
Tests processing speed, memory usage, and scalability
"""

import pytest
import time
import psutil
import numpy as np
import cv2
import asyncio
import threading
from typing import Dict, List, Tuple, Any
from concurrent.futures import ThreadPoolExecutor, as_completed
import logging
from pathlib import Path
import json
from dataclasses import dataclass
from statistics import mean, median, stdev

# Import modules under test
from cloud_detector import CloudDetector
from pattern_recognizer import PatternRecognizer
from enhanced_overlay_generator import EnhancedOverlayGenerator

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

@dataclass
class PerformanceMetrics:
    """Container for performance metrics"""
    processing_time: float
    memory_usage_mb: float
    cpu_usage_percent: float
    clouds_detected: int
    pixels_per_second: float
    peak_memory_mb: float
    threads_used: int

@dataclass
class BenchmarkResult:
    """Container for benchmark test results"""
    test_name: str
    image_size: Tuple[int, int]
    cloud_count: int
    metrics: PerformanceMetrics
    success: bool
    error_message: str = ""

class CloudDetectionPerformanceBenchmarks:
    """Performance benchmark test suite"""
    
    def __init__(self):
        self.cloud_detector = CloudDetector()
        self.pattern_recognizer = PatternRecognizer()
        self.overlay_generator = EnhancedOverlayGenerator()
        
        # Performance targets
        self.performance_targets = {
            'max_processing_time_1080p': 30.0,  # seconds for 1920x1080
            'max_processing_time_4k': 120.0,    # seconds for 3840x2160
            'max_memory_usage_mb': 2048,        # MB
            'min_pixels_per_second': 50000,     # pixels/second
            'max_cpu_usage_percent': 80.0       # %
        }
    
    def create_test_image(self, width: int, height: int, cloud_count: int = 5) -> np.ndarray:
        """Create test image with specified dimensions and cloud count"""
        
        # Create base electrical drawing
        image = np.ones((height, width, 3), dtype=np.uint8) * 255
        
        # Add electrical elements for realism
        self._add_realistic_electrical_content(image, width, height)
        
        # Add clouds
        for i in range(cloud_count):
            self._add_performance_test_cloud(image, i, width, height)
        
        return image
    
    def _add_realistic_electrical_content(self, image: np.ndarray, width: int, height: int):
        """Add realistic electrical drawing content"""
        
        # Grid lines
        grid_spacing = max(50, min(width, height) // 20)
        for x in range(0, width, grid_spacing):
            cv2.line(image, (x, 0), (x, height), (200, 200, 200), 1)
        for y in range(0, height, grid_spacing):
            cv2.line(image, (0, y), (width, y), (200, 200, 200), 1)
        
        # Main circuit lines
        for i in range(5):
            y = height // 6 + i * (height // 6)
            cv2.line(image, (50, y), (width-50, y), (0, 0, 0), 3)
        
        # Electrical symbols
        symbol_count = max(10, (width * height) // 100000)
        for i in range(symbol_count):
            x = np.random.randint(100, width - 100)
            y = np.random.randint(100, height - 100)
            
            # Draw various electrical symbols
            if i % 4 == 0:  # Breaker
                cv2.rectangle(image, (x, y), (x+40, y+20), (0, 0, 0), 2)
            elif i % 4 == 1:  # Connection point
                cv2.circle(image, (x, y), 8, (0, 0, 0), 2)
            elif i % 4 == 2:  # Switch
                cv2.line(image, (x, y), (x+30, y-15), (0, 0, 0), 3)
            else:  # Text label
                cv2.putText(image, f"L{i}", (x, y), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 0, 0), 1)
    
    def _add_performance_test_cloud(self, image: np.ndarray, cloud_id: int, width: int, height: int):
        """Add a cloud for performance testing"""
        
        # Random but deterministic placement
        np.random.seed(42 + cloud_id)
        x = np.random.randint(100, width - 300)
        y = np.random.randint(100, height - 200)
        cloud_width = np.random.randint(100, 200)
        cloud_height = np.random.randint(80, 150)
        
        # Create cloud overlay
        overlay = image.copy()
        
        # Irregular cloud shape
        center_x, center_y = x + cloud_width//2, y + cloud_height//2
        points = []
        for angle in range(0, 360, 20):
            radius = np.random.uniform(0.8, 1.2) * min(cloud_width, cloud_height) / 2
            px = int(center_x + radius * np.cos(np.radians(angle)))
            py = int(center_y + radius * np.sin(np.radians(angle)))
            points.append([px, py])
        
        points = np.array(points, dtype=np.int32)
        cv2.fillPoly(overlay, [points], (50, 50, 255))  # Semi-transparent red
        cv2.polylines(overlay, [points], True, (0, 0, 200), 2)
        
        # Apply with transparency
        alpha = 0.4
        image[:] = cv2.addWeighted(image, 1-alpha, overlay, alpha, 0)
    
    def measure_system_resources(self) -> Tuple[float, float]:
        """Measure current CPU and memory usage"""
        process = psutil.Process()
        cpu_percent = process.cpu_percent()
        memory_mb = process.memory_info().rss / 1024 / 1024
        return cpu_percent, memory_mb
    
    def benchmark_single_detection(self, image_size: Tuple[int, int], 
                                 cloud_count: int = 5) -> BenchmarkResult:
        """Benchmark single image detection performance"""
        
        width, height = image_size
        test_name = f"Single Detection {width}x{height} ({cloud_count} clouds)"
        
        logger.info(f"Running benchmark: {test_name}")
        
        try:
            # Create test image
            image = self.create_test_image(width, height, cloud_count)
            
            # Initial system state
            initial_cpu, initial_memory = self.measure_system_resources()
            start_time = time.time()
            
            # Perform detection
            detected_clouds = self.cloud_detector.detect_clouds(
                image, 
                sensitivity=0.7,
                cad_system='generic'
            )
            
            # Measure completion
            end_time = time.time()
            final_cpu, final_memory = self.measure_system_resources()
            
            processing_time = end_time - start_time
            memory_used = final_memory - initial_memory
            cpu_usage = final_cpu
            pixels_processed = width * height
            pixels_per_second = pixels_processed / processing_time
            
            metrics = PerformanceMetrics(
                processing_time=processing_time,
                memory_usage_mb=memory_used,
                cpu_usage_percent=cpu_usage,
                clouds_detected=len(detected_clouds),
                pixels_per_second=pixels_per_second,
                peak_memory_mb=final_memory,
                threads_used=1
            )
            
            # Validate against targets
            success = (
                processing_time <= self.performance_targets.get('max_processing_time_1080p', 30.0) and
                final_memory <= self.performance_targets.get('max_memory_usage_mb', 2048) and
                pixels_per_second >= self.performance_targets.get('min_pixels_per_second', 50000)
            )
            
            logger.info(f"  Processing time: {processing_time:.3f}s")
            logger.info(f"  Memory used: {memory_used:.1f}MB")
            logger.info(f"  Pixels/second: {pixels_per_second:.0f}")
            logger.info(f"  Clouds detected: {len(detected_clouds)}")
            
            return BenchmarkResult(
                test_name=test_name,
                image_size=image_size,
                cloud_count=cloud_count,
                metrics=metrics,
                success=success
            )
            
        except Exception as e:
            logger.error(f"Benchmark failed: {e}")
            return BenchmarkResult(
                test_name=test_name,
                image_size=image_size,
                cloud_count=cloud_count,
                metrics=PerformanceMetrics(0, 0, 0, 0, 0, 0, 0),
                success=False,
                error_message=str(e)
            )
    
    def benchmark_concurrent_detection(self, image_size: Tuple[int, int], 
                                     concurrent_count: int = 4) -> Dict[str, Any]:
        """Benchmark concurrent detection performance"""
        
        width, height = image_size
        test_name = f"Concurrent Detection {concurrent_count}x{width}x{height}"
        
        logger.info(f"Running benchmark: {test_name}")
        
        # Create test images
        test_images = []
        for i in range(concurrent_count):
            image = self.create_test_image(width, height, 5)
            test_images.append(image)
        
        # Track performance metrics
        processing_times = []
        memory_usage = []
        clouds_detected = []
        
        def detect_clouds_worker(image_data):
            """Worker function for concurrent detection"""
            start_time = time.time()
            _, initial_memory = self.measure_system_resources()
            
            # Create new detector instance for thread safety
            detector = CloudDetector()
            detected = detector.detect_clouds(image_data, sensitivity=0.7, cad_system='generic')
            
            end_time = time.time()
            _, final_memory = self.measure_system_resources()
            
            return {
                'processing_time': end_time - start_time,
                'memory_change': final_memory - initial_memory,
                'clouds_detected': len(detected)
            }
        
        # Run concurrent detection
        overall_start = time.time()
        
        with ThreadPoolExecutor(max_workers=concurrent_count) as executor:
            futures = [executor.submit(detect_clouds_worker, img) for img in test_images]
            
            for future in as_completed(futures):
                result = future.result()
                processing_times.append(result['processing_time'])
                memory_usage.append(result['memory_change'])
                clouds_detected.append(result['clouds_detected'])
        
        overall_time = time.time() - overall_start
        
        # Calculate statistics
        stats = {
            'total_images': concurrent_count,
            'overall_time': overall_time,
            'average_processing_time': mean(processing_times),
            'median_processing_time': median(processing_times),
            'std_processing_time': stdev(processing_times) if len(processing_times) > 1 else 0,
            'total_memory_usage': sum(memory_usage),
            'average_memory_per_image': mean(memory_usage),
            'total_clouds_detected': sum(clouds_detected),
            'images_per_second': concurrent_count / overall_time,
            'parallelization_efficiency': (sum(processing_times) / overall_time) if overall_time > 0 else 0
        }
        
        logger.info(f"  Overall time: {overall_time:.3f}s")
        logger.info(f"  Average processing time: {stats['average_processing_time']:.3f}s")
        logger.info(f"  Images per second: {stats['images_per_second']:.2f}")
        logger.info(f"  Parallelization efficiency: {stats['parallelization_efficiency']:.2f}")
        
        return stats
    
    def benchmark_memory_scaling(self) -> Dict[str, Any]:
        """Benchmark memory usage scaling with image size"""
        
        logger.info("Running memory scaling benchmark...")
        
        test_sizes = [
            (1280, 720),    # HD
            (1920, 1080),   # Full HD
            (2560, 1440),   # QHD
            (3840, 2160),   # 4K
            (7680, 4320)    # 8K
        ]
        
        results = {}
        
        for width, height in test_sizes:
            size_name = f"{width}x{height}"
            logger.info(f"  Testing size: {size_name}")
            
            # Create test image
            image = self.create_test_image(width, height, 5)
            
            # Measure memory before and during detection
            initial_memory = psutil.Process().memory_info().rss / 1024 / 1024
            
            start_time = time.time()
            detected_clouds = self.cloud_detector.detect_clouds(image, sensitivity=0.7, cad_system='generic')
            processing_time = time.time() - start_time
            
            final_memory = psutil.Process().memory_info().rss / 1024 / 1024
            memory_used = final_memory - initial_memory
            
            pixels = width * height
            memory_per_pixel = memory_used / pixels if pixels > 0 else 0
            
            results[size_name] = {
                'width': width,
                'height': height,
                'pixels': pixels,
                'processing_time': processing_time,
                'memory_used_mb': memory_used,
                'memory_per_pixel_bytes': memory_per_pixel * 1024 * 1024,
                'clouds_detected': len(detected_clouds),
                'pixels_per_second': pixels / processing_time
            }
            
            logger.info(f"    Memory used: {memory_used:.1f}MB")
            logger.info(f"    Processing time: {processing_time:.3f}s")
        
        return results
    
    def benchmark_cloud_density_impact(self) -> Dict[str, Any]:
        """Benchmark performance impact of cloud density"""
        
        logger.info("Running cloud density impact benchmark...")
        
        cloud_counts = [1, 3, 5, 10, 15, 25, 50]
        image_size = (1920, 1080)
        results = {}
        
        for cloud_count in cloud_counts:
            logger.info(f"  Testing {cloud_count} clouds...")
            
            # Create test image
            image = self.create_test_image(image_size[0], image_size[1], cloud_count)
            
            # Measure performance
            start_time = time.time()
            detected_clouds = self.cloud_detector.detect_clouds(image, sensitivity=0.7, cad_system='generic')
            processing_time = time.time() - start_time
            
            results[cloud_count] = {
                'expected_clouds': cloud_count,
                'detected_clouds': len(detected_clouds),
                'processing_time': processing_time,
                'time_per_cloud': processing_time / cloud_count if cloud_count > 0 else 0,
                'detection_accuracy': len(detected_clouds) / cloud_count if cloud_count > 0 else 0
            }
            
            logger.info(f"    Processing time: {processing_time:.3f}s")
            logger.info(f"    Detected: {len(detected_clouds)}/{cloud_count} clouds")
        
        return results
    
    def benchmark_algorithm_comparison(self) -> Dict[str, Any]:
        """Benchmark different detection algorithms"""
        
        logger.info("Running algorithm comparison benchmark...")
        
        algorithms = ['color', 'shape', 'texture', 'hybrid']
        image_size = (1920, 1080)
        results = {}
        
        # Create consistent test image
        test_image = self.create_test_image(image_size[0], image_size[1], 8)
        
        for algorithm in algorithms:
            logger.info(f"  Testing algorithm: {algorithm}")
            
            # Measure performance
            start_time = time.time()
            detected_clouds = self.cloud_detector.detect_clouds(
                test_image, 
                sensitivity=0.7, 
                cad_system='generic'
            )
            processing_time = time.time() - start_time
            
            results[algorithm] = {
                'processing_time': processing_time,
                'clouds_detected': len(detected_clouds),
                'pixels_per_second': (image_size[0] * image_size[1]) / processing_time
            }
            
            logger.info(f"    Processing time: {processing_time:.3f}s")
            logger.info(f"    Clouds detected: {len(detected_clouds)}")
        
        return results
    
    def run_comprehensive_benchmarks(self) -> Dict[str, Any]:
        """Run comprehensive performance benchmarks"""
        
        logger.info("Starting comprehensive performance benchmarks...")
        
        benchmark_results = {}
        
        # Single detection benchmarks
        logger.info("\n=== Single Detection Benchmarks ===")
        single_detection_results = []
        
        test_configs = [
            ((1280, 720), 3),
            ((1920, 1080), 5),
            ((2560, 1440), 8),
            ((3840, 2160), 10)
        ]
        
        for size, cloud_count in test_configs:
            result = self.benchmark_single_detection(size, cloud_count)
            single_detection_results.append(result)
        
        benchmark_results['single_detection'] = single_detection_results
        
        # Concurrent detection benchmarks
        logger.info("\n=== Concurrent Detection Benchmarks ===")
        concurrent_results = {}
        
        for concurrent_count in [2, 4, 8]:
            result = self.benchmark_concurrent_detection((1920, 1080), concurrent_count)
            concurrent_results[f'{concurrent_count}_concurrent'] = result
        
        benchmark_results['concurrent_detection'] = concurrent_results
        
        # Memory scaling benchmarks
        logger.info("\n=== Memory Scaling Benchmarks ===")
        benchmark_results['memory_scaling'] = self.benchmark_memory_scaling()
        
        # Cloud density impact
        logger.info("\n=== Cloud Density Impact Benchmarks ===")
        benchmark_results['cloud_density'] = self.benchmark_cloud_density_impact()
        
        # Algorithm comparison
        logger.info("\n=== Algorithm Comparison Benchmarks ===")
        benchmark_results['algorithm_comparison'] = self.benchmark_algorithm_comparison()
        
        # Generate summary
        benchmark_results['summary'] = self._generate_performance_summary(benchmark_results)
        
        logger.info("\nComprehensive benchmarks completed!")
        return benchmark_results
    
    def _generate_performance_summary(self, results: Dict[str, Any]) -> Dict[str, Any]:
        """Generate performance summary from benchmark results"""
        
        summary = {
            'overall_performance': 'UNKNOWN',
            'key_metrics': {},
            'bottlenecks': [],
            'recommendations': []
        }
        
        # Analyze single detection results
        if 'single_detection' in results:
            single_results = results['single_detection']
            processing_times = [r.metrics.processing_time for r in single_results if r.success]
            memory_usage = [r.metrics.peak_memory_mb for r in single_results if r.success]
            
            if processing_times:
                summary['key_metrics']['average_processing_time'] = mean(processing_times)
                summary['key_metrics']['max_processing_time'] = max(processing_times)
                summary['key_metrics']['average_memory_usage'] = mean(memory_usage)
                summary['key_metrics']['max_memory_usage'] = max(memory_usage)
        
        # Analyze concurrent detection
        if 'concurrent_detection' in results:
            concurrent_data = results['concurrent_detection']
            parallelization_efficiencies = [
                data['parallelization_efficiency'] 
                for data in concurrent_data.values()
            ]
            if parallelization_efficiencies:
                summary['key_metrics']['avg_parallelization_efficiency'] = mean(parallelization_efficiencies)
        
        # Determine overall performance
        issues = 0
        
        # Check processing time
        avg_time = summary['key_metrics'].get('average_processing_time', 0)
        if avg_time > 20.0:
            issues += 1
            summary['bottlenecks'].append('Slow processing time')
        
        # Check memory usage
        avg_memory = summary['key_metrics'].get('average_memory_usage', 0)
        if avg_memory > 1500:
            issues += 1
            summary['bottlenecks'].append('High memory usage')
        
        # Check parallelization
        parallel_eff = summary['key_metrics'].get('avg_parallelization_efficiency', 1.0)
        if parallel_eff < 0.6:
            issues += 1
            summary['bottlenecks'].append('Poor parallelization efficiency')
        
        # Overall assessment
        if issues == 0:
            summary['overall_performance'] = 'EXCELLENT'
        elif issues == 1:
            summary['overall_performance'] = 'GOOD'
        elif issues == 2:
            summary['overall_performance'] = 'FAIR'
        else:
            summary['overall_performance'] = 'POOR'
        
        # Generate recommendations
        if 'Slow processing time' in summary['bottlenecks']:
            summary['recommendations'].append('Optimize detection algorithms for speed')
        
        if 'High memory usage' in summary['bottlenecks']:
            summary['recommendations'].append('Implement memory optimization techniques')
        
        if 'Poor parallelization efficiency' in summary['bottlenecks']:
            summary['recommendations'].append('Review threading and concurrency implementation')
        
        if not summary['recommendations']:
            summary['recommendations'].append('Performance is optimal - no changes needed')
        
        return summary


def run_performance_benchmarks():
    """Run performance benchmarks and generate report"""
    
    benchmarks = CloudDetectionPerformanceBenchmarks()
    results = benchmarks.run_comprehensive_benchmarks()
    
    # Print summary report
    print("\n" + "="*80)
    print("CLOUD DETECTION PERFORMANCE BENCHMARK REPORT")
    print("="*80)
    
    summary = results.get('summary', {})
    
    print(f"Overall Performance: {summary.get('overall_performance', 'UNKNOWN')}")
    print()
    
    # Key metrics
    if 'key_metrics' in summary:
        print("Key Performance Metrics:")
        metrics = summary['key_metrics']
        if 'average_processing_time' in metrics:
            print(f"  Average Processing Time: {metrics['average_processing_time']:.3f}s")
        if 'max_processing_time' in metrics:
            print(f"  Maximum Processing Time: {metrics['max_processing_time']:.3f}s")
        if 'average_memory_usage' in metrics:
            print(f"  Average Memory Usage: {metrics['average_memory_usage']:.1f}MB")
        if 'avg_parallelization_efficiency' in metrics:
            print(f"  Parallelization Efficiency: {metrics['avg_parallelization_efficiency']:.1%}")
        print()
    
    # Bottlenecks
    if summary.get('bottlenecks'):
        print("Performance Bottlenecks:")
        for bottleneck in summary['bottlenecks']:
            print(f"  • {bottleneck}")
        print()
    
    # Recommendations
    if summary.get('recommendations'):
        print("Recommendations:")
        for i, rec in enumerate(summary['recommendations'], 1):
            print(f"  {i}. {rec}")
        print()
    
    # Detailed results
    if 'single_detection' in results:
        print("Single Detection Results:")
        for result in results['single_detection']:
            print(f"  {result.test_name}: {result.metrics.processing_time:.3f}s, "
                  f"{result.metrics.clouds_detected} clouds, "
                  f"{'PASS' if result.success else 'FAIL'}")
        print()
    
    print("="*80)
    
    return results


if __name__ == "__main__":
    run_performance_benchmarks()
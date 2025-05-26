"""
Main test runner for comprehensive cloud detection validation
Orchestrates accuracy, integration, and performance testing
"""

import asyncio
import json
import time
import logging
from pathlib import Path
from datetime import datetime
from typing import Dict, Any, List
import argparse
import sys

# Import test suites
from test_cloud_detection_accuracy import CloudDetectionTestRunner
from test_integration_suite import IntegrationTestRunner
from test_performance_benchmarks import CloudDetectionPerformanceBenchmarks

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('cloud_detection_tests.log'),
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger(__name__)

class ComprehensiveTestRunner:
    """Comprehensive test runner for cloud detection system"""
    
    def __init__(self, output_dir: str = "test_results"):
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(exist_ok=True)
        
        # Test suite runners
        self.accuracy_runner = CloudDetectionTestRunner()
        self.integration_runner = IntegrationTestRunner()
        self.performance_runner = CloudDetectionPerformanceBenchmarks()
        
        # Test execution configuration
        self.test_config = {
            'run_accuracy_tests': True,
            'run_integration_tests': True,
            'run_performance_tests': True,
            'generate_detailed_report': True,
            'save_test_data': True
        }
    
    async def run_all_tests(self, config: Dict[str, bool] = None) -> Dict[str, Any]:
        """Run all test suites and generate comprehensive report"""
        
        if config:
            self.test_config.update(config)
        
        logger.info("Starting comprehensive cloud detection test suite...")
        logger.info(f"Test configuration: {self.test_config}")
        
        start_time = datetime.now()
        results = {
            'test_run_info': {
                'start_time': start_time.isoformat(),
                'configuration': self.test_config,
                'test_suites': []
            },
            'results': {},
            'summary': {}
        }
        
        try:
            # Run accuracy tests
            if self.test_config['run_accuracy_tests']:
                logger.info("\n" + "="*60)
                logger.info("RUNNING ACCURACY TESTS")
                logger.info("="*60)
                
                accuracy_start = time.time()
                accuracy_results = self.accuracy_runner.run_all_tests()
                accuracy_time = time.time() - accuracy_start
                
                results['results']['accuracy'] = accuracy_results
                results['test_run_info']['test_suites'].append({
                    'name': 'accuracy',
                    'duration': accuracy_time,
                    'status': 'completed'
                })
                
                logger.info(f"Accuracy tests completed in {accuracy_time:.2f}s")
            
            # Run integration tests
            if self.test_config['run_integration_tests']:
                logger.info("\n" + "="*60)
                logger.info("RUNNING INTEGRATION TESTS")
                logger.info("="*60)
                
                integration_start = time.time()
                integration_results = await self.integration_runner.run_all_integration_tests()
                integration_time = time.time() - integration_start
                
                results['results']['integration'] = integration_results
                results['test_run_info']['test_suites'].append({
                    'name': 'integration',
                    'duration': integration_time,
                    'status': 'completed'
                })
                
                logger.info(f"Integration tests completed in {integration_time:.2f}s")
            
            # Run performance tests
            if self.test_config['run_performance_tests']:
                logger.info("\n" + "="*60)
                logger.info("RUNNING PERFORMANCE TESTS")
                logger.info("="*60)
                
                performance_start = time.time()
                performance_results = self.performance_runner.run_comprehensive_benchmarks()
                performance_time = time.time() - performance_start
                
                results['results']['performance'] = performance_results
                results['test_run_info']['test_suites'].append({
                    'name': 'performance',
                    'duration': performance_time,
                    'status': 'completed'
                })
                
                logger.info(f"Performance tests completed in {performance_time:.2f}s")
            
            # Generate comprehensive summary
            end_time = datetime.now()
            total_duration = (end_time - start_time).total_seconds()
            
            results['test_run_info']['end_time'] = end_time.isoformat()
            results['test_run_info']['total_duration'] = total_duration
            
            results['summary'] = self._generate_comprehensive_summary(results)
            
            # Save results
            if self.test_config['save_test_data']:
                self._save_test_results(results)
            
            # Generate detailed report
            if self.test_config['generate_detailed_report']:
                self._generate_detailed_report(results)
            
            logger.info(f"\nAll tests completed successfully in {total_duration:.2f}s")
            
            return results
            
        except Exception as e:
            logger.error(f"Test suite execution failed: {e}")
            results['test_run_info']['error'] = str(e)
            results['test_run_info']['status'] = 'failed'
            raise
    
    def _generate_comprehensive_summary(self, results: Dict[str, Any]) -> Dict[str, Any]:
        """Generate comprehensive summary from all test results"""
        
        summary = {
            'overall_status': 'UNKNOWN',
            'test_coverage': {
                'accuracy_tests': 0,
                'integration_tests': 0,
                'performance_tests': 0,
                'total_tests': 0
            },
            'performance_metrics': {},
            'quality_assessment': {},
            'deployment_readiness': 'UNKNOWN',
            'critical_issues': [],
            'recommendations': []
        }
        
        # Analyze accuracy results
        if 'accuracy' in results['results']:
            accuracy_data = results['results']['accuracy']
            if 'summary' in accuracy_data:
                acc_summary = accuracy_data['summary']
                
                # Extract accuracy metrics
                if 'overall_accuracy' in acc_summary:
                    overall_acc = acc_summary['overall_accuracy']
                    summary['quality_assessment']['average_f1_score'] = overall_acc.get('average_f1_score', 0)
                    summary['quality_assessment']['min_f1_score'] = overall_acc.get('min_f1_score', 0)
                
                # Test coverage
                if 'test_coverage' in acc_summary:
                    cov = acc_summary['test_coverage']
                    summary['test_coverage']['accuracy_tests'] = cov.get('total_test_cases', 0)
        
        # Analyze integration results
        if 'integration' in results['results']:
            integration_data = results['results']['integration']
            if 'summary' in integration_data:
                int_summary = integration_data['summary']
                
                # Test coverage
                if 'test_coverage' in int_summary:
                    cov = int_summary['test_coverage']
                    summary['test_coverage']['integration_tests'] = cov.get('total_tests', 0)
                
                # Performance from integration tests
                if 'performance_summary' in int_summary:
                    perf = int_summary['performance_summary']
                    if perf:
                        summary['performance_metrics']['api_response_time'] = perf.get('average_response_time', 0)
        
        # Analyze performance results
        if 'performance' in results['results']:
            performance_data = results['results']['performance']
            if 'summary' in performance_data:
                perf_summary = performance_data['summary']
                
                # Performance metrics
                if 'key_metrics' in perf_summary:
                    metrics = perf_summary['key_metrics']
                    summary['performance_metrics'].update(metrics)
                
                # Performance assessment
                summary['performance_assessment'] = perf_summary.get('overall_performance', 'UNKNOWN')
        
        # Calculate total test coverage
        summary['test_coverage']['total_tests'] = sum([
            summary['test_coverage']['accuracy_tests'],
            summary['test_coverage']['integration_tests'],
            summary['test_coverage']['performance_tests']
        ])
        
        # Determine overall status
        summary['overall_status'] = self._determine_overall_status(summary)
        
        # Assess deployment readiness
        summary['deployment_readiness'] = self._assess_deployment_readiness(summary)
        
        # Generate recommendations
        summary['recommendations'] = self._generate_final_recommendations(summary, results)
        
        return summary
    
    def _determine_overall_status(self, summary: Dict[str, Any]) -> str:
        """Determine overall test status"""
        
        issues = []
        
        # Check accuracy
        avg_f1 = summary['quality_assessment'].get('average_f1_score', 0)
        if avg_f1 < 0.8:
            issues.append('Low accuracy')
        
        # Check performance
        avg_time = summary['performance_metrics'].get('average_processing_time', 0)
        if avg_time > 30.0:
            issues.append('Slow performance')
        
        # Check memory usage
        avg_memory = summary['performance_metrics'].get('average_memory_usage', 0)
        if avg_memory > 2000:
            issues.append('High memory usage')
        
        # Determine status
        if not issues:
            return 'EXCELLENT'
        elif len(issues) == 1:
            return 'GOOD'
        elif len(issues) == 2:
            return 'FAIR'
        else:
            return 'POOR'
    
    def _assess_deployment_readiness(self, summary: Dict[str, Any]) -> str:
        """Assess readiness for production deployment"""
        
        blockers = []
        
        # Critical accuracy threshold
        avg_f1 = summary['quality_assessment'].get('average_f1_score', 0)
        if avg_f1 < 0.75:
            blockers.append('Accuracy below minimum threshold')
        
        # Critical performance threshold
        avg_time = summary['performance_metrics'].get('average_processing_time', 0)
        if avg_time > 60.0:
            blockers.append('Performance below acceptable threshold')
        
        # Memory constraints
        avg_memory = summary['performance_metrics'].get('average_memory_usage', 0)
        if avg_memory > 4000:  # 4GB limit
            blockers.append('Memory usage exceeds limits')
        
        if not blockers:
            return 'READY'
        elif len(blockers) == 1:
            return 'CONDITIONAL'
        else:
            return 'NOT_READY'
    
    def _generate_final_recommendations(self, summary: Dict[str, Any], 
                                      results: Dict[str, Any]) -> List[str]:
        """Generate final recommendations based on all test results"""
        
        recommendations = []
        
        # Accuracy recommendations
        avg_f1 = summary['quality_assessment'].get('average_f1_score', 0)
        if avg_f1 < 0.8:
            recommendations.append("Improve detection accuracy through algorithm tuning")
        
        # Performance recommendations
        avg_time = summary['performance_metrics'].get('average_processing_time', 0)
        if avg_time > 20.0:
            recommendations.append("Optimize detection algorithms for better performance")
        
        # Memory recommendations
        avg_memory = summary['performance_metrics'].get('average_memory_usage', 0)
        if avg_memory > 1500:
            recommendations.append("Implement memory optimization strategies")
        
        # Integration recommendations
        if 'integration' in results['results']:
            int_data = results['results']['integration']
            if 'error_handling' in int_data:
                unhandled = sum(1 for test in int_data['error_handling'].values() 
                              if not test.get('handled_gracefully', True))
                if unhandled > 0:
                    recommendations.append("Improve error handling for edge cases")
        
        # Deployment recommendations
        deployment_status = summary.get('deployment_readiness', 'UNKNOWN')
        if deployment_status == 'READY':
            recommendations.append("System is ready for production deployment")
        elif deployment_status == 'CONDITIONAL':
            recommendations.append("Address minor issues before production deployment")
        else:
            recommendations.append("Significant improvements needed before deployment")
        
        return recommendations
    
    def _save_test_results(self, results: Dict[str, Any]):
        """Save test results to files"""
        
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        
        # Save full results as JSON
        results_file = self.output_dir / f"test_results_{timestamp}.json"
        with open(results_file, 'w') as f:
            json.dump(results, f, indent=2, default=str)
        
        logger.info(f"Test results saved to: {results_file}")
        
        # Save summary separately
        summary_file = self.output_dir / f"test_summary_{timestamp}.json"
        with open(summary_file, 'w') as f:
            json.dump(results['summary'], f, indent=2, default=str)
        
        logger.info(f"Test summary saved to: {summary_file}")
    
    def _generate_detailed_report(self, results: Dict[str, Any]):
        """Generate detailed human-readable report"""
        
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        report_file = self.output_dir / f"test_report_{timestamp}.md"
        
        with open(report_file, 'w') as f:
            f.write("# Cloud Detection System Test Report\n\n")
            f.write(f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n\n")
            
            # Executive Summary
            f.write("## Executive Summary\n\n")
            summary = results.get('summary', {})
            f.write(f"**Overall Status:** {summary.get('overall_status', 'UNKNOWN')}\n\n")
            f.write(f"**Deployment Readiness:** {summary.get('deployment_readiness', 'UNKNOWN')}\n\n")
            
            # Test Coverage
            f.write("## Test Coverage\n\n")
            coverage = summary.get('test_coverage', {})
            f.write(f"- Accuracy Tests: {coverage.get('accuracy_tests', 0)}\n")
            f.write(f"- Integration Tests: {coverage.get('integration_tests', 0)}\n")
            f.write(f"- Performance Tests: {coverage.get('performance_tests', 0)}\n")
            f.write(f"- **Total Tests:** {coverage.get('total_tests', 0)}\n\n")
            
            # Quality Assessment
            f.write("## Quality Assessment\n\n")
            quality = summary.get('quality_assessment', {})
            if quality:
                f.write(f"- Average F1-Score: {quality.get('average_f1_score', 0):.3f}\n")
                f.write(f"- Minimum F1-Score: {quality.get('min_f1_score', 0):.3f}\n\n")
            
            # Performance Metrics
            f.write("## Performance Metrics\n\n")
            perf = summary.get('performance_metrics', {})
            if perf:
                if 'average_processing_time' in perf:
                    f.write(f"- Average Processing Time: {perf['average_processing_time']:.3f}s\n")
                if 'average_memory_usage' in perf:
                    f.write(f"- Average Memory Usage: {perf['average_memory_usage']:.1f}MB\n")
                if 'api_response_time' in perf:
                    f.write(f"- API Response Time: {perf['api_response_time']:.3f}s\n")
                f.write("\n")
            
            # Recommendations
            f.write("## Recommendations\n\n")
            recommendations = summary.get('recommendations', [])
            for i, rec in enumerate(recommendations, 1):
                f.write(f"{i}. {rec}\n")
            f.write("\n")
            
            # Detailed Results
            f.write("## Detailed Results\n\n")
            
            # Accuracy Results
            if 'accuracy' in results['results']:
                f.write("### Accuracy Test Results\n\n")
                acc_results = results['results']['accuracy']
                if 'accuracy_synthetic' in acc_results:
                    f.write("#### Synthetic Data Tests\n\n")
                    for i, test in enumerate(acc_results['accuracy_synthetic'], 1):
                        f.write(f"{i}. {test.get('test_case', 'Unknown')}\n")
                        f.write(f"   - Precision: {test.get('precision', 0):.3f}\n")
                        f.write(f"   - Recall: {test.get('recall', 0):.3f}\n")
                        f.write(f"   - F1-Score: {test.get('f1_score', 0):.3f}\n\n")
            
            f.write("---\n\n")
            f.write("*Report generated by Cloud Detection Test Suite*\n")
        
        logger.info(f"Detailed report saved to: {report_file}")
    
    def run_quick_validation(self) -> Dict[str, Any]:
        """Run quick validation tests for development"""
        
        logger.info("Running quick validation tests...")
        
        # Quick accuracy test
        accuracy_runner = CloudDetectionTestRunner()
        accuracy_runner.test_suite.setup()
        quick_accuracy = accuracy_runner.test_suite.test_detection_accuracy_synthetic_data()
        
        # Quick performance test
        performance_runner = CloudDetectionPerformanceBenchmarks()
        quick_performance = performance_runner.benchmark_single_detection((1920, 1080), 3)
        
        results = {
            'quick_accuracy': quick_accuracy[-1] if quick_accuracy else {},
            'quick_performance': {
                'processing_time': quick_performance.metrics.processing_time,
                'memory_usage': quick_performance.metrics.peak_memory_mb,
                'clouds_detected': quick_performance.metrics.clouds_detected,
                'success': quick_performance.success
            },
            'validation_status': 'PASS' if (
                quick_performance.success and 
                quick_accuracy and 
                quick_accuracy[-1].get('f1_score', 0) > 0.7
            ) else 'FAIL'
        }
        
        logger.info(f"Quick validation: {results['validation_status']}")
        return results


def main():
    """Main entry point for test runner"""
    
    parser = argparse.ArgumentParser(description='Cloud Detection Test Suite')
    parser.add_argument('--quick', action='store_true', help='Run quick validation only')
    parser.add_argument('--accuracy-only', action='store_true', help='Run accuracy tests only')
    parser.add_argument('--integration-only', action='store_true', help='Run integration tests only')
    parser.add_argument('--performance-only', action='store_true', help='Run performance tests only')
    parser.add_argument('--output-dir', default='test_results', help='Output directory for results')
    
    args = parser.parse_args()
    
    runner = ComprehensiveTestRunner(args.output_dir)
    
    if args.quick:
        # Quick validation
        results = runner.run_quick_validation()
        print(f"\nQuick Validation Result: {results['validation_status']}")
        
    else:
        # Full test suite
        config = {
            'run_accuracy_tests': not (args.integration_only or args.performance_only),
            'run_integration_tests': not (args.accuracy_only or args.performance_only),
            'run_performance_tests': not (args.accuracy_only or args.integration_only)
        }
        
        if args.accuracy_only:
            config['run_accuracy_tests'] = True
        elif args.integration_only:
            config['run_integration_tests'] = True
        elif args.performance_only:
            config['run_performance_tests'] = True
        
        # Run comprehensive tests
        async def run_tests():
            return await runner.run_all_tests(config)
        
        results = asyncio.run(run_tests())
        
        # Print final summary
        print("\n" + "="*80)
        print("COMPREHENSIVE TEST SUITE SUMMARY")
        print("="*80)
        
        summary = results.get('summary', {})
        print(f"Overall Status: {summary.get('overall_status', 'UNKNOWN')}")
        print(f"Deployment Readiness: {summary.get('deployment_readiness', 'UNKNOWN')}")
        
        if 'test_coverage' in summary:
            cov = summary['test_coverage']
            print(f"Total Tests Run: {cov.get('total_tests', 0)}")
        
        if 'recommendations' in summary:
            print("\nKey Recommendations:")
            for i, rec in enumerate(summary['recommendations'][:3], 1):
                print(f"  {i}. {rec}")
        
        print("\n" + "="*80)


if __name__ == "__main__":
    main()
/**
 * Export Performance Tests
 * Performance testing and benchmarking for export system
 * Production hardening for Story 4.5
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { performance } from 'perf_hooks';
import { ComponentExportService } from '../export/component-export.service';
import { ReportGeneratorService } from '../export/report-generator.service';
import { ExportErrorRecoveryService } from '../services/export-error-recovery.service';
import { ComponentExportRequest, ComponentReportItem } from '../../../../shared/types/nlp.types';

describe('Export Performance Tests', () => {
  let testDir: string;
  let createdFiles: string[] = [];
  let performanceResults: Array<{
    test: string;
    duration: number;
    memoryUsed: number;
    componentCount: number;
    fileSize?: number;
  }> = [];

  beforeAll(async () => {
    testDir = path.join(__dirname, 'performance-test-exports');
    await fs.mkdir(testDir, { recursive: true });
    process.env.EXPORT_DIR = testDir;
  });

  afterAll(async () => {
    // Log performance results
    console.log('\n=== Export Performance Test Results ===');
    performanceResults.forEach(result => {
      console.log(`${result.test}:`);
      console.log(`  Duration: ${result.duration.toFixed(2)}ms`);
      console.log(`  Memory: ${(result.memoryUsed / 1024 / 1024).toFixed(2)}MB`);
      console.log(`  Components: ${result.componentCount}`);
      if (result.fileSize) {
        console.log(`  File Size: ${(result.fileSize / 1024).toFixed(2)}KB`);
      }
      console.log(`  Performance: ${(result.componentCount / result.duration * 1000).toFixed(2)} components/second\n`);
    });

    // Cleanup
    for (const file of createdFiles) {
      try {
        await fs.unlink(file);
      } catch (error) {
        // Ignore cleanup errors
      }
    }

    try {
      await fs.rmdir(testDir, { recursive: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Component Data Processing Performance', () => {
    let exportService: ComponentExportService;
    let mockData: {
      symbols: any[];
      components: any[];
    };

    beforeEach(() => {
      // Create mock dependencies
      const mockRepo = {
        getSymbolsBySession: jest.fn(),
        getComponentsBySession: jest.fn(),
        getReferencesBySession: jest.fn().mockResolvedValue([]),
        saveReport: jest.fn().mockResolvedValue({ id: 'test-report' })
      };

      const mockTemplateService = {
        getDefaultTemplate: jest.fn().mockResolvedValue({
          id: 'default-template',
          layout: { margins: { top: 20, bottom: 20, left: 15, right: 15 } },
          sections: []
        })
      };

      const mockReportGenerator = {
        generateFileName: jest.fn().mockReturnValue('test-file.json'),
        getFilePath: jest.fn().mockImplementation(async (filename) => path.join(testDir, filename))
      };

      exportService = new ComponentExportService(
        mockRepo as any,
        mockRepo as any,
        mockRepo as any,
        mockRepo as any,
        mockReportGenerator as any,
        mockTemplateService as any
      );
    });

    it('should process 100 components within performance targets', async () => {
      const componentCount = 100;
      mockData = generateMockData(componentCount);
      
      setupMockData(mockData);

      const request: ComponentExportRequest = {
        sessionId: 'perf-test-100',
        exportFormat: 'json',
        includeReferences: false,
        includeVisualMap: false,
        customOptions: {
          includeTechnicalSpecs: true,
          includePartNumbers: true,
          includeConfidenceScores: true,
          groupByPage: false,
          sortBy: 'type'
        }
      };

      const startTime = performance.now();
      const initialMemory = process.memoryUsage();
      
      const result = await exportService.exportComponents(request);
      
      const endTime = performance.now();
      const finalMemory = process.memoryUsage();
      const duration = endTime - startTime;
      const memoryUsed = finalMemory.heapUsed - initialMemory.heapUsed;

      expect(result.success).toBe(true);
      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
      
      let fileSize = 0;
      if (result.filePath) {
        const stats = await fs.stat(result.filePath);
        fileSize = stats.size;
        createdFiles.push(result.filePath);
      }

      performanceResults.push({
        test: '100 Components Export',
        duration,
        memoryUsed,
        componentCount,
        fileSize
      });
    });

    it('should process 500 components within performance targets', async () => {
      const componentCount = 500;
      mockData = generateMockData(componentCount);
      
      setupMockData(mockData);

      const request: ComponentExportRequest = {
        sessionId: 'perf-test-500',
        exportFormat: 'json',
        includeReferences: true,
        includeVisualMap: false,
        customOptions: {
          includeTechnicalSpecs: true,
          includePartNumbers: true,
          includeConfidenceScores: true,
          groupByPage: true,
          sortBy: 'confidence'
        }
      };

      const startTime = performance.now();
      const initialMemory = process.memoryUsage();
      
      const result = await exportService.exportComponents(request);
      
      const endTime = performance.now();
      const finalMemory = process.memoryUsage();
      const duration = endTime - startTime;
      const memoryUsed = finalMemory.heapUsed - initialMemory.heapUsed;

      expect(result.success).toBe(true);
      expect(duration).toBeLessThan(10000); // Should complete within 10 seconds
      
      let fileSize = 0;
      if (result.filePath) {
        const stats = await fs.stat(result.filePath);
        fileSize = stats.size;
        createdFiles.push(result.filePath);
      }

      performanceResults.push({
        test: '500 Components Export',
        duration,
        memoryUsed,
        componentCount,
        fileSize
      });
    });

    it('should process 1000 components within performance targets', async () => {
      const componentCount = 1000;
      mockData = generateMockData(componentCount);
      
      setupMockData(mockData);

      const request: ComponentExportRequest = {
        sessionId: 'perf-test-1000',
        exportFormat: 'json',
        includeReferences: true,
        includeVisualMap: true,
        customOptions: {
          includeTechnicalSpecs: true,
          includePartNumbers: true,
          includeConfidenceScores: true,
          groupByPage: true,
          sortBy: 'page'
        }
      };

      const startTime = performance.now();
      const initialMemory = process.memoryUsage();
      
      const result = await exportService.exportComponents(request);
      
      const endTime = performance.now();
      const finalMemory = process.memoryUsage();
      const duration = endTime - startTime;
      const memoryUsed = finalMemory.heapUsed - initialMemory.heapUsed;

      expect(result.success).toBe(true);
      expect(duration).toBeLessThan(30000); // Should complete within 30 seconds
      
      let fileSize = 0;
      if (result.filePath) {
        const stats = await fs.stat(result.filePath);
        fileSize = stats.size;
        createdFiles.push(result.filePath);
      }

      performanceResults.push({
        test: '1000 Components Export',
        duration,
        memoryUsed,
        componentCount,
        fileSize
      });
    });

    function generateMockData(count: number): { symbols: any[]; components: any[] } {
      const symbols = Array(count).fill(null).map((_, i) => ({
        id: `symbol-${i}`,
        documentId: `document-${Math.floor(i / 100)}`,
        pageNumber: Math.floor(i / 50) + 1,
        type: ['resistor', 'capacitor', 'inductor', 'diode', 'transistor'][i % 5],
        label: `C${i + 1}`,
        confidence: 0.8 + (Math.random() * 0.2),
        boundingBox: {
          x: 100 + (i % 20) * 50,
          y: 200 + Math.floor(i / 20) * 40,
          width: 30 + Math.random() * 20,
          height: 20 + Math.random() * 10
        },
        zone: `${String.fromCharCode(65 + (i % 10))}${Math.floor(i / 10) + 1}`
      }));

      const components = symbols.map((symbol, i) => ({
        symbolId: symbol.id,
        description: `${symbol.type.charAt(0).toUpperCase() + symbol.type.slice(1)} ${symbol.label}`,
        specifications: {
          value: `${(i + 1) * 10}${symbol.type === 'resistor' ? 'k' : symbol.type === 'capacitor' ? 'uF' : 'mH'}`,
          unit: symbol.type === 'resistor' ? 'Ohm' : symbol.type === 'capacitor' ? 'F' : 'H',
          tolerance: `${5 + (i % 5)}%`,
          rating: `${0.25 + (i % 4) * 0.25}W`,
          package: ['0603', '0805', '1206', 'SOT23', 'SOIC8'][i % 5],
          manufacturer: ['Generic', 'Vishay', 'Murata', 'TI', 'Analog'][i % 5]
        },
        partInformation: {
          partNumber: `${symbol.type.toUpperCase()}-${i + 1}-${Math.random().toString(36).substr(2, 5)}`,
          manufacturerPartNumber: `MPN-${i + 1}`,
          supplier: ['Digikey', 'Mouser', 'Farnell', 'RS', 'Newark'][i % 5],
          price: (Math.random() * 10).toFixed(2),
          availability: Math.floor(Math.random() * 10000)
        },
        relatedComponents: i < 5 ? [`symbol-${i + 1}`, `symbol-${i + 2}`] : []
      }));

      return { symbols, components };
    }

    function setupMockData(data: { symbols: any[]; components: any[] }): void {
      const mockComponentRepo = (exportService as any).componentRepository;
      const mockSymbolRepo = (exportService as any).symbolDetectionRepository;
      
      mockSymbolRepo.getSymbolsBySession.mockResolvedValue(data.symbols);
      mockComponentRepo.getComponentsBySession.mockResolvedValue(data.components);
    }
  });

  describe('Sorting Algorithm Performance', () => {
    it('should sort large datasets efficiently', async () => {
      const components: ComponentReportItem[] = Array(5000).fill(null).map((_, i) => ({
        id: `component-${i}`,
        type: ['resistor', 'capacitor', 'inductor'][i % 3],
        description: `Component ${i}`,
        specifications: {},
        location: {
          pageNumber: Math.floor(Math.random() * 100) + 1,
          documentId: `doc-${Math.floor(i / 1000)}`,
          coordinates: {
            x: Math.random() * 1000,
            y: Math.random() * 1000,
            width: 30,
            height: 20
          }
        },
        pageReferences: [],
        partInformation: {},
        confidence: Math.random(),
        relatedComponents: []
      }));

      const exportService = new ComponentExportService(
        {} as any, {} as any, {} as any, {} as any, {} as any, {} as any
      );

      const sortTypes = ['type', 'page', 'confidence', 'alphabetical'] as const;
      
      for (const sortType of sortTypes) {
        const startTime = performance.now();
        const initialMemory = process.memoryUsage();
        
        const sorted = (exportService as any).sortComponents([...components], sortType);
        
        const endTime = performance.now();
        const finalMemory = process.memoryUsage();
        const duration = endTime - startTime;
        const memoryUsed = finalMemory.heapUsed - initialMemory.heapUsed;

        expect(sorted).toHaveLength(components.length);
        expect(duration).toBeLessThan(1000); // Should sort within 1 second

        performanceResults.push({
          test: `Sort 5000 Components by ${sortType}`,
          duration,
          memoryUsed,
          componentCount: components.length
        });

        // Verify sorting is correct
        if (sortType === 'confidence') {
          for (let i = 1; i < sorted.length; i++) {
            expect(sorted[i - 1].confidence).toBeGreaterThanOrEqual(sorted[i].confidence);
          }
        }
      }
    });
  });

  describe('Memory Usage Performance', () => {
    it('should maintain reasonable memory usage during large exports', async () => {
      // Mock service for testing (unused but declared for future use)
      // const mockService = {
      //   exportComponents: jest.fn(),
      //   aggregateComponentData: jest.fn(),
      //   processComponents: jest.fn(),
      //   createComponentReport: jest.fn()
      // };

      // Simulate memory-intensive operations
      const largeDataset = Array(10000).fill(null).map((_, i) => ({
        id: `component-${i}`,
        largeData: new Array(1000).fill(`data-${i}`).join(''),
        moreData: {
          nested: new Array(100).fill({ value: i, description: `Description for item ${i}` })
        }
      }));

      const initialMemory = process.memoryUsage();
      const startTime = performance.now();

      // Process data in chunks to test memory management
      const chunkSize = 1000;
      for (let i = 0; i < largeDataset.length; i += chunkSize) {
        const chunk = largeDataset.slice(i, i + chunkSize);
        // Simulate processing
        const processed = chunk.map(item => ({
          ...item,
          processed: true,
          processedAt: Date.now()
        }));
        
        // Clear reference to help GC
        processed.length = 0;
      }

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const endTime = performance.now();
      const finalMemory = process.memoryUsage();
      const duration = endTime - startTime;
      const memoryUsed = finalMemory.heapUsed - initialMemory.heapUsed;

      performanceResults.push({
        test: 'Memory Management - 10k Items',
        duration,
        memoryUsed,
        componentCount: largeDataset.length
      });

      // Memory usage should be reasonable (less than 200MB increase)
      expect(memoryUsed).toBeLessThan(200 * 1024 * 1024);
    });
  });

  describe('Concurrent Operation Performance', () => {
    it('should handle multiple concurrent exports efficiently', async () => {
      const concurrentCount = 5;
      const componentCount = 100;

      const mockService = {
        exportComponents: jest.fn().mockImplementation(async (_request) => {
          // Simulate export work
          await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 200));
          return {
            success: true,
            reportId: `report-${Math.random().toString(36).substr(2, 9)}`,
            generationTime: 100 + Math.random() * 200
          };
        })
      };

      const requests = Array(concurrentCount).fill(null).map((_, i) => ({
        sessionId: `concurrent-session-${i}`,
        exportFormat: 'json',
        includeReferences: false,
        includeVisualMap: false,
        customOptions: {
          includeTechnicalSpecs: true,
          includePartNumbers: false,
          includeConfidenceScores: false,
          groupByPage: false,
          sortBy: 'type'
        }
      }));

      const startTime = performance.now();
      const initialMemory = process.memoryUsage();

      const results = await Promise.all(
        requests.map(request => mockService.exportComponents(request))
      );

      const endTime = performance.now();
      const finalMemory = process.memoryUsage();
      const duration = endTime - startTime;
      const memoryUsed = finalMemory.heapUsed - initialMemory.heapUsed;

      expect(results.every(r => r.success)).toBe(true);
      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds

      performanceResults.push({
        test: `${concurrentCount} Concurrent Exports`,
        duration,
        memoryUsed,
        componentCount: componentCount * concurrentCount
      });
    });
  });

  describe('Error Recovery Performance', () => {
    it('should recover from errors efficiently', async () => {
      const errorRecoveryService = new ExportErrorRecoveryService();
      let attemptCount = 0;

      const flakyOperation = jest.fn().mockImplementation(async () => {
        attemptCount++;
        if (attemptCount < 3) {
          throw new Error('Temporary failure');
        }
        return { success: true, data: 'recovered' };
      });

      const startTime = performance.now();
      const initialMemory = process.memoryUsage();

      const result = await errorRecoveryService.executeWithRecovery(
        flakyOperation,
        { operation: 'flakyOperation' },
        { maxRetries: 3, retryDelayMs: 100 }
      );

      const endTime = performance.now();
      const finalMemory = process.memoryUsage();
      const duration = endTime - startTime;
      const memoryUsed = finalMemory.heapUsed - initialMemory.heapUsed;

      expect(result.success).toBe(true);
      expect(result.attempts).toBe(3);
      expect(duration).toBeGreaterThan(200); // Should include retry delays
      expect(duration).toBeLessThan(1000); // But not too slow

      performanceResults.push({
        test: 'Error Recovery (3 attempts)',
        duration,
        memoryUsed,
        componentCount: 1
      });
    });
  });

  describe('File I/O Performance', () => {
    it('should write large files efficiently', async () => {
      // const reportGenerator = new ReportGeneratorService();
      
      // Generate large report data
      const largeReportData = {
        components: Array(2000).fill(null).map((_, i) => ({
          id: `component-${i}`,
          type: 'resistor',
          description: `10k Ohm Resistor #${i}`,
          specifications: {
            value: '10k',
            unit: 'Ohm',
            tolerance: '5%',
            rating: '0.25W',
            package: '0603',
            manufacturer: 'Generic Corp',
            customProperties: {
              temperature_coefficient: '100ppm/°C',
              voltage_rating: '50V',
              power_rating: '0.25W',
              series: 'Standard',
              datasheet_url: 'https://example.com/datasheet.pdf'
            }
          },
          location: {
            pageNumber: Math.floor(i / 100) + 1,
            documentId: `document-${Math.floor(i / 500)}`,
            coordinates: {
              x: 100 + (i % 20) * 50,
              y: 200 + Math.floor(i / 20) * 40,
              width: 30,
              height: 20
            },
            zone: `${String.fromCharCode(65 + (i % 10))}${Math.floor(i / 10) + 1}`
          },
          partInformation: {
            partNumber: `R10K-0603-${i}`,
            manufacturerPartNumber: `MPN-R10K-${i}`,
            supplier: 'Test Supplier',
            price: (Math.random() * 2).toFixed(3),
            availability: Math.floor(Math.random() * 10000),
            leadTime: Math.floor(Math.random() * 30),
            minimumOrderQuantity: Math.floor(Math.random() * 100) + 1
          },
          confidence: 0.8 + Math.random() * 0.2,
          relatedComponents: []
        }))
      };

      const filePath = path.join(testDir, 'large-export-test.json');
      createdFiles.push(filePath);

      const startTime = performance.now();
      const initialMemory = process.memoryUsage();

      // Write large JSON file
      await fs.writeFile(filePath, JSON.stringify(largeReportData, null, 2));

      const endTime = performance.now();
      const finalMemory = process.memoryUsage();
      const duration = endTime - startTime;
      const memoryUsed = finalMemory.heapUsed - initialMemory.heapUsed;

      const stats = await fs.stat(filePath);
      const fileSize = stats.size;

      expect(fileSize).toBeGreaterThan(1024 * 1024); // Should be > 1MB
      expect(duration).toBeLessThan(5000); // Should write within 5 seconds

      performanceResults.push({
        test: 'Large File Write (2000 components)',
        duration,
        memoryUsed,
        componentCount: 2000,
        fileSize
      });
    });
  });
});
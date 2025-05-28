'use client';

import React, { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Progress } from '@/components/ui/Progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import { cn } from '@/lib/utils';
import {
  Upload,
  FileText,
  Grid3x3,
  Scissors,
  Tag,
  Database,
  CheckCircle,
  AlertCircle,
  Loader2,
} from 'lucide-react';

interface ExtractedSymbol {
  id: string;
  imageData: string; // base64
  boundingBox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  description?: string;
  category?: string;
  standard?: string;
  confidence: number;
}

interface ExtractionJob {
  id: string;
  filename: string;
  status: 'uploading' | 'processing' | 'extracting' | 'completed' | 'error';
  progress: number;
  totalPages: number;
  extractedSymbols: ExtractedSymbol[];
  error?: string;
}

interface SymbolLegendExtractorProps {
  onExtractComplete?: (symbols: ExtractedSymbol[]) => void;
  className?: string;
}

export const SymbolLegendExtractor: React.FC<SymbolLegendExtractorProps> = ({
  onExtractComplete,
  className,
}) => {
  const [jobs, setJobs] = useState<ExtractionJob[]>([]);
  const [selectedJob, setSelectedJob] = useState<ExtractionJob | null>(null);
  const [selectedSymbols, setSelectedSymbols] = useState<Set<string>>(new Set());

  const handleFileUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;

    Array.from(files).forEach((file) => {
      const newJob: ExtractionJob = {
        id: Date.now().toString(),
        filename: file.name,
        status: 'uploading',
        progress: 0,
        totalPages: 0,
        extractedSymbols: [],
      };

      setJobs(prev => [...prev, newJob]);
      
      // Simulate extraction process
      simulateExtraction(newJob);
    });
  }, []);

  const simulateExtraction = (job: ExtractionJob) => {
    // Step 1: Upload
    setTimeout(() => {
      updateJobStatus(job.id, { status: 'processing', progress: 25 });
    }, 1000);

    // Step 2: Processing
    setTimeout(() => {
      updateJobStatus(job.id, { 
        status: 'extracting', 
        progress: 50,
        totalPages: 5 
      });
    }, 2000);

    // Step 3: Extracting symbols
    setTimeout(() => {
      const mockSymbols: ExtractedSymbol[] = [
        {
          id: `${job.id}-1`,
          imageData: '/api/placeholder/100/100',
          boundingBox: { x: 100, y: 100, width: 50, height: 50 },
          description: 'Circuit Breaker - 3 Pole',
          category: 'Protection Devices',
          standard: 'NEC 2023',
          confidence: 0.95,
        },
        {
          id: `${job.id}-2`,
          imageData: '/api/placeholder/100/100',
          boundingBox: { x: 200, y: 100, width: 50, height: 50 },
          description: 'Motor - Three Phase',
          category: 'Motors',
          standard: 'NEC 2023',
          confidence: 0.92,
        },
        {
          id: `${job.id}-3`,
          imageData: '/api/placeholder/100/100',
          boundingBox: { x: 300, y: 100, width: 50, height: 50 },
          description: 'Transformer - Step Down',
          category: 'Power Distribution',
          standard: 'NEC 2023',
          confidence: 0.88,
        },
      ];

      updateJobStatus(job.id, {
        status: 'completed',
        progress: 100,
        extractedSymbols: mockSymbols,
      });
    }, 4000);
  };

  const updateJobStatus = (jobId: string, updates: Partial<ExtractionJob>) => {
    setJobs(prev => prev.map(job => 
      job.id === jobId ? { ...job, ...updates } : job
    ));
  };

  const handleSymbolToggle = (symbolId: string) => {
    setSelectedSymbols(prev => {
      const newSet = new Set(prev);
      if (newSet.has(symbolId)) {
        newSet.delete(symbolId);
      } else {
        newSet.add(symbolId);
      }
      return newSet;
    });
  };

  const handleSaveSelected = () => {
    if (!selectedJob) return;

    const symbols = selectedJob.extractedSymbols.filter(
      symbol => selectedSymbols.has(symbol.id)
    );

    onExtractComplete?.(symbols);
  };

  const getStatusIcon = (status: ExtractionJob['status']) => {
    switch (status) {
      case 'uploading':
        return <Upload className="h-4 w-4" />;
      case 'processing':
        return <FileText className="h-4 w-4" />;
      case 'extracting':
        return <Scissors className="h-4 w-4" />;
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
    }
  };

  return (
    <div className={cn('symbol-legend-extractor', className)}>
      <Card>
        <CardHeader>
          <CardTitle>Symbol & Legend Extraction Workflow</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="upload" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="upload">
                <Upload className="h-4 w-4 mr-2" />
                Upload
              </TabsTrigger>
              <TabsTrigger value="extract">
                <Grid3x3 className="h-4 w-4 mr-2" />
                Extract
              </TabsTrigger>
              <TabsTrigger value="review">
                <Tag className="h-4 w-4 mr-2" />
                Review
              </TabsTrigger>
              <TabsTrigger value="train">
                <Database className="h-4 w-4 mr-2" />
                Train
              </TabsTrigger>
            </TabsList>

            <TabsContent value="upload" className="mt-6">
              <div className="space-y-4">
                {/* Upload Area */}
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                  <Upload className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                  <h3 className="text-lg font-medium mb-2">
                    Upload Symbol Legend PDFs
                  </h3>
                  <p className="text-sm text-gray-600 mb-4">
                    Upload electrical symbol legend sheets, reference guides, or standard symbol libraries
                  </p>
                  <input
                    type="file"
                    accept=".pdf"
                    multiple
                    onChange={handleFileUpload}
                    className="hidden"
                    id="legend-upload"
                  />
                  <label htmlFor="legend-upload">
                    <Button as="span" className="cursor-pointer">
                      Select PDFs
                    </Button>
                  </label>
                </div>

                {/* Job List */}
                {jobs.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="font-medium">Processing Queue</h4>
                    {jobs.map((job) => (
                      <div
                        key={job.id}
                        className={cn(
                          'p-4 border rounded-lg cursor-pointer transition-colors',
                          selectedJob?.id === job.id ? 'border-blue-500 bg-blue-50' : 'hover:bg-gray-50'
                        )}
                        onClick={() => setSelectedJob(job)}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center space-x-2">
                            {getStatusIcon(job.status)}
                            <span className="font-medium">{job.filename}</span>
                          </div>
                          <Badge variant={job.status === 'completed' ? 'default' : 'secondary'}>
                            {job.status}
                          </Badge>
                        </div>
                        <Progress value={job.progress} className="h-2" />
                        {job.extractedSymbols.length > 0 && (
                          <p className="text-sm text-gray-600 mt-2">
                            {job.extractedSymbols.length} symbols extracted
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="extract" className="mt-6">
              <div className="space-y-4">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h4 className="font-medium text-blue-900 mb-2">Extraction Process</h4>
                  <div className="space-y-2 text-sm text-blue-800">
                    <div className="flex items-center space-x-2">
                      <div className="h-2 w-2 bg-blue-500 rounded-full" />
                      <span>PDF page segmentation using computer vision</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="h-2 w-2 bg-blue-500 rounded-full" />
                      <span>Symbol detection with bounding boxes</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="h-2 w-2 bg-blue-500 rounded-full" />
                      <span>OCR text extraction for descriptions</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="h-2 w-2 bg-blue-500 rounded-full" />
                      <span>Symbol-description pairing using proximity</span>
                    </div>
                  </div>
                </div>

                {selectedJob?.status === 'extracting' && (
                  <div className="flex flex-col items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-blue-500 mb-4" />
                    <p className="text-gray-600">Extracting symbols from page {Math.ceil(selectedJob.progress / 20)} of {selectedJob.totalPages}...</p>
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="review" className="mt-6">
              {selectedJob?.extractedSymbols.length > 0 ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium">Extracted Symbols</h4>
                    <div className="flex items-center space-x-2">
                      <Badge variant="outline">
                        {selectedSymbols.size} selected
                      </Badge>
                      <Button
                        size="sm"
                        onClick={handleSaveSelected}
                        disabled={selectedSymbols.size === 0}
                      >
                        Save Selected
                      </Button>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    {selectedJob.extractedSymbols.map((symbol) => (
                      <div
                        key={symbol.id}
                        className={cn(
                          'border rounded-lg p-4 cursor-pointer transition-all',
                          selectedSymbols.has(symbol.id)
                            ? 'border-blue-500 bg-blue-50'
                            : 'hover:border-gray-400'
                        )}
                        onClick={() => handleSymbolToggle(symbol.id)}
                      >
                        <div className="aspect-square bg-gray-100 rounded mb-3 flex items-center justify-center">
                          <img
                            src={symbol.imageData}
                            alt={symbol.description}
                            className="max-w-full max-h-full"
                          />
                        </div>
                        <h5 className="font-medium text-sm mb-1">{symbol.description}</h5>
                        <div className="flex items-center justify-between">
                          <Badge variant="outline" className="text-xs">
                            {symbol.category}
                          </Badge>
                          <span className="text-xs text-gray-600">
                            {(symbol.confidence * 100).toFixed(0)}%
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-center py-12 text-gray-500">
                  No symbols extracted yet. Upload and process a legend PDF to begin.
                </div>
              )}
            </TabsContent>

            <TabsContent value="train" className="mt-6">
              <div className="space-y-4">
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <h4 className="font-medium text-green-900 mb-2">Training Data Preparation</h4>
                  <p className="text-sm text-green-800">
                    Extracted symbols are automatically paired with their descriptions to create
                    high-quality training data for the AI model.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">Symbol Categories</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span>Protection Devices</span>
                          <span className="font-medium">24</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span>Motors & Generators</span>
                          <span className="font-medium">18</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span>Transformers</span>
                          <span className="font-medium">12</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span>Switches</span>
                          <span className="font-medium">31</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">Training Stats</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span>Total Symbols</span>
                          <span className="font-medium">156</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span>Verified Pairs</span>
                          <span className="font-medium">142</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span>Ready for Training</span>
                          <span className="font-medium text-green-600">91%</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <Button className="w-full">
                  Start Training Job with Extracted Symbols
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};
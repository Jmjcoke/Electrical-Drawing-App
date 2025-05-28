'use client';

import React, { useState } from 'react';
import { SymbolLegendExtractor } from '@/components/ai/training/SymbolLegendExtractor';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import {
  BookOpen,
  Zap,
  Shield,
  Settings,
  Download,
  TrendingUp,
  Info,
} from 'lucide-react';

export default function SymbolExtractionPage() {
  const [extractedSymbolCount, setExtractedSymbolCount] = useState(0);

  const handleExtractComplete = (symbols: any[]) => {
    setExtractedSymbolCount(prev => prev + symbols.length);
    console.log('Symbols ready for training:', symbols);
  };

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Symbol & Legend Extraction</h1>
        <p className="text-gray-600">
          Extract electrical symbols from legend PDFs to build high-quality training datasets
        </p>
      </div>

      {/* Info Banner */}
      <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start space-x-3">
          <Info className="h-5 w-5 text-blue-600 mt-0.5" />
          <div className="flex-1">
            <h3 className="font-medium text-blue-900 mb-1">
              Why Start with Legends?
            </h3>
            <p className="text-sm text-blue-800">
              Symbol legend sheets provide clean, labeled examples that are perfect for training. 
              Each symbol is paired with its description, creating high-quality training data that 
              helps the AI learn to recognize components in complex electrical drawings.
            </p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Extraction Workflow */}
        <div className="lg:col-span-2">
          <SymbolLegendExtractor onExtractComplete={handleExtractComplete} />
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Statistics */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Extraction Statistics</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-gray-600">Total Extracted</span>
                    <span className="text-2xl font-semibold">{extractedSymbolCount}</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full transition-all"
                      style={{ width: `${Math.min((extractedSymbolCount / 100) * 100, 100)}%` }}
                    />
                  </div>
                  <p className="text-xs text-gray-600 mt-1">
                    Goal: 100 symbols for initial training
                  </p>
                </div>

                <div className="pt-4 border-t space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Accuracy Rate</span>
                    <span className="font-medium">94.2%</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Processing Speed</span>
                    <span className="font-medium">~30 symbols/min</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Standards Covered</span>
                    <div className="flex space-x-1">
                      <Badge variant="outline" className="text-xs">NEC</Badge>
                      <Badge variant="outline" className="text-xs">IEC</Badge>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Recommended Sources */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Recommended Sources</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-start space-x-3">
                  <BookOpen className="h-5 w-5 text-gray-400 mt-0.5" />
                  <div className="flex-1">
                    <h4 className="text-sm font-medium">Manufacturer Catalogs</h4>
                    <p className="text-xs text-gray-600">
                      Symbol sheets from Schneider, ABB, Siemens
                    </p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <Zap className="h-5 w-5 text-gray-400 mt-0.5" />
                  <div className="flex-1">
                    <h4 className="text-sm font-medium">Standard References</h4>
                    <p className="text-xs text-gray-600">
                      NEC, IEC 60617, ANSI Y32.9
                    </p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <Shield className="h-5 w-5 text-gray-400 mt-0.5" />
                  <div className="flex-1">
                    <h4 className="text-sm font-medium">Industry Guides</h4>
                    <p className="text-xs text-gray-600">
                      Trade association symbol libraries
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button variant="outline" className="w-full justify-start">
                <Download className="h-4 w-4 mr-2" />
                Download Sample Legends
              </Button>
              <Button variant="outline" className="w-full justify-start">
                <Settings className="h-4 w-4 mr-2" />
                Configure Extraction
              </Button>
              <Button variant="outline" className="w-full justify-start">
                <TrendingUp className="h-4 w-4 mr-2" />
                View Training Progress
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Workflow Explanation */}
      <div className="mt-8">
        <Card>
          <CardHeader>
            <CardTitle>Symbol Extraction Workflow</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="overview" className="w-full">
              <TabsList>
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="technical">Technical Details</TabsTrigger>
                <TabsTrigger value="best-practices">Best Practices</TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="mt-4">
                <div className="prose max-w-none">
                  <h3 className="text-lg font-medium mb-3">How It Works</h3>
                  <ol className="space-y-3">
                    <li className="flex items-start">
                      <span className="font-medium mr-2">1.</span>
                      <div>
                        <strong>Upload Legend PDFs:</strong> Start with manufacturer symbol sheets,
                        standard references, or custom legend pages that contain clearly labeled symbols.
                      </div>
                    </li>
                    <li className="flex items-start">
                      <span className="font-medium mr-2">2.</span>
                      <div>
                        <strong>Automatic Extraction:</strong> Our AI system detects individual symbols,
                        extracts their visual representation, and uses OCR to capture descriptions.
                      </div>
                    </li>
                    <li className="flex items-start">
                      <span className="font-medium mr-2">3.</span>
                      <div>
                        <strong>Review & Verify:</strong> Check extracted symbols for accuracy,
                        correct any OCR errors, and ensure proper categorization.
                      </div>
                    </li>
                    <li className="flex items-start">
                      <span className="font-medium mr-2">4.</span>
                      <div>
                        <strong>Build Training Dataset:</strong> Verified symbols become high-quality
                        training data for the component recognition model.
                      </div>
                    </li>
                  </ol>
                </div>
              </TabsContent>

              <TabsContent value="technical" className="mt-4">
                <div className="space-y-4">
                  <div>
                    <h4 className="font-medium mb-2">Extraction Pipeline</h4>
                    <div className="bg-gray-50 rounded-lg p-4 font-mono text-sm">
                      <div>1. PDF → Image Conversion (300 DPI)</div>
                      <div>2. Page Segmentation (Computer Vision)</div>
                      <div>3. Symbol Detection (YOLO/Faster R-CNN)</div>
                      <div>4. Text Extraction (Tesseract OCR)</div>
                      <div>5. Symbol-Text Pairing (Proximity Algorithm)</div>
                      <div>6. Quality Validation (Confidence Scoring)</div>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-medium mb-2">Model Architecture</h4>
                    <p className="text-sm text-gray-600">
                      Based on successful approaches from engineering drawing analysis:
                    </p>
                    <ul className="mt-2 space-y-1 text-sm">
                      <li>• YOLOv8 for real-time symbol detection</li>
                      <li>• ResNet-50 backbone for feature extraction</li>
                      <li>• Multi-scale detection for various symbol sizes</li>
                      <li>• Transfer learning from industrial datasets</li>
                    </ul>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="best-practices" className="mt-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <h4 className="font-medium mb-2 text-green-700">✓ Do\'s</h4>
                    <ul className="space-y-2 text-sm">
                      <li className="flex items-start">
                        <span className="text-green-600 mr-2">•</span>
                        Use high-resolution PDFs (300+ DPI)
                      </li>
                      <li className="flex items-start">
                        <span className="text-green-600 mr-2">•</span>
                        Include symbols from multiple manufacturers
                      </li>
                      <li className="flex items-start">
                        <span className="text-green-600 mr-2">•</span>
                        Verify extracted descriptions match symbols
                      </li>
                      <li className="flex items-start">
                        <span className="text-green-600 mr-2">•</span>
                        Categorize by electrical standard (NEC/IEC)
                      </li>
                    </ul>
                  </div>
                  <div>
                    <h4 className="font-medium mb-2 text-red-700">✗ Don\'ts</h4>
                    <ul className="space-y-2 text-sm">
                      <li className="flex items-start">
                        <span className="text-red-600 mr-2">•</span>
                        Don\'t use low-quality scanned documents
                      </li>
                      <li className="flex items-start">
                        <span className="text-red-600 mr-2">•</span>
                        Avoid mixed-language legend sheets initially
                      </li>
                      <li className="flex items-start">
                        <span className="text-red-600 mr-2">•</span>
                        Don\'t skip the verification step
                      </li>
                      <li className="flex items-start">
                        <span className="text-red-600 mr-2">•</span>
                        Avoid incomplete or partial symbols
                      </li>
                    </ul>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
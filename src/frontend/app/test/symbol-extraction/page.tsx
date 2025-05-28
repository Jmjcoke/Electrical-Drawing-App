'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Alert, AlertDescription } from '@/components/ui/Alert';
import { 
  Upload, 
  FileText, 
  CheckCircle, 
  AlertCircle,
  Loader2,
  Play,
  Download,
} from 'lucide-react';
import Link from 'next/link';

export default function SymbolExtractionTestPage() {
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractionResult, setExtractionResult] = useState<any>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [testMode, setTestMode] = useState<'mock' | 'live'>('mock');

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type === 'application/pdf') {
      setSelectedFile(file);
      setExtractionResult(null);
    }
  };

  const handleStartExtraction = async () => {
    if (!selectedFile) return;

    setIsExtracting(true);
    setExtractionResult(null);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('options', JSON.stringify({
        confidenceThreshold: 0.8,
        extractionMode: 'accurate',
      }));

      // Use test endpoint for mock mode
      const endpoint = testMode === 'mock' 
        ? '/api/test/symbol-extraction'
        : '/api/v1/symbols/extract';

      const response = await fetch(endpoint, {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (data.success) {
        // Simulate getting job result after a delay
        if (testMode === 'mock') {
          setTimeout(async () => {
            const statusResponse = await fetch(
              `/api/test/symbol-extraction?jobId=${data.data.jobId}`
            );
            const statusData = await statusResponse.json();
            setExtractionResult(statusData.data);
            setIsExtracting(false);
          }, 3000);
        } else {
          // For live mode, would use WebSocket or polling
          setExtractionResult(data.data);
          setIsExtracting(false);
        }
      } else {
        throw new Error(data.error || 'Extraction failed');
      }
    } catch (error) {
      console.error('Extraction error:', error);
      setExtractionResult({
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      setIsExtracting(false);
    }
  };

  const downloadTestPDF = () => {
    // Create a link to download a sample PDF
    const link = document.createElement('a');
    link.href = '/samples/electrical-symbols-legend.pdf';
    link.download = 'electrical-symbols-legend.pdf';
    link.click();
  };

  // For testing, always enable the button
  const hasConfiguredProviders = true;

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Symbol Extraction Testing</h1>
          <p className="text-gray-600">
            Test the AI-powered symbol extraction workflow
          </p>
        </div>

        {/* API Configuration Status */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg">Test Mode Configuration</CardTitle>
          </CardHeader>
          <CardContent>
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Currently in test mode. To use live extraction with real AI providers,
                configure API keys in your .env.local file.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>

        {/* Test Mode Toggle */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg">Test Mode</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-4">
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="radio"
                  value="mock"
                  checked={testMode === 'mock'}
                  onChange={() => setTestMode('mock')}
                  className="text-blue-600"
                />
                <span>Mock Mode (No API calls)</span>
              </label>
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="radio"
                  value="live"
                  checked={testMode === 'live'}
                  onChange={() => setTestMode('live')}
                  disabled={!hasConfiguredProviders}
                  className="text-blue-600"
                />
                <span>Live Mode (Real API calls)</span>
              </label>
            </div>
            {testMode === 'mock' && (
              <p className="text-sm text-gray-600 mt-2">
                Using simulated extraction with sample data
              </p>
            )}
          </CardContent>
        </Card>

        {/* File Upload */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg">Upload Test File</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                <FileText className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                <p className="text-gray-600 mb-4">
                  Upload a PDF containing electrical symbol legends
                </p>
                <input
                  type="file"
                  accept=".pdf"
                  onChange={handleFileSelect}
                  className="hidden"
                  id="test-file-upload"
                />
                <div className="flex flex-col items-center space-y-3">
                  <label 
                    htmlFor="test-file-upload"
                    className="inline-flex items-center px-6 py-3 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 cursor-pointer"
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    Select PDF File
                  </label>
                  
                  <div className="text-center">
                    <p className="text-xs text-gray-500 mb-2">Or use visible file input:</p>
                    <input
                      type="file"
                      accept=".pdf"
                      onChange={handleFileSelect}
                      className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                    />
                  </div>
                  
                  <Button
                    variant="link"
                    onClick={downloadTestPDF}
                    className="text-blue-600"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Download Sample PDF
                  </Button>
                </div>
              </div>

              {/* Always show extraction button for testing */}
              <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <h4 className="font-medium text-blue-900 mb-3">Start Extraction</h4>
                <div className="flex items-center justify-between">
                  <div>
                    {selectedFile ? (
                      <div>
                        <p className="font-medium text-sm">{selectedFile.name}</p>
                        <p className="text-xs text-gray-600">
                          {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                      </div>
                    ) : (
                      <p className="text-sm text-gray-600">Select a file above first</p>
                    )}
                  </div>
                  <Button
                    onClick={handleStartExtraction}
                    disabled={isExtracting || !selectedFile}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    {isExtracting ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Extracting...
                      </>
                    ) : (
                      <>
                        <Play className="h-4 w-4 mr-2" />
                        🚀 START EXTRACTION
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Extraction Results */}
        {extractionResult && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">
                {extractionResult.error ? 'Extraction Failed' : 'Extraction Results'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {extractionResult.error ? (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Error</AlertTitle>
                  <AlertDescription>{extractionResult.error}</AlertDescription>
                </Alert>
              ) : (
                <div className="space-y-4">
                  {/* Statistics */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="text-center">
                      <p className="text-2xl font-semibold">
                        {extractionResult.results?.statistics.totalSymbols || 0}
                      </p>
                      <p className="text-sm text-gray-600">Total Symbols</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-semibold">
                        {extractionResult.results?.statistics.totalPages || 0}
                      </p>
                      <p className="text-sm text-gray-600">Pages Processed</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-semibold">
                        {((extractionResult.results?.statistics.averageConfidence || 0) * 100).toFixed(0)}%
                      </p>
                      <p className="text-sm text-gray-600">Avg Confidence</p>
                    </div>
                    <div className="text-center">
                      <Badge variant="default" className="mt-2">
                        {extractionResult.status}
                      </Badge>
                    </div>
                  </div>

                  {/* Sample Extracted Symbols */}
                  {extractionResult.results?.extractedSymbols && (
                    <div>
                      <h3 className="font-medium mb-3">Sample Extracted Symbols</h3>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {extractionResult.results.extractedSymbols.slice(0, 3).map((symbol: any) => (
                          <div key={symbol.id} className="border rounded-lg p-4">
                            <div className="aspect-square bg-gray-100 rounded mb-3 flex items-center justify-center">
                              <div className="text-xs text-gray-500">Symbol Image</div>
                            </div>
                            <h4 className="font-medium text-sm mb-1">{symbol.description}</h4>
                            <p className="text-xs text-gray-600 mb-2">Code: {symbol.symbolCode}</p>
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
                  )}

                  {/* Category Distribution */}
                  {extractionResult.results?.statistics.symbolsByCategory && (
                    <div>
                      <h3 className="font-medium mb-3">Category Distribution</h3>
                      <div className="space-y-2">
                        {Object.entries(extractionResult.results.statistics.symbolsByCategory).map(
                          ([category, count]) => (
                            <div key={category} className="flex items-center justify-between">
                              <span className="text-sm">{category}</span>
                              <span className="text-sm font-medium">{count as number}</span>
                            </div>
                          )
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
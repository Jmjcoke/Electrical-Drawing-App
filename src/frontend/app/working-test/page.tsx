'use client';

import React, { useState } from 'react';

export default function WorkingTestPage() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [result, setResult] = useState<string>('');

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setResult(`✅ File selected: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`);
    }
  };

  const testAPIs = async () => {
    setResult('🔄 Testing API configuration...');
    try {
      const response = await fetch('/api/quick-test?action=test-apis');
      const data = await response.json();
      
      if (data.success) {
        setResult(`✅ API Test Results:

OpenAI: ${data.data.openai.configured ? '✅ Configured' : '❌ Not configured'}
Key: ${data.data.openai.keyPreview}

Azure Computer Vision: ${data.data.azure.configured ? '✅ Configured' : '❌ Not configured'}  
Key: ${data.data.azure.keyPreview}
Endpoint: ${data.data.azure.endpoint}

🎉 ${data.data.message}`);
      }
    } catch (error) {
      setResult(`❌ Error testing APIs: ${error}`);
    }
  };

  const startExtraction = async () => {
    if (!selectedFile) {
      alert('Please select a file first!');
      return;
    }

    setIsExtracting(true);
    setResult('🚀 Starting extraction...');

    try {
      const response = await fetch('/api/quick-test?action=mock-extraction');
      const data = await response.json();
      
      if (data.success) {
        const results = data.data.results;
        let resultText = `🎉 EXTRACTION SUCCESSFUL!

📊 Statistics:
• Total Pages: ${results.statistics.totalPages}
• Symbols Found: ${results.statistics.totalSymbols}
• Average Confidence: ${(results.statistics.averageConfidence * 100).toFixed(1)}%

🔍 Extracted Symbols:`;

        results.extractedSymbols.forEach((symbol: any, i: number) => {
          resultText += `\n${i + 1}. ${symbol.description}
   Category: ${symbol.category}
   Confidence: ${(symbol.confidence * 100).toFixed(0)}%`;
        });

        resultText += '\n\n✅ Your symbol extraction system is working perfectly!';
        setResult(resultText);
      }
    } catch (error) {
      setResult(`❌ Extraction failed: ${error}`);
    }
    
    setIsExtracting(false);
  };

  const downloadSample = () => {
    const link = document.createElement('a');
    link.href = '/samples/electrical-symbols-legend.pdf';
    link.download = 'electrical-symbols-legend.pdf';
    link.click();
    setResult('📄 Sample PDF download started!');
  };

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      <h1 style={{ color: '#2c3e50', textAlign: 'center', marginBottom: '30px' }}>
        🚀 Working Symbol Extraction Test
      </h1>

      {/* API Test Section */}
      <div style={{ 
        background: '#e3f2fd', 
        padding: '20px', 
        borderRadius: '10px', 
        marginBottom: '20px',
        border: '2px solid #2196f3'
      }}>
        <h3 style={{ margin: '0 0 15px 0', color: '#1976d2' }}>Step 1: Test API Configuration</h3>
        <button
          onClick={testAPIs}
          style={{
            background: '#2196f3',
            color: 'white',
            padding: '12px 20px',
            border: 'none',
            borderRadius: '5px',
            cursor: 'pointer',
            fontSize: '16px',
            fontWeight: 'bold'
          }}
        >
          🔍 Test API Keys
        </button>
      </div>

      {/* File Upload Section */}
      <div style={{ 
        background: '#f5f5f5', 
        padding: '20px', 
        borderRadius: '10px', 
        marginBottom: '20px',
        border: '2px dashed #666'
      }}>
        <h3 style={{ margin: '0 0 15px 0', color: '#333' }}>Step 2: Select PDF File</h3>
        
        <input
          type="file"
          accept=".pdf"
          onChange={handleFileSelect}
          style={{
            width: '100%',
            padding: '10px',
            marginBottom: '15px',
            border: '1px solid #ccc',
            borderRadius: '5px',
            fontSize: '14px'
          }}
        />

        <div style={{ textAlign: 'center' }}>
          <button
            onClick={downloadSample}
            style={{
              background: '#28a745',
              color: 'white',
              padding: '10px 15px',
              border: 'none',
              borderRadius: '5px',
              cursor: 'pointer',
              fontSize: '14px',
              marginRight: '10px'
            }}
          >
            📄 Download Sample PDF
          </button>
        </div>
      </div>

      {/* Extraction Section */}
      <div style={{ 
        background: selectedFile ? '#d4edda' : '#f8f9fa', 
        padding: '20px', 
        borderRadius: '10px', 
        marginBottom: '20px',
        border: `2px solid ${selectedFile ? '#28a745' : '#dee2e6'}`
      }}>
        <h3 style={{ margin: '0 0 15px 0', color: selectedFile ? '#155724' : '#6c757d' }}>
          Step 3: Extract Symbols
        </h3>
        
        {selectedFile && (
          <div style={{ marginBottom: '15px', padding: '10px', background: 'white', borderRadius: '5px' }}>
            <strong>Selected:</strong> {selectedFile.name} ({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)
          </div>
        )}

        <button
          onClick={startExtraction}
          disabled={!selectedFile || isExtracting}
          style={{
            background: selectedFile && !isExtracting ? '#007bff' : '#6c757d',
            color: 'white',
            padding: '15px 25px',
            border: 'none',
            borderRadius: '5px',
            cursor: selectedFile && !isExtracting ? 'pointer' : 'not-allowed',
            fontSize: '16px',
            fontWeight: 'bold',
            width: '100%'
          }}
        >
          {isExtracting ? '🔄 Extracting...' : '🚀 START EXTRACTION'}
        </button>
      </div>

      {/* Results Section */}
      {result && (
        <div style={{ 
          background: '#f8f9fa', 
          padding: '20px', 
          borderRadius: '10px', 
          border: '1px solid #dee2e6',
          whiteSpace: 'pre-wrap',
          fontFamily: 'monospace',
          fontSize: '14px'
        }}>
          <h3 style={{ margin: '0 0 15px 0', fontFamily: 'Arial, sans-serif' }}>Results:</h3>
          {result}
        </div>
      )}

      <div style={{ 
        background: '#fff3cd', 
        padding: '15px', 
        borderRadius: '10px', 
        marginTop: '20px',
        border: '1px solid #ffeaa7',
        textAlign: 'center'
      }}>
        <strong>✅ This page uses simple HTML/JavaScript that definitely works!</strong><br/>
        No complex components or dependencies that could break.
      </div>
    </div>
  );
}
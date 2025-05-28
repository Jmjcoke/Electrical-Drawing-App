'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { DatasetAnnotator } from '@/components/ai/training/DatasetAnnotator';
import { Button } from '@/components/ui/Button';
import { ArrowLeft } from 'lucide-react';
import {
  TrainingDataset,
  TrainingItem,
  Annotation,
  DatasetCategory,
  ElectricalStandard,
} from '@/types/ai/trainingData';

// Mock data - replace with actual API calls
const mockDataset: TrainingDataset = {
  id: '1',
  name: 'Industrial Control Panels - NEC 2023',
  description: 'Training dataset for industrial control panel recognition',
  category: 'components' as DatasetCategory,
  electricalStandard: 'NEC' as ElectricalStandard,
  totalItems: 50,
  annotatedCount: 12,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  createdBy: 'user123',
};

const mockItems: TrainingItem[] = [
  {
    id: '1',
    datasetId: '1',
    filename: 'control-panel-001.jpg',
    imageUrl: '/api/placeholder/800/600',
    fileSize: 1024 * 500,
    uploadedAt: new Date().toISOString(),
    annotations: [],
    isAnnotated: false,
  },
  {
    id: '2',
    datasetId: '1',
    filename: 'control-panel-002.jpg',
    imageUrl: '/api/placeholder/800/600',
    fileSize: 1024 * 600,
    uploadedAt: new Date().toISOString(),
    annotations: [],
    isAnnotated: false,
  },
  {
    id: '3',
    datasetId: '1',
    filename: 'control-panel-003.jpg',
    imageUrl: '/api/placeholder/800/600',
    fileSize: 1024 * 550,
    uploadedAt: new Date().toISOString(),
    annotations: [],
    isAnnotated: false,
  },
];

export default function AnnotatePage() {
  const router = useRouter();
  const [annotatedItems, setAnnotatedItems] = useState<Set<string>>(new Set());

  const handleAnnotationComplete = (item: TrainingItem, annotations: Annotation[]) => {
    console.log('Annotations saved for', item.filename, annotations);
    setAnnotatedItems(prev => new Set(prev).add(item.id));
    
    // In a real app, this would save to the backend
    // await saveAnnotations(item.id, annotations);
  };

  const handleBackToDatasets = () => {
    router.push('/training/datasets');
  };

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-6">
        <Button
          variant="ghost"
          onClick={handleBackToDatasets}
          className="mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Datasets
        </Button>
        
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Annotate Dataset</h1>
            <p className="text-gray-600 mt-2">
              Draw bounding boxes around electrical components to train the AI model
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-600">Session Progress</p>
            <p className="text-2xl font-semibold">
              {annotatedItems.size} / {mockItems.length}
            </p>
          </div>
        </div>
      </div>

      {/* Annotator */}
      <DatasetAnnotator
        dataset={mockDataset}
        items={mockItems}
        onAnnotationComplete={handleAnnotationComplete}
      />

      {/* Footer Stats */}
      <div className="mt-8 p-4 bg-gray-50 rounded-lg">
        <div className="grid grid-cols-4 gap-4 text-center">
          <div>
            <p className="text-sm text-gray-600">Total Annotations</p>
            <p className="text-xl font-semibold">{annotatedItems.size * 3}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Components</p>
            <p className="text-xl font-semibold">{annotatedItems.size * 2}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Symbols</p>
            <p className="text-xl font-semibold">{annotatedItems.size}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Time Spent</p>
            <p className="text-xl font-semibold">15:32</p>
          </div>
        </div>
      </div>
    </div>
  );
}
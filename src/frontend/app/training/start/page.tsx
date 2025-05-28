'use client';

import React from 'react';
import { Metadata } from 'next';
import { AITrainingInterface } from '@/components/ai/training/AITrainingInterface';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

// Can't export metadata from client component, so this would need to be in layout or separate server component
// export const metadata: Metadata = {
//   title: 'Start AI Training - Electrical Orchestrator',
//   description: 'Configure and start training AI models for electrical component recognition',
// };

export default function StartTrainingPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <div className="flex items-center space-x-4 mb-4">
          <Link
            href="/training/jobs"
            className="flex items-center text-gray-600 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft className="w-4 h-4 mr-1" />
            Back to Training Jobs
          </Link>
        </div>
        
        <h1 className="text-3xl font-bold text-gray-900">Start AI Model Training</h1>
        <p className="text-lg text-gray-600 mt-2">
          Configure training parameters and start training AI models for electrical component 
          recognition, circuit analysis, and symbol detection.
        </p>
      </div>
      
      <AITrainingInterface />
    </div>
  );
}
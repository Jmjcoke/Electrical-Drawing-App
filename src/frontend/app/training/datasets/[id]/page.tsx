'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'

interface DatasetDetail {
  id: string
  name: string
  category: string
  itemCount: number
  uploadDate: string
  status: 'processing' | 'ready' | 'error'
  size: string
  lastModified: string
  description: string
  version: string
  creator: string
  annotations: {
    total: number
    completed: number
    pending: number
  }
  samples: Array<{
    id: string
    name: string
    type: string
    annotated: boolean
  }>
}

export default function DatasetDetailPage() {
  const params = useParams()
  const datasetId = params.id as string

  // Mock data - in a real app, this would be fetched based on the ID
  const [dataset] = useState<DatasetDetail>({
    id: datasetId,
    name: 'Component Detection Dataset v1',
    category: 'component_detection',
    itemCount: 1250,
    uploadDate: '2024-01-15',
    status: 'ready',
    size: '2.5 GB',
    lastModified: '2024-01-15',
    description: 'Comprehensive dataset for training AI models to detect electrical components in schematic diagrams. Includes resistors, capacitors, inductors, transistors, and integrated circuits.',
    version: '1.0.0',
    creator: 'Engineering Team',
    annotations: {
      total: 1250,
      completed: 1100,
      pending: 150
    },
    samples: [
      { id: '1', name: 'schematic_001.png', type: 'image/png', annotated: true },
      { id: '2', name: 'schematic_002.png', type: 'image/png', annotated: true },
      { id: '3', name: 'schematic_003.png', type: 'image/png', annotated: false },
      { id: '4', name: 'schematic_004.png', type: 'image/png', annotated: true },
      { id: '5', name: 'schematic_005.png', type: 'image/png', annotated: false }
    ]
  })

  const getStatusColor = (status: DatasetDetail['status']) => {
    switch (status) {
      case 'ready':
        return 'bg-green-100 text-green-800'
      case 'processing':
        return 'bg-yellow-100 text-yellow-800'
      case 'error':
        return 'bg-red-100 text-red-800'
    }
  }

  const getCategoryLabel = (category: string) => {
    const labels: Record<string, string> = {
      component_detection: 'Component Detection',
      wire_routing: 'Wire Routing',
      symbol_recognition: 'Symbol Recognition',
      schematic_analysis: 'Schematic Analysis'
    }
    return labels[category] || category
  }

  const annotationProgress = (dataset.annotations.completed / dataset.annotations.total) * 100

  return (
    <div className="space-y-6">
      <div className="bg-white shadow rounded-lg p-6">
        <div className="mb-6">
          <Link
            href="/training/datasets"
            className="text-sm text-gray-500 hover:text-gray-700 mb-2 inline-block"
          >
            ← Back to Datasets
          </Link>
          
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-2xl font-semibold text-gray-900">{dataset.name}</h2>
              <p className="text-gray-600 mt-1">{dataset.description}</p>
              <div className="flex items-center gap-4 mt-3">
                <span className="text-sm text-gray-500">
                  Category: <span className="font-medium text-gray-900">{getCategoryLabel(dataset.category)}</span>
                </span>
                <span className="text-sm text-gray-500">
                  Version: <span className="font-medium text-gray-900">{dataset.version}</span>
                </span>
                <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(dataset.status)}`}>
                  {dataset.status}
                </span>
              </div>
            </div>
            <div className="flex gap-2">
              <button className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors">
                Download
              </button>
              <button className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors">
                Start Training
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-gray-50 p-4 rounded-lg">
            <p className="text-sm text-gray-600 font-medium">Total Items</p>
            <p className="text-2xl font-bold text-gray-900">{dataset.itemCount.toLocaleString()}</p>
          </div>
          <div className="bg-gray-50 p-4 rounded-lg">
            <p className="text-sm text-gray-600 font-medium">Dataset Size</p>
            <p className="text-2xl font-bold text-gray-900">{dataset.size}</p>
          </div>
          <div className="bg-gray-50 p-4 rounded-lg">
            <p className="text-sm text-gray-600 font-medium">Upload Date</p>
            <p className="text-2xl font-bold text-gray-900">
              {new Date(dataset.uploadDate).toLocaleDateString()}
            </p>
          </div>
          <div className="bg-gray-50 p-4 rounded-lg">
            <p className="text-sm text-gray-600 font-medium">Created By</p>
            <p className="text-2xl font-bold text-gray-900">{dataset.creator}</p>
          </div>
        </div>

        <div className="border-t pt-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Annotation Progress</h3>
          <div className="mb-4">
            <div className="flex justify-between text-sm mb-2">
              <span className="text-gray-600">
                {dataset.annotations.completed} of {dataset.annotations.total} items annotated
              </span>
              <span className="font-medium text-gray-900">{annotationProgress.toFixed(1)}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${annotationProgress}%` }}
              />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-2xl font-bold text-green-600">{dataset.annotations.completed}</p>
              <p className="text-sm text-gray-600">Completed</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-yellow-600">{dataset.annotations.pending}</p>
              <p className="text-sm text-gray-600">Pending</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{dataset.annotations.total}</p>
              <p className="text-sm text-gray-600">Total</p>
            </div>
          </div>
          <div className="mt-4">
            <button className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors">
              Continue Annotation
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white shadow rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Sample Items</h3>
        <div className="space-y-2">
          {dataset.samples.map((sample) => (
            <div key={sample.id} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gray-100 rounded flex items-center justify-center">
                  <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <div>
                  <p className="font-medium text-gray-900">{sample.name}</p>
                  <p className="text-sm text-gray-500">{sample.type}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {sample.annotated ? (
                  <span className="text-sm text-green-600 font-medium">Annotated</span>
                ) : (
                  <span className="text-sm text-gray-400">Not annotated</span>
                )}
                <button className="text-sm text-blue-600 hover:text-blue-800 font-medium">
                  View
                </button>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-4 text-center">
          <button className="text-sm text-blue-600 hover:text-blue-800 font-medium">
            View All Items ({dataset.itemCount})
          </button>
        </div>
      </div>

      <div className="bg-white shadow rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Training History</h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
            <div>
              <p className="font-medium text-gray-900">Model v2.1 Training</p>
              <p className="text-sm text-gray-500">Completed on Jan 14, 2024</p>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm text-green-600 font-medium">95.8% Accuracy</span>
              <button className="text-sm text-blue-600 hover:text-blue-800 font-medium">
                View Results
              </button>
            </div>
          </div>
          <div className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
            <div>
              <p className="font-medium text-gray-900">Model v2.0 Training</p>
              <p className="text-sm text-gray-500">Completed on Jan 10, 2024</p>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm text-green-600 font-medium">93.2% Accuracy</span>
              <button className="text-sm text-blue-600 hover:text-blue-800 font-medium">
                View Results
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
'use client'

import { useState } from 'react'
import Link from 'next/link'
import { TrainingDataUploader } from '@/components/ai/training/TrainingDataUploader'

interface Dataset {
  id: string
  name: string
  category: string
  itemCount: number
  uploadDate: string
  status: 'processing' | 'ready' | 'error'
}

export default function TrainingPage() {
  const [showUploader, setShowUploader] = useState(false)
  const [recentDatasets, setRecentDatasets] = useState<Dataset[]>([
    {
      id: '1',
      name: 'Component Detection Dataset v1',
      category: 'component_detection',
      itemCount: 1250,
      uploadDate: '2024-01-15',
      status: 'ready'
    },
    {
      id: '2',
      name: 'Wire Routing Dataset',
      category: 'wire_routing',
      itemCount: 800,
      uploadDate: '2024-01-14',
      status: 'ready'
    },
    {
      id: '3',
      name: 'Symbol Recognition Dataset',
      category: 'symbol_recognition',
      itemCount: 500,
      uploadDate: '2024-01-13',
      status: 'processing'
    }
  ])

  const getStatusColor = (status: Dataset['status']) => {
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

  return (
    <div className="space-y-6">
      <div className="bg-white shadow rounded-lg p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold text-gray-900">Training Data Overview</h2>
          <button
            onClick={() => setShowUploader(!showUploader)}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            Upload New Dataset
          </button>
        </div>

        {showUploader && (
          <div className="mb-6 p-4 bg-gray-50 rounded-lg">
            <TrainingDataUploader />
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-blue-50 p-4 rounded-lg">
            <p className="text-sm text-blue-600 font-medium">Total Datasets</p>
            <p className="text-2xl font-bold text-blue-900">{recentDatasets.length}</p>
          </div>
          <div className="bg-green-50 p-4 rounded-lg">
            <p className="text-sm text-green-600 font-medium">Ready for Training</p>
            <p className="text-2xl font-bold text-green-900">
              {recentDatasets.filter(d => d.status === 'ready').length}
            </p>
          </div>
          <div className="bg-purple-50 p-4 rounded-lg">
            <p className="text-sm text-purple-600 font-medium">Total Data Items</p>
            <p className="text-2xl font-bold text-purple-900">
              {recentDatasets.reduce((sum, d) => sum + d.itemCount, 0).toLocaleString()}
            </p>
          </div>
        </div>

        <div className="mb-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Recent Datasets</h3>
          <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 md:rounded-lg">
            <table className="min-w-full divide-y divide-gray-300">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Dataset Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Category
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Items
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Upload Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="relative px-6 py-3">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {recentDatasets.map((dataset) => (
                  <tr key={dataset.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {dataset.name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {getCategoryLabel(dataset.category)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {dataset.itemCount.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(dataset.uploadDate).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(dataset.status)}`}>
                        {dataset.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <Link
                        href={`/training/datasets/${dataset.id}`}
                        className="text-blue-600 hover:text-blue-900"
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex justify-end">
          <Link
            href="/training/datasets"
            className="text-blue-600 hover:text-blue-800 font-medium"
          >
            View All Datasets →
          </Link>
        </div>
      </div>

      <div className="bg-white shadow rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Quick Actions</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="border border-gray-200 rounded-lg p-4">
            <h4 className="font-medium text-gray-900 mb-2">Annotation Workflow</h4>
            <p className="text-sm text-gray-600 mb-3">
              Review and annotate uploaded datasets to improve model accuracy
            </p>
            <Link href="/training/annotate" className="text-sm text-blue-600 hover:text-blue-800 font-medium">
              Start Annotating →
            </Link>
          </div>
          <div className="border border-gray-200 rounded-lg p-4">
            <h4 className="font-medium text-gray-900 mb-2">AI Model Training</h4>
            <p className="text-sm text-gray-600 mb-3">
              Configure and run AI training jobs on your prepared datasets
            </p>
            <Link href="/training/jobs" className="text-sm text-blue-600 hover:text-blue-800 font-medium">
              Start Training →
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
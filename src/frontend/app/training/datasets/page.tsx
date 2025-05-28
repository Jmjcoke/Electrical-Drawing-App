'use client'

import { useState } from 'react'
import Link from 'next/link'

interface Dataset {
  id: string
  name: string
  category: string
  itemCount: number
  uploadDate: string
  status: 'processing' | 'ready' | 'error'
  size: string
  lastModified: string
}

export default function DatasetsPage() {
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [datasets] = useState<Dataset[]>([
    {
      id: '1',
      name: 'Component Detection Dataset v1',
      category: 'component_detection',
      itemCount: 1250,
      uploadDate: '2024-01-15',
      status: 'ready',
      size: '2.5 GB',
      lastModified: '2024-01-15'
    },
    {
      id: '2',
      name: 'Wire Routing Dataset',
      category: 'wire_routing',
      itemCount: 800,
      uploadDate: '2024-01-14',
      status: 'ready',
      size: '1.8 GB',
      lastModified: '2024-01-14'
    },
    {
      id: '3',
      name: 'Symbol Recognition Dataset',
      category: 'symbol_recognition',
      itemCount: 500,
      uploadDate: '2024-01-13',
      status: 'processing',
      size: '950 MB',
      lastModified: '2024-01-13'
    },
    {
      id: '4',
      name: 'Schematic Analysis Training Set',
      category: 'schematic_analysis',
      itemCount: 300,
      uploadDate: '2024-01-12',
      status: 'ready',
      size: '1.2 GB',
      lastModified: '2024-01-12'
    },
    {
      id: '5',
      name: 'Component Detection Dataset v2',
      category: 'component_detection',
      itemCount: 2000,
      uploadDate: '2024-01-10',
      status: 'ready',
      size: '3.8 GB',
      lastModified: '2024-01-11'
    }
  ])

  const categories = [
    { value: 'all', label: 'All Categories' },
    { value: 'component_detection', label: 'Component Detection' },
    { value: 'wire_routing', label: 'Wire Routing' },
    { value: 'symbol_recognition', label: 'Symbol Recognition' },
    { value: 'schematic_analysis', label: 'Schematic Analysis' }
  ]

  const filteredDatasets = datasets.filter(dataset => {
    const matchesCategory = selectedCategory === 'all' || dataset.category === selectedCategory
    const matchesSearch = dataset.name.toLowerCase().includes(searchQuery.toLowerCase())
    return matchesCategory && matchesSearch
  })

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
    const categoryObj = categories.find(c => c.value === category)
    return categoryObj?.label || category
  }

  return (
    <div className="space-y-6">
      <div className="bg-white shadow rounded-lg p-6">
        <div className="mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">All Datasets</h2>
          
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <input
                type="text"
                placeholder="Search datasets..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div className="sm:w-64">
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              >
                {categories.map(category => (
                  <option key={category.value} value={category.value}>
                    {category.label}
                  </option>
                ))}
              </select>
            </div>
            <Link
              href="/training"
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors inline-flex items-center justify-center"
            >
              Upload New
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filteredDatasets.map((dataset) => (
            <div key={dataset.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h3 className="font-medium text-gray-900">{dataset.name}</h3>
                  <p className="text-sm text-gray-500 mt-1">{getCategoryLabel(dataset.category)}</p>
                </div>
                <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(dataset.status)}`}>
                  {dataset.status}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm mb-4">
                <div>
                  <p className="text-gray-500">Items</p>
                  <p className="font-medium text-gray-900">{dataset.itemCount.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-gray-500">Size</p>
                  <p className="font-medium text-gray-900">{dataset.size}</p>
                </div>
                <div>
                  <p className="text-gray-500">Uploaded</p>
                  <p className="font-medium text-gray-900">{new Date(dataset.uploadDate).toLocaleDateString()}</p>
                </div>
                <div>
                  <p className="text-gray-500">Modified</p>
                  <p className="font-medium text-gray-900">{new Date(dataset.lastModified).toLocaleDateString()}</p>
                </div>
              </div>

              <div className="flex justify-between items-center">
                <div className="flex gap-2">
                  <button className="text-sm text-blue-600 hover:text-blue-800 font-medium">
                    Download
                  </button>
                  <span className="text-gray-300">•</span>
                  <button className="text-sm text-blue-600 hover:text-blue-800 font-medium">
                    Annotate
                  </button>
                </div>
                <Link
                  href={`/training/datasets/${dataset.id}`}
                  className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                >
                  View Details →
                </Link>
              </div>
            </div>
          ))}
        </div>

        {filteredDatasets.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500">No datasets found matching your criteria.</p>
          </div>
        )}
      </div>

      <div className="bg-white shadow rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Dataset Statistics</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-gray-50 p-4 rounded-lg">
            <p className="text-sm text-gray-600 font-medium">Total Datasets</p>
            <p className="text-2xl font-bold text-gray-900">{datasets.length}</p>
          </div>
          <div className="bg-gray-50 p-4 rounded-lg">
            <p className="text-sm text-gray-600 font-medium">Total Items</p>
            <p className="text-2xl font-bold text-gray-900">
              {datasets.reduce((sum, d) => sum + d.itemCount, 0).toLocaleString()}
            </p>
          </div>
          <div className="bg-gray-50 p-4 rounded-lg">
            <p className="text-sm text-gray-600 font-medium">Storage Used</p>
            <p className="text-2xl font-bold text-gray-900">11.3 GB</p>
          </div>
          <div className="bg-gray-50 p-4 rounded-lg">
            <p className="text-sm text-gray-600 font-medium">Active Training</p>
            <p className="text-2xl font-bold text-gray-900">2</p>
          </div>
        </div>
      </div>
    </div>
  )
}
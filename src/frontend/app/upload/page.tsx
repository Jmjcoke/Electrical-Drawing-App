'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
// Removed incorrect import

// Simple arrow component
const ArrowLeftIcon = () => (
  <svg width="16" height="16" className="mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
  </svg>
)

export default function UploadPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadResult, setUploadResult] = useState<any>(null)
  const [error, setError] = useState('')
  const [isDragging, setIsDragging] = useState(false)

  useEffect(() => {
    // Check if user is logged in
    const storedUser = localStorage.getItem('user')
    if (!storedUser) {
      router.push('/login')
      return
    }
    setUser(JSON.parse(storedUser))
  }, [router])

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    console.log('File select triggered', e.target.files)
    const file = e.target.files?.[0]
    if (file) {
      console.log('File selected:', file.name, file.type)
      // Allow any PDF MIME type variant
      if (!file.type.includes('pdf') && !file.name.toLowerCase().endsWith('.pdf')) {
        setError('Please select a PDF file')
        return
      }
      setSelectedFile(file)
      setError('')
    }
  }

  const triggerFileSelect = () => {
    console.log('Browse button clicked')
    const fileInput = document.getElementById('file-upload') as HTMLInputElement
    if (fileInput) {
      console.log('File input found, triggering click')
      fileInput.click()
    } else {
      console.log('File input not found')
    }
  }

  const handleUpload = async () => {
    if (!selectedFile) return

    setUploading(true)
    setError('')

    const formData = new FormData()
    formData.append('file', selectedFile)
    formData.append('project_id', 'demo-project-001') // Demo project ID

    try {
      const response = await fetch('http://localhost:8003/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token') || 'demo-token'}`
        },
        body: formData
      })

      if (response.ok) {
        const data = await response.json()
        setUploadResult(data)
        console.log('Upload successful:', data)
      } else {
        const errorData = await response.json().catch(() => null)
        setError(errorData?.detail || 'Upload failed')
      }
    } catch (err) {
      console.error('Upload error:', err)
      setError('Failed to upload PDF. Please check if the backend is running.')
    } finally {
      setUploading(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file && file.type === 'application/pdf') {
      setSelectedFile(file)
      setError('')
    } else {
      setError('Please drop a PDF file')
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }

  if (!user) {
    return <div>Loading...</div>
  }

  return (
    <main className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <Link href="/" className="inline-flex items-center text-blue-600 hover:text-blue-800 mb-6">
          <ArrowLeftIcon />
          Back to Home
        </Link>

        <h1 className="text-3xl font-bold mb-8">Upload Electrical Drawing</h1>

        <div className="bg-white rounded-lg shadow-lg p-8">
          <div 
            className={`border-2 border-dashed rounded-lg p-12 text-center transition-all ${
              selectedFile 
                ? 'border-green-400 bg-green-50' 
                : isDragging
                  ? 'border-blue-400 bg-blue-50'
                  : 'border-gray-400 bg-gray-50 hover:bg-gray-100'
            }`}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            style={{ minHeight: '300px' }}
          >
            {selectedFile ? (
              <div className="space-y-4">
                <svg width="24" height="24" className="mx-auto text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-lg font-medium">{selectedFile.name}</p>
                <p className="text-sm text-gray-600">
                  {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                </p>
                <button
                  onClick={() => setSelectedFile(null)}
                  className="text-red-600 hover:text-red-800"
                >
                  Remove file
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <svg width="32" height="32" className="mx-auto text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                <div>
                  <p className="text-xl font-medium text-gray-700">Drop your PDF here</p>
                  <p className="text-lg text-gray-600 mt-2">or</p>
                </div>
                
                <div className="inline-block">
                  <input
                    id="file-upload"
                    type="file"
                    accept=".pdf,application/pdf"
                    onChange={handleFileSelect}
                    style={{ display: 'none' }}
                  />
                  <button
                    type="button"
                    onClick={triggerFileSelect}
                    className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 cursor-pointer transition-colors font-medium"
                  >
                    Browse Files
                  </button>
                </div>
                
                <p className="text-sm text-gray-500 mt-4">Maximum file size: 50MB</p>
              </div>
            )}
          </div>

          {error && (
            <div className="mt-4 p-4 bg-red-50 text-red-800 rounded-lg">
              {error}
            </div>
          )}

          {uploadResult && (
            <div className="mt-4 p-4 bg-green-50 text-green-800 rounded-lg">
              <p className="font-medium">Upload successful!</p>
              <p className="text-sm mt-1">Drawing ID: {uploadResult.drawing_id}</p>
              <p className="text-sm">Pages: {uploadResult.page_count}</p>
            </div>
          )}

          {selectedFile && !uploadResult && (
            <button
              onClick={handleUpload}
              disabled={uploading}
              className="mt-6 w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {uploading ? 'Uploading...' : 'Upload PDF'}
            </button>
          )}

          {uploadResult && (
            <div className="mt-6 space-y-3">
              <button
                onClick={() => {
                  setSelectedFile(null)
                  setUploadResult(null)
                  setError('')
                }}
                className="w-full bg-gray-200 text-gray-800 py-3 px-4 rounded-lg hover:bg-gray-300 transition-colors font-medium"
              >
                Upload Another PDF
              </button>
              <button
                onClick={() => router.push(`/viewer/${uploadResult.drawing_id}`)}
                className="w-full bg-green-600 text-white py-3 px-4 rounded-lg hover:bg-green-700 transition-colors font-medium"
              >
                View & Analyze Drawing
              </button>
            </div>
          )}
        </div>

        <div className="mt-8 space-y-6">
          <div className="bg-blue-50 rounded-lg p-6">
            <h2 className="text-lg font-semibold mb-2">What happens next?</h2>
            <ul className="space-y-2 text-sm text-gray-700">
              <li>• AI analyzes your electrical drawings to identify components</li>
              <li>• Cloud detection highlights revisions and changes</li>
              <li>• Circuit tracing maps electrical connections</li>
              <li>• Man-hour estimation based on historical data</li>
            </ul>
          </div>

          <div className="bg-gray-50 rounded-lg p-6">
            <h3 className="text-sm font-semibold mb-2">File Access Tips:</h3>
            <ul className="space-y-1 text-xs text-gray-600">
              <li>• Ubuntu files: Browse normally from your home directory</li>
              <li>• Windows files: Navigate to /mnt/c/ to access your C: drive</li>
              <li>• Example: /mnt/c/Users/YourName/Desktop/drawing.pdf</li>
            </ul>
          </div>
        </div>
      </div>
    </main>
  )
}
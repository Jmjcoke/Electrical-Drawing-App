'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

interface ServiceStatus {
  backend: boolean
  cache: boolean
  database: boolean
  frontend: boolean
}

export default function Home() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [status, setStatus] = useState<ServiceStatus>({
    backend: false,
    cache: false,
    database: false,
    frontend: true
  })

  useEffect(() => {
    // Check if user is logged in
    const storedUser = localStorage.getItem('user')
    if (storedUser) {
      setUser(JSON.parse(storedUser))
    }

    // Check backend services
    fetch('http://localhost:8000/health', {
      mode: 'cors',
      headers: {
        'Accept': 'application/json',
      }
    })
      .then(res => res.ok && setStatus(prev => ({ ...prev, backend: true })))
      .catch(() => {})

    // Check other services via gateway status endpoint
    fetch('http://localhost:8000/api/v1/system/status', {
      mode: 'cors',
      headers: {
        'Accept': 'application/json',
      }
    })
      .then(res => res.json())
      .then(data => {
        setStatus(prev => ({
          ...prev,
          cache: data.redis?.status === 'healthy',
          database: data.postgres?.status === 'healthy'
        }))
      })
      .catch(() => {})
  }, [])

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24 bg-gray-50">
      <div className="max-w-5xl w-full">
        <h1 className="text-4xl font-bold text-center mb-2">
          Electrical Orchestrator
        </h1>
        <p className="text-center text-gray-600 mb-8">
          AI-Powered Electrical Contracting Platform
        </p>
        
        {user && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
            <p className="text-green-800">Welcome back, <strong>{user.name || user.email}</strong>!</p>
          </div>
        )}

        <div className="bg-white rounded-lg shadow-lg p-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-semibold">System Status: </h2>
            <span className={`text-xl font-medium ${Object.values(status).every(v => v) ? 'text-green-600' : 'text-yellow-600'}`}>
              {Object.values(status).every(v => v) ? 'Online ✅' : 'Partial ⚠️'}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-gray-700">Backend Services</h3>
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded">
                <span>All APIs Running</span>
                <span className={status.backend ? 'text-green-600' : 'text-red-600'}>
                  {status.backend ? '✓' : '✗'}
                </span>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-lg font-medium text-gray-700">Cache</h3>
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded">
                <span>Redis Active</span>
                <span className={status.cache ? 'text-green-600' : 'text-red-600'}>
                  {status.cache ? '✓' : '✗'}
                </span>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-lg font-medium text-gray-700">Database</h3>
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded">
                <span>PostgreSQL Connected</span>
                <span className={status.database ? 'text-green-600' : 'text-red-600'}>
                  {status.database ? '✓' : '✗'}
                </span>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-lg font-medium text-gray-700">Frontend</h3>
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded">
                <span>Next.js Ready</span>
                <span className={status.frontend ? 'text-green-600' : 'text-red-600'}>
                  {status.frontend ? '✓' : '✗'}
                </span>
              </div>
            </div>
          </div>

          <div className="mt-8 space-y-4">
            {user ? (
              <>
                <Link 
                  href="/upload"
                  className="block w-full bg-green-600 text-white py-3 px-4 rounded-lg hover:bg-green-700 transition-colors font-medium text-center"
                >
                  Upload PDF Drawing
                </Link>
                <button 
                  onClick={() => {
                    localStorage.removeItem('token')
                    localStorage.removeItem('user')
                    window.location.reload()
                  }}
                  className="block w-full bg-red-600 text-white py-3 px-4 rounded-lg hover:bg-red-700 transition-colors font-medium text-center"
                >
                  Logout
                </button>
              </>
            ) : (
              <Link 
                href="/login"
                className="block w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 transition-colors font-medium text-center"
              >
                Login to Dashboard
              </Link>
            )}
            
            <a 
              href="http://localhost:8000/docs"
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full bg-gray-200 text-gray-800 py-3 px-4 rounded-lg hover:bg-gray-300 transition-colors font-medium text-center"
            >
              View API Documentation
            </a>
          </div>
        </div>
      </div>
    </main>
  )
}
import { Metadata } from 'next'
import { TrainingNavigation } from '@/components/ai/training/TrainingNavigation'
import { TestModeIndicator } from '@/components/ui/TestModeIndicator'

export const metadata: Metadata = {
  title: 'AI Training Data Management',
  description: 'Manage datasets and training data for AI models',
}

export default function TrainingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">AI Training Data Management</h1>
          <p className="mt-2 text-gray-600">Upload, manage, and annotate training datasets</p>
        </div>
        <TrainingNavigation />
        {children}
      </div>
      <TestModeIndicator />
    </div>
  )
}
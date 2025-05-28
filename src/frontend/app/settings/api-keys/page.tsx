export default function APIKeysSettingsPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">API Key Configuration</h1>
        
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
          <p className="text-sm text-yellow-800">
            API keys should be configured in your <code className="font-mono bg-yellow-100 px-1 rounded">.env.local</code> file for security.
            Never expose API keys in client-side code.
          </p>
        </div>

        <div className="space-y-6">
          <div className="border rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4">Required Environment Variables</h2>
            
            <div className="space-y-4 font-mono text-sm">
              <div>
                <p className="text-gray-600 mb-1"># OpenAI API Key</p>
                <p className="bg-gray-100 p-2 rounded">OPENAI_API_KEY=sk-...</p>
              </div>
              
              <div>
                <p className="text-gray-600 mb-1"># Azure Computer Vision</p>
                <p className="bg-gray-100 p-2 rounded">AZURE_COMPUTER_VISION_KEY=...</p>
                <p className="bg-gray-100 p-2 rounded mt-1">AZURE_COMPUTER_VISION_ENDPOINT=https://...</p>
              </div>
              
              <div>
                <p className="text-gray-600 mb-1"># Google Cloud Vision</p>
                <p className="bg-gray-100 p-2 rounded">GOOGLE_CLOUD_VISION_API_KEY=...</p>
              </div>
            </div>
          </div>

          <div className="border rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4">Getting API Keys</h2>
            
            <div className="space-y-4">
              <div>
                <h3 className="font-medium">OpenAI</h3>
                <p className="text-sm text-gray-600 mt-1">
                  Sign up at{' '}
                  <a href="https://platform.openai.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">
                    platform.openai.com
                  </a>
                  {' '}and create an API key in your dashboard.
                </p>
              </div>
              
              <div>
                <h3 className="font-medium">Azure Computer Vision</h3>
                <p className="text-sm text-gray-600 mt-1">
                  Create a Computer Vision resource in the{' '}
                  <a href="https://portal.azure.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">
                    Azure Portal
                  </a>.
                </p>
              </div>
              
              <div>
                <h3 className="font-medium">Google Cloud Vision</h3>
                <p className="text-sm text-gray-600 mt-1">
                  Enable the Vision API in{' '}
                  <a href="https://console.cloud.google.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">
                    Google Cloud Console
                  </a>.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
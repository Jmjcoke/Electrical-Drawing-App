import Link from 'next/link';
import { Alert } from '@/components/ui/Alert';
import { AlertCircle, Settings } from 'lucide-react';
import { useAPIKeyStatus } from '@/hooks/useAPIKeyStatus';

interface APIKeyConfigAlertProps {
  requiredFeatures?: string[];
  className?: string;
}

export function APIKeyConfigAlert({ requiredFeatures = [], className }: APIKeyConfigAlertProps) {
  const { loading, configured, features } = useAPIKeyStatus();

  if (loading) {
    return null;
  }

  if (!configured) {
    return (
      <Alert variant="warning" className={className}>
        <AlertCircle className="h-4 w-4" />
        <div>
          <p className="font-semibold">API Keys Not Configured</p>
          <p className="text-sm mt-1">
            AI-powered features require API key configuration.{' '}
            <Link href="/settings/api-keys" className="underline hover:text-yellow-900">
              Configure API keys
            </Link>{' '}
            to enable symbol extraction and analysis.
          </p>
        </div>
      </Alert>
    );
  }

  // Check if required features are available
  if (requiredFeatures.length > 0) {
    const missingFeatures = requiredFeatures.filter(
      feature => !features.includes(feature)
    );

    if (missingFeatures.length > 0) {
      return (
        <Alert variant="info" className={className}>
          <Settings className="h-4 w-4" />
          <div>
            <p className="font-semibold">Additional Configuration Required</p>
            <p className="text-sm mt-1">
              This feature requires: {missingFeatures.join(', ')}.{' '}
              <Link href="/settings/api-keys" className="underline hover:text-blue-900">
                Update API configuration
              </Link>{' '}
              to enable all features.
            </p>
          </div>
        </Alert>
      );
    }
  }

  return null;
}
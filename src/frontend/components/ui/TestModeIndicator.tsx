'use client';

import React from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Beaker, Settings } from 'lucide-react';

interface TestModeIndicatorProps {
  showSettings?: boolean;
}

export const TestModeIndicator: React.FC<TestModeIndicatorProps> = ({
  showSettings = true,
}) => {
  const isDevelopment = process.env.NODE_ENV === 'development';

  if (!isDevelopment) return null;

  return (
    <div className="fixed bottom-4 right-4 flex items-center space-x-2 z-50">
      <Badge variant="outline" className="bg-white shadow-lg">
        Development Mode
      </Badge>
      
      <Link href="/test/symbol-extraction">
        <Button size="sm" variant="outline" className="shadow-lg">
          <Beaker className="h-4 w-4 mr-2" />
          Test Extraction
        </Button>
      </Link>

      {showSettings && (
        <Link href="/settings/api-keys">
          <Button size="sm" variant="outline" className="shadow-lg">
            <Settings className="h-4 w-4 mr-2" />
            API Keys
          </Button>
        </Link>
      )}
    </div>
  );
};
'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  Home,
  Upload,
  Grid3x3,
  Tag,
  Cpu,
  BookOpen,
} from 'lucide-react';

interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
}

const navItems: NavItem[] = [
  {
    name: 'Overview',
    href: '/training',
    icon: Home,
    description: 'Training dashboard',
  },
  {
    name: 'Symbol Extraction',
    href: '/training/symbols',
    icon: BookOpen,
    description: 'Extract symbols from legends',
  },
  {
    name: 'Datasets',
    href: '/training/datasets',
    icon: Grid3x3,
    description: 'Manage training datasets',
  },
  {
    name: 'Annotation',
    href: '/training/annotate',
    icon: Tag,
    description: 'Label training data',
  },
  {
    name: 'Training Jobs',
    href: '/training/jobs',
    icon: Cpu,
    description: 'Monitor model training',
  },
];

export const TrainingNavigation: React.FC = () => {
  const pathname = usePathname();

  return (
    <nav className="mb-8">
      <div className="border-b border-gray-200">
        <div className="flex space-x-8">
          {navItems.map((item) => {
            const isActive = pathname === item.href || 
              (item.href !== '/training' && pathname.startsWith(item.href));
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center py-4 px-1 border-b-2 font-medium text-sm transition-colors',
                  isActive
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                )}
              >
                <Icon className="h-5 w-5 mr-2" />
                <span>{item.name}</span>
              </Link>
            );
          })}
        </div>
      </div>
      
      {/* Description for current page */}
      <div className="mt-4">
        {navItems.map((item) => {
          const isActive = pathname === item.href || 
            (item.href !== '/training' && pathname.startsWith(item.href));
          
          if (isActive) {
            return (
              <p key={item.href} className="text-sm text-gray-600">
                {item.description}
              </p>
            );
          }
          return null;
        })}
      </div>
    </nav>
  );
};
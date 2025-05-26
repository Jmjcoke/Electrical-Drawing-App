import React from 'react';
import { cn } from '../../lib/utils';

interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  value: number;
  className?: string;
  indicatorClassName?: string;
}

export const Progress: React.FC<ProgressProps> = ({
  value,
  className,
  indicatorClassName,
  ...props
}) => {
  return (
    <div
      className={cn(
        'relative h-2 w-full overflow-hidden rounded-full bg-gray-200',
        className
      )}
      {...props}
    >
      <div
        className={cn(
          'h-full w-full flex-1 bg-blue-600 transition-all',
          indicatorClassName
        )}
        style={{
          transform: `translateX(-${100 - Math.min(Math.max(value, 0), 100)}%)`,
        }}
      />
    </div>
  );
};
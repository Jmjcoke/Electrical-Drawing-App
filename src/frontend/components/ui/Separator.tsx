import React from 'react';
import { cn } from '../../lib/utils';

interface SeparatorProps extends React.HTMLAttributes<HTMLDivElement> {
  orientation?: 'horizontal' | 'vertical';
  decorative?: boolean;
}

export const Separator: React.FC<SeparatorProps> = ({
  className,
  orientation = 'horizontal',
  decorative = true,
  ...props
}) => {
  return (
    <div
      role={!decorative ? 'separator' : undefined}
      aria-orientation={orientation}
      className={cn(
        'shrink-0 bg-border bg-gray-200',
        orientation === 'horizontal' ? 'h-[1px] w-full' : 'h-full w-[1px]',
        className
      )}
      {...props}
    />
  );
};
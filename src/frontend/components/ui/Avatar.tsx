import React from 'react';
import { cn } from '../../lib/utils';

interface AvatarProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string;
}

export const Avatar: React.FC<AvatarProps> = ({ className, ...props }) => {
  return (
    <div
      className={cn(
        'relative flex h-10 w-10 shrink-0 overflow-hidden rounded-full',
        className
      )}
      {...props}
    />
  );
};

interface AvatarImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src?: string;
}

export const AvatarImage: React.FC<AvatarImageProps> = ({ 
  className, 
  src,
  ...props 
}) => {
  if (!src) return null;
  
  return (
    <img
      className={cn('aspect-square h-full w-full', className)}
      src={src}
      {...props}
    />
  );
};

interface AvatarFallbackProps extends React.HTMLAttributes<HTMLDivElement> {}

export const AvatarFallback: React.FC<AvatarFallbackProps> = ({
  className,
  ...props
}) => {
  return (
    <div
      className={cn(
        'flex h-full w-full items-center justify-center rounded-full bg-gray-100 text-sm font-medium text-gray-600',
        className
      )}
      {...props}
    />
  );
};
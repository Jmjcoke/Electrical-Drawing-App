import React, { useState, useRef, useEffect } from 'react';
import { cn } from '../../lib/utils';

interface PopoverProps {
  children: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export const Popover: React.FC<PopoverProps> = ({
  children,
  open: controlledOpen,
  onOpenChange
}) => {
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;
  
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        if (isControlled) {
          onOpenChange?.(false);
        } else {
          setInternalOpen(false);
        }
      }
    };

    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [open, isControlled, onOpenChange]);

  const handleOpenChange = (newOpen: boolean) => {
    if (isControlled) {
      onOpenChange?.(newOpen);
    } else {
      setInternalOpen(newOpen);
    }
  };

  return (
    <div ref={popoverRef} className="relative">
      {React.Children.map(children, child => {
        if (React.isValidElement(child)) {
          return React.cloneElement(child as any, {
            open,
            onOpenChange: handleOpenChange
          });
        }
        return child;
      })}
    </div>
  );
};

interface PopoverTriggerProps {
  children: React.ReactNode;
  asChild?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export const PopoverTrigger: React.FC<PopoverTriggerProps> = ({
  children,
  asChild = false,
  open,
  onOpenChange
}) => {
  const handleClick = () => {
    onOpenChange?.(!open);
  };

  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children as any, {
      onClick: handleClick
    });
  }

  return (
    <button onClick={handleClick}>
      {children}
    </button>
  );
};

interface PopoverContentProps {
  children: React.ReactNode;
  className?: string;
  align?: 'start' | 'center' | 'end';
  side?: 'top' | 'right' | 'bottom' | 'left';
  open?: boolean;
}

export const PopoverContent: React.FC<PopoverContentProps> = ({
  children,
  className,
  align = 'center',
  side = 'bottom',
  open
}) => {
  if (!open) return null;

  const alignmentClasses = {
    start: 'left-0',
    center: 'left-1/2 transform -translate-x-1/2',
    end: 'right-0'
  };

  const sideClasses = {
    top: 'bottom-full mb-2',
    right: 'left-full ml-2 top-0',
    bottom: 'top-full mt-2',
    left: 'right-full mr-2 top-0'
  };

  return (
    <div
      className={cn(
        'absolute z-50 w-72 rounded-md border border-gray-200 bg-white p-4 text-popover-foreground shadow-md outline-none',
        sideClasses[side],
        alignmentClasses[align],
        className
      )}
    >
      {children}
    </div>
  );
};
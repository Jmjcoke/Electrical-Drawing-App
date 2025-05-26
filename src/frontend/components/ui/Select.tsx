import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '../../lib/utils';

interface SelectProps {
  value: string;
  onValueChange: (value: string) => void;
  children: React.ReactNode;
  disabled?: boolean;
  placeholder?: string;
}

export const Select: React.FC<SelectProps> = ({
  value,
  onValueChange,
  children,
  disabled = false,
  placeholder = 'Select...'
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const selectRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (selectRef.current && !selectRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (selectedValue: string) => {
    onValueChange(selectedValue);
    setIsOpen(false);
  };

  return (
    <div ref={selectRef} className="relative">
      {React.Children.map(children, child => {
        if (React.isValidElement(child)) {
          return React.cloneElement(child as any, {
            isOpen,
            setIsOpen,
            value,
            onSelect: handleSelect,
            disabled
          });
        }
        return child;
      })}
    </div>
  );
};

interface SelectTriggerProps {
  children: React.ReactNode;
  className?: string;
  isOpen?: boolean;
  setIsOpen?: (open: boolean) => void;
  disabled?: boolean;
}

export const SelectTrigger: React.FC<SelectTriggerProps> = ({
  children,
  className,
  isOpen,
  setIsOpen,
  disabled
}) => {
  return (
    <button
      type="button"
      onClick={() => !disabled && setIsOpen?.(!isOpen)}
      disabled={disabled}
      className={cn(
        'flex h-10 w-full items-center justify-between rounded-md border border-gray-300 bg-white px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
        className
      )}
    >
      {children}
      <ChevronDown className={cn('h-4 w-4 transition-transform', isOpen && 'rotate-180')} />
    </button>
  );
};

interface SelectValueProps {
  placeholder?: string;
  value?: string;
}

export const SelectValue: React.FC<SelectValueProps> = ({ placeholder, value }) => {
  return <span>{value || placeholder}</span>;
};

interface SelectContentProps {
  children: React.ReactNode;
  isOpen?: boolean;
  className?: string;
}

export const SelectContent: React.FC<SelectContentProps> = ({
  children,
  isOpen,
  className
}) => {
  if (!isOpen) return null;

  return (
    <div
      className={cn(
        'absolute top-full z-50 mt-1 w-full rounded-md border border-gray-200 bg-white shadow-lg',
        className
      )}
    >
      <div className="max-h-60 overflow-auto py-1">
        {children}
      </div>
    </div>
  );
};

interface SelectItemProps {
  value: string;
  children: React.ReactNode;
  onSelect?: (value: string) => void;
  className?: string;
}

export const SelectItem: React.FC<SelectItemProps> = ({
  value,
  children,
  onSelect,
  className
}) => {
  return (
    <div
      onClick={() => onSelect?.(value)}
      className={cn(
        'relative flex cursor-pointer select-none items-center rounded-sm py-1.5 px-2 text-sm outline-none hover:bg-gray-100 focus:bg-gray-100',
        className
      )}
    >
      {children}
    </div>
  );
};
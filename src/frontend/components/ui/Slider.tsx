import React from 'react';
import { cn } from '../../lib/utils';

interface SliderProps {
  value: number[];
  onValueChange: (value: number[]) => void;
  min?: number;
  max?: number;
  step?: number;
  className?: string;
  disabled?: boolean;
}

export const Slider: React.FC<SliderProps> = ({
  value,
  onValueChange,
  min = 0,
  max = 100,
  step = 1,
  className,
  disabled = false,
  ...props
}) => {
  const currentValue = value[0] || 0;
  const percentage = ((currentValue - min) / (max - min)) * 100;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = parseFloat(e.target.value);
    onValueChange([newValue]);
  };

  return (
    <div className={cn('relative w-full', className)}>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={currentValue}
        onChange={handleChange}
        disabled={disabled}
        className={cn(
          'w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer',
          'slider-thumb:appearance-none slider-thumb:h-4 slider-thumb:w-4 slider-thumb:rounded-full slider-thumb:bg-blue-600',
          'slider-thumb:cursor-pointer slider-thumb:border-0 slider-thumb:shadow-md',
          'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50',
          disabled && 'opacity-50 cursor-not-allowed'
        )}
        style={{
          background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${percentage}%, #e5e7eb ${percentage}%, #e5e7eb 100%)`
        }}
        {...props}
      />
    </div>
  );
};
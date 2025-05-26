import React from 'react';
import { Check } from 'lucide-react';
import { cn } from '../../lib/utils';

interface StepperProps {
  activeStep: number;
  children: React.ReactElement<StepProps>[];
}

interface StepProps {
  title: string;
  description?: string;
}

export const Stepper: React.FC<StepperProps> = ({ activeStep, children }) => {
  return (
    <div className="flex items-center w-full">
      {children.map((step, index) => (
        <React.Fragment key={index}>
          <div className="flex items-center">
            <div
              className={cn(
                'flex items-center justify-center w-8 h-8 rounded-full border-2 text-sm font-medium',
                index < activeStep
                  ? 'bg-blue-600 border-blue-600 text-white'
                  : index === activeStep
                  ? 'bg-blue-600 border-blue-600 text-white'
                  : 'bg-gray-100 border-gray-300 text-gray-500'
              )}
            >
              {index < activeStep ? (
                <Check className="w-4 h-4" />
              ) : (
                index + 1
              )}
            </div>
            <div className="ml-3">
              <div
                className={cn(
                  'text-sm font-medium',
                  index <= activeStep ? 'text-gray-900' : 'text-gray-500'
                )}
              >
                {step.props.title}
              </div>
              {step.props.description && (
                <div className="text-xs text-gray-500">
                  {step.props.description}
                </div>
              )}
            </div>
          </div>
          {index < children.length - 1 && (
            <div
              className={cn(
                'flex-1 h-0.5 mx-4',
                index < activeStep ? 'bg-blue-600' : 'bg-gray-300'
              )}
            />
          )}
        </React.Fragment>
      ))}
    </div>
  );
};

export const Step: React.FC<StepProps> = ({ title, description }) => {
  return null;
};
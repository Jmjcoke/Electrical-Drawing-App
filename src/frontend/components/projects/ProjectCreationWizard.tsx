import React, { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogFooter 
} from '../ui/Dialog';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Textarea } from '../ui/Textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/Select';
import { Label } from '../ui/Label';
import { Badge } from '../ui/Badge';
import { Stepper, Step } from '../ui/Stepper';
import { useProjectStore } from '../../stores/projectStore';
import { useUserStore } from '../../stores/userStore';
import type { ProjectCreate } from '../../types/api';

const projectSchema = z.object({
  name: z.string().min(1, 'Project name is required').max(200, 'Project name must be less than 200 characters'),
  description: z.string().min(1, 'Project description is required').max(1000, 'Description must be less than 1000 characters'),
  project_type: z.enum(['BROWNFIELD', 'GREENFIELD', 'RETROFIT', 'MAINTENANCE']),
  industry_sector: z.enum(['OIL_GAS', 'PETROCHEMICAL', 'REFINING', 'POWER_GENERATION', 'MINING', 'MANUFACTURING']),
  facility_type: z.enum(['OFFSHORE_PLATFORM', 'ONSHORE_FACILITY', 'REFINERY', 'CHEMICAL_PLANT', 'POWER_PLANT', 'MINING_SITE']).optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
  budget: z.number().min(0, 'Budget must be positive').optional(),
  start_date: z.string().min(1, 'Start date is required'),
  end_date: z.string().min(1, 'End date is required'),
  location: z.string().max(500, 'Location must be less than 500 characters').optional(),
  client_name: z.string().max(200, 'Client name must be less than 200 characters').optional(),
  settings: z.object({
    estimation_methodology: z.enum(['HISTORICAL', 'PARAMETRIC', 'DETAILED', 'HYBRID']),
    accuracy_target: z.enum(['CONCEPTUAL', 'PRELIMINARY', 'DEFINITIVE', 'CONTROL']),
    currency: z.string().min(3, 'Currency code required').max(3, 'Currency must be 3 characters'),
    labor_rates_region: z.string().max(100, 'Labor rates region must be less than 100 characters'),
    safety_factor: z.number().min(0).max(1, 'Safety factor must be between 0 and 1'),
    contingency_percentage: z.number().min(0).max(100, 'Contingency must be between 0 and 100'),
  }),
});

type ProjectFormData = z.infer<typeof projectSchema>;

interface ProjectCreationWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (project: any) => void;
}

const STEPS = [
  { id: 'basic', title: 'Basic Information' },
  { id: 'details', title: 'Project Details' },
  { id: 'settings', title: 'Configuration' },
  { id: 'review', title: 'Review & Create' },
];

export const ProjectCreationWizard: React.FC<ProjectCreationWizardProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { createProject } = useProjectStore();
  const { currentUser } = useUserStore();

  const {
    control,
    handleSubmit,
    formState: { errors, isValid },
    watch,
    trigger,
    reset,
  } = useForm<ProjectFormData>({
    resolver: zodResolver(projectSchema),
    defaultValues: {
      project_type: 'BROWNFIELD',
      industry_sector: 'OIL_GAS',
      priority: 'MEDIUM',
      settings: {
        estimation_methodology: 'HISTORICAL',
        accuracy_target: 'PRELIMINARY',
        currency: 'USD',
        labor_rates_region: 'Gulf Coast',
        safety_factor: 0.15,
        contingency_percentage: 20,
      },
    },
    mode: 'onChange',
  });

  const watchedValues = watch();

  const handleNext = async () => {
    const fieldsToValidate = getFieldsForStep(currentStep);
    const isStepValid = await trigger(fieldsToValidate);
    
    if (isStepValid) {
      setCurrentStep((prev) => Math.min(prev + 1, STEPS.length - 1));
    }
  };

  const handlePrevious = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 0));
  };

  const handleClose = () => {
    reset();
    setCurrentStep(0);
    setIsSubmitting(false);
    onClose();
  };

  const onSubmit = async (data: ProjectFormData) => {
    setIsSubmitting(true);
    try {
      const projectData: ProjectCreate = {
        ...data,
        status: 'PLANNING',
        created_by: currentUser?.id || '',
      };

      const newProject = await createProject(projectData);
      onSuccess?.(newProject);
      handleClose();
    } catch (error) {
      console.error('Failed to create project:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getFieldsForStep = (step: number): (keyof ProjectFormData)[] => {
    switch (step) {
      case 0:
        return ['name', 'description', 'project_type', 'industry_sector'];
      case 1:
        return ['priority', 'start_date', 'end_date', 'budget', 'location', 'client_name', 'facility_type'];
      case 2:
        return ['settings.estimation_methodology', 'settings.accuracy_target', 'settings.currency', 'settings.labor_rates_region', 'settings.safety_factor', 'settings.contingency_percentage'];
      default:
        return [];
    }
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 0:
        return (
          <div className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="name">Project Name *</Label>
              <Controller
                name="name"
                control={control}
                render={({ field }) => (
                  <Input
                    {...field}
                    id="name"
                    placeholder="Enter project name"
                    error={errors.name?.message}
                  />
                )}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description *</Label>
              <Controller
                name="description"
                control={control}
                render={({ field }) => (
                  <Textarea
                    {...field}
                    id="description"
                    placeholder="Describe the project scope and objectives"
                    error={errors.description?.message}
                    rows={4}
                  />
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="project_type">Project Type *</Label>
                <Controller
                  name="project_type"
                  control={control}
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select project type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="BROWNFIELD">Brownfield</SelectItem>
                        <SelectItem value="GREENFIELD">Greenfield</SelectItem>
                        <SelectItem value="RETROFIT">Retrofit</SelectItem>
                        <SelectItem value="MAINTENANCE">Maintenance</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="industry_sector">Industry Sector *</Label>
                <Controller
                  name="industry_sector"
                  control={control}
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select industry" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="OIL_GAS">Oil & Gas</SelectItem>
                        <SelectItem value="PETROCHEMICAL">Petrochemical</SelectItem>
                        <SelectItem value="REFINING">Refining</SelectItem>
                        <SelectItem value="POWER_GENERATION">Power Generation</SelectItem>
                        <SelectItem value="MINING">Mining</SelectItem>
                        <SelectItem value="MANUFACTURING">Manufacturing</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
            </div>
          </div>
        );

      case 1:
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="priority">Priority *</Label>
                <Controller
                  name="priority"
                  control={control}
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select priority" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="LOW">Low</SelectItem>
                        <SelectItem value="MEDIUM">Medium</SelectItem>
                        <SelectItem value="HIGH">High</SelectItem>
                        <SelectItem value="CRITICAL">Critical</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="facility_type">Facility Type</Label>
                <Controller
                  name="facility_type"
                  control={control}
                  render={({ field }) => (
                    <Select value={field.value || ''} onValueChange={field.onChange}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select facility type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="OFFSHORE_PLATFORM">Offshore Platform</SelectItem>
                        <SelectItem value="ONSHORE_FACILITY">Onshore Facility</SelectItem>
                        <SelectItem value="REFINERY">Refinery</SelectItem>
                        <SelectItem value="CHEMICAL_PLANT">Chemical Plant</SelectItem>
                        <SelectItem value="POWER_PLANT">Power Plant</SelectItem>
                        <SelectItem value="MINING_SITE">Mining Site</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="start_date">Start Date *</Label>
                <Controller
                  name="start_date"
                  control={control}
                  render={({ field }) => (
                    <Input
                      {...field}
                      id="start_date"
                      type="date"
                      error={errors.start_date?.message}
                    />
                  )}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="end_date">End Date *</Label>
                <Controller
                  name="end_date"
                  control={control}
                  render={({ field }) => (
                    <Input
                      {...field}
                      id="end_date"
                      type="date"
                      error={errors.end_date?.message}
                    />
                  )}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="budget">Budget (USD)</Label>
              <Controller
                name="budget"
                control={control}
                render={({ field }) => (
                  <Input
                    {...field}
                    id="budget"
                    type="number"
                    placeholder="Enter project budget"
                    error={errors.budget?.message}
                    onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) : undefined)}
                  />
                )}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="location">Location</Label>
              <Controller
                name="location"
                control={control}
                render={({ field }) => (
                  <Input
                    {...field}
                    id="location"
                    placeholder="Project location"
                    error={errors.location?.message}
                  />
                )}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="client_name">Client Name</Label>
              <Controller
                name="client_name"
                control={control}
                render={({ field }) => (
                  <Input
                    {...field}
                    id="client_name"
                    placeholder="Client or company name"
                    error={errors.client_name?.message}
                  />
                )}
              />
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Estimation Methodology *</Label>
                <Controller
                  name="settings.estimation_methodology"
                  control={control}
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="HISTORICAL">Historical Data</SelectItem>
                        <SelectItem value="PARAMETRIC">Parametric</SelectItem>
                        <SelectItem value="DETAILED">Detailed</SelectItem>
                        <SelectItem value="HYBRID">Hybrid</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>

              <div className="space-y-2">
                <Label>Accuracy Target *</Label>
                <Controller
                  name="settings.accuracy_target"
                  control={control}
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="CONCEPTUAL">Conceptual (±50%)</SelectItem>
                        <SelectItem value="PRELIMINARY">Preliminary (±30%)</SelectItem>
                        <SelectItem value="DEFINITIVE">Definitive (±15%)</SelectItem>
                        <SelectItem value="CONTROL">Control (±10%)</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Currency *</Label>
                <Controller
                  name="settings.currency"
                  control={control}
                  render={({ field }) => (
                    <Input
                      {...field}
                      placeholder="USD"
                      maxLength={3}
                      error={errors.settings?.currency?.message}
                    />
                  )}
                />
              </div>

              <div className="space-y-2">
                <Label>Labor Rates Region *</Label>
                <Controller
                  name="settings.labor_rates_region"
                  control={control}
                  render={({ field }) => (
                    <Input
                      {...field}
                      placeholder="e.g., Gulf Coast, North Sea"
                      error={errors.settings?.labor_rates_region?.message}
                    />
                  )}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Safety Factor *</Label>
                <Controller
                  name="settings.safety_factor"
                  control={control}
                  render={({ field }) => (
                    <Input
                      {...field}
                      type="number"
                      step="0.01"
                      min="0"
                      max="1"
                      placeholder="0.15"
                      error={errors.settings?.safety_factor?.message}
                      onChange={(e) => field.onChange(parseFloat(e.target.value))}
                    />
                  )}
                />
              </div>

              <div className="space-y-2">
                <Label>Contingency % *</Label>
                <Controller
                  name="settings.contingency_percentage"
                  control={control}
                  render={({ field }) => (
                    <Input
                      {...field}
                      type="number"
                      min="0"
                      max="100"
                      placeholder="20"
                      error={errors.settings?.contingency_percentage?.message}
                      onChange={(e) => field.onChange(parseFloat(e.target.value))}
                    />
                  )}
                />
              </div>
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold">Review Project Information</h3>
            
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-gray-500">Project Name</Label>
                  <p className="mt-1">{watchedValues.name}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-500">Type</Label>
                  <p className="mt-1">
                    <Badge variant="outline">{watchedValues.project_type}</Badge>
                  </p>
                </div>
              </div>

              <div>
                <Label className="text-sm font-medium text-gray-500">Description</Label>
                <p className="mt-1 text-sm">{watchedValues.description}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-gray-500">Industry</Label>
                  <p className="mt-1">{watchedValues.industry_sector?.replace('_', ' ')}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-500">Priority</Label>
                  <p className="mt-1">
                    <Badge 
                      variant={watchedValues.priority === 'CRITICAL' ? 'destructive' : 
                              watchedValues.priority === 'HIGH' ? 'default' : 'secondary'}
                    >
                      {watchedValues.priority}
                    </Badge>
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-gray-500">Start Date</Label>
                  <p className="mt-1">{watchedValues.start_date}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-500">End Date</Label>
                  <p className="mt-1">{watchedValues.end_date}</p>
                </div>
              </div>

              {watchedValues.budget && (
                <div>
                  <Label className="text-sm font-medium text-gray-500">Budget</Label>
                  <p className="mt-1">${watchedValues.budget.toLocaleString()}</p>
                </div>
              )}

              <div className="pt-4 border-t">
                <Label className="text-sm font-medium text-gray-500">Configuration Settings</Label>
                <div className="mt-2 grid grid-cols-2 gap-4 text-sm">
                  <div>Methodology: {watchedValues.settings?.estimation_methodology}</div>
                  <div>Accuracy: {watchedValues.settings?.accuracy_target}</div>
                  <div>Currency: {watchedValues.settings?.currency}</div>
                  <div>Safety Factor: {watchedValues.settings?.safety_factor}</div>
                </div>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Project</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          <Stepper activeStep={currentStep}>
            {STEPS.map((step, index) => (
              <Step key={step.id} title={step.title} />
            ))}
          </Stepper>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {renderStepContent()}
          </form>
        </div>

        <DialogFooter>
          <div className="flex justify-between w-full">
            <Button
              type="button"
              variant="outline"
              onClick={handlePrevious}
              disabled={currentStep === 0}
            >
              Previous
            </Button>

            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              
              {currentStep === STEPS.length - 1 ? (
                <Button
                  type="submit"
                  onClick={handleSubmit(onSubmit)}
                  disabled={!isValid || isSubmitting}
                  loading={isSubmitting}
                >
                  Create Project
                </Button>
              ) : (
                <Button type="button" onClick={handleNext}>
                  Next
                </Button>
              )}
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
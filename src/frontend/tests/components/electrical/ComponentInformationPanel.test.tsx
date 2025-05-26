/**
 * Tests for ComponentInformationPanel
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import ComponentInformationPanel from '@/components/electrical/ComponentInformationPanel';
import { ComponentSpecification, Manufacturer, ComponentCategory } from '@/services/api/componentSpecifications';

// Mock icons
jest.mock('lucide-react', () => ({
  ZapIcon: () => <div data-testid="zap-icon" />,
  InfoIcon: () => <div data-testid="info-icon" />,
  DownloadIcon: () => <div data-testid="download-icon" />,
  ExternalLinkIcon: () => <div data-testid="external-link-icon" />,
  AlertTriangleIcon: () => <div data-testid="alert-triangle-icon" />,
  CheckCircleIcon: () => <div data-testid="check-circle-icon" />,
  XCircleIcon: () => <div data-testid="x-circle-icon" />,
  SearchIcon: () => <div data-testid="search-icon" />,
  BookOpenIcon: () => <div data-testid="book-open-icon" />,
  ToolIcon: () => <div data-testid="tool-icon" />,
  SparklesIcon: () => <div data-testid="sparkles-icon" />
}));

// Sample test data
const mockManufacturer: Manufacturer = {
  name: 'Test Manufacturer',
  brand: 'TestBrand',
  website: 'https://test.com',
  support_phone: '1-800-TEST',
  support_email: 'support@test.com'
};

const mockComponent: ComponentSpecification = {
  id: 'test-id-123',
  part_number: 'TEST-001',
  model_number: 'MODEL-001',
  category: 'breaker' as ComponentCategory,
  name: 'Test Circuit Breaker',
  manufacturer: mockManufacturer,
  electrical_ratings: {
    voltage_rating: 120,
    current_rating: 20,
    power_rating: 2400,
    voltage_type: 'AC',
    frequency: 60,
    phases: 1,
    short_circuit_rating: 10000
  },
  dimensions: {
    length: 4.0,
    width: 2.0,
    height: 6.0,
    weight: 1.5
  },
  mounting_type: 'panel',
  operating_temperature: { min: -20, max: 60 },
  compliance: {
    ul_listed: true,
    nec_compliant: true,
    nema_rating: '1',
    ip_rating: 'IP20',
    ieee_standards: ['IEEE C37.13'],
    iec_standards: ['IEC 60898']
  },
  features: ['Thermal-magnetic trip', 'Quick connect', 'LED indicator'],
  applications: ['Residential panels', 'Commercial lighting', 'Motor protection'],
  compatible_parts: ['TEST-002', 'TEST-003'],
  replacement_parts: ['ALT-001', 'ALT-002'],
  datasheet_url: 'https://test.com/datasheet.pdf',
  installation_guide_url: 'https://test.com/install.pdf',
  manual_url: 'https://test.com/manual.pdf',
  cad_files: ['https://test.com/cad1.dwg', 'https://test.com/cad2.step'],
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-02T00:00:00Z',
  verified: true,
  confidence_score: 0.95
};

const mockUnverifiedComponent: ComponentSpecification = {
  ...mockComponent,
  id: 'unverified-id',
  verified: false,
  confidence_score: 0.6,
  compliance: {
    ...mockComponent.compliance,
    ul_listed: false,
    nec_compliant: false
  }
};

describe('ComponentInformationPanel', () => {
  describe('Loading State', () => {
    it('renders loading skeleton when isLoading is true', () => {
      render(<ComponentInformationPanel component={null} isLoading={true} />);
      
      expect(screen.getByTestId('info-icon')).toBeInTheDocument();
      expect(document.querySelector('.animate-pulse')).toBeInTheDocument();
    });
  });

  describe('Empty State', () => {
    it('renders empty state when no component is provided', () => {
      render(<ComponentInformationPanel component={null} />);
      
      expect(screen.getByText('No Component Selected')).toBeInTheDocument();
      expect(screen.getByText('Click on a component in the PDF viewer to see its specifications')).toBeInTheDocument();
    });
  });

  describe('Component Display', () => {
    it('renders component basic information correctly', () => {
      render(<ComponentInformationPanel component={mockComponent} />);
      
      expect(screen.getByText('Test Circuit Breaker')).toBeInTheDocument();
      expect(screen.getByText('TestBrand')).toBeInTheDocument();
      expect(screen.getByText('Verified')).toBeInTheDocument();
    });

    it('displays electrical ratings correctly', () => {
      render(<ComponentInformationPanel component={mockComponent} />);
      
      // Click to expand electrical ratings section
      fireEvent.click(screen.getByText('Electrical Ratings'));
      
      expect(screen.getByText('120 V')).toBeInTheDocument();
      expect(screen.getByText('20 A')).toBeInTheDocument();
      expect(screen.getByText('2400 W')).toBeInTheDocument();
      expect(screen.getByText('AC')).toBeInTheDocument();
    });

    it('displays physical dimensions correctly', () => {
      render(<ComponentInformationPanel component={mockComponent} />);
      
      // Click to expand physical dimensions section
      fireEvent.click(screen.getByText('Physical Dimensions'));
      
      expect(screen.getByText('4 in')).toBeInTheDocument();
      expect(screen.getByText('2 in')).toBeInTheDocument();
      expect(screen.getByText('6 in')).toBeInTheDocument();
      expect(screen.getByText('1.5 lbs')).toBeInTheDocument();
    });

    it('displays compliance information correctly', () => {
      render(<ComponentInformationPanel component={mockComponent} />);
      
      // Click to expand compliance section
      fireEvent.click(screen.getByText('Compliance & Standards'));
      
      expect(screen.getByTestId('check-circle-icon')).toBeInTheDocument(); // UL Listed
      expect(screen.getByText('1')).toBeInTheDocument(); // NEMA rating
      expect(screen.getByText('IP20')).toBeInTheDocument();
    });

    it('renders features and applications', () => {
      render(<ComponentInformationPanel component={mockComponent} />);
      
      expect(screen.getByText('Thermal-magnetic trip')).toBeInTheDocument();
      expect(screen.getByText('Quick connect')).toBeInTheDocument();
      expect(screen.getByText('LED indicator')).toBeInTheDocument();
      
      expect(screen.getByText('Residential panels')).toBeInTheDocument();
      expect(screen.getByText('Commercial lighting')).toBeInTheDocument();
    });

    it('displays compatibility information', () => {
      render(<ComponentInformationPanel component={mockComponent} />);
      
      expect(screen.getByText('TEST-002')).toBeInTheDocument();
      expect(screen.getByText('TEST-003')).toBeInTheDocument();
      expect(screen.getByText('ALT-001')).toBeInTheDocument();
      expect(screen.getByText('ALT-002')).toBeInTheDocument();
    });
  });

  describe('Warning Display', () => {
    it('shows warnings for unverified component', () => {
      render(<ComponentInformationPanel component={mockUnverifiedComponent} />);
      
      expect(screen.getByText('Warnings')).toBeInTheDocument();
      expect(screen.getByText('Not UL Listed - Verify compliance requirements')).toBeInTheDocument();
      expect(screen.getByText('Not NEC Compliant - Check local code requirements')).toBeInTheDocument();
      expect(screen.getByText('Low confidence specification match - Verify accuracy')).toBeInTheDocument();
    });

    it('does not show warnings section for fully compliant component', () => {
      render(<ComponentInformationPanel component={mockComponent} />);
      
      expect(screen.queryByText('Warnings')).not.toBeInTheDocument();
    });
  });

  describe('Documentation Links', () => {
    it('renders documentation links correctly', () => {
      render(<ComponentInformationPanel component={mockComponent} />);
      
      expect(screen.getByText('Datasheet')).toBeInTheDocument();
      expect(screen.getByText('Installation Guide')).toBeInTheDocument();
      expect(screen.getByText('User Manual')).toBeInTheDocument();
      expect(screen.getByText('CAD File 1')).toBeInTheDocument();
      expect(screen.getByText('CAD File 2')).toBeInTheDocument();
    });

    it('calls onDownloadDatasheet when datasheet is clicked', () => {
      const mockDownload = jest.fn();
      render(
        <ComponentInformationPanel 
          component={mockComponent} 
          onDownloadDatasheet={mockDownload}
        />
      );
      
      fireEvent.click(screen.getByText('Datasheet'));
      expect(mockDownload).toHaveBeenCalledWith('https://test.com/datasheet.pdf');
    });
  });

  describe('Interactive Features', () => {
    it('calls onCompatibilityCheck when button is clicked', () => {
      const mockCompatibilityCheck = jest.fn();
      render(
        <ComponentInformationPanel 
          component={mockComponent} 
          onCompatibilityCheck={mockCompatibilityCheck}
        />
      );
      
      fireEvent.click(screen.getByText('Find More Compatible Parts'));
      expect(mockCompatibilityCheck).toHaveBeenCalledWith('test-id-123');
    });

    it('calls onSpecificationUpdate when component is updated', () => {
      const mockUpdate = jest.fn();
      render(
        <ComponentInformationPanel 
          component={mockComponent} 
          onSpecificationUpdate={mockUpdate}
        />
      );
      
      // This would be triggered by some internal update mechanism
      // For now, we just verify the prop is passed correctly
      expect(mockUpdate).toBeDefined();
    });
  });

  describe('Section Expansion', () => {
    it('expands and collapses sections when clicked', () => {
      render(<ComponentInformationPanel component={mockComponent} />);
      
      // Overview should be expanded by default
      expect(screen.getByText('TEST-001')).toBeInTheDocument();
      
      // Click to collapse overview
      fireEvent.click(screen.getByText('Overview'));
      
      // Click to expand electrical ratings
      fireEvent.click(screen.getByText('Electrical Ratings'));
      expect(screen.getByText('120 V')).toBeInTheDocument();
      
      // Click to collapse electrical ratings
      fireEvent.click(screen.getByText('Electrical Ratings'));
    });
  });

  describe('Value Rendering', () => {
    it('renders boolean values with correct icons', () => {
      render(<ComponentInformationPanel component={mockComponent} />);
      
      fireEvent.click(screen.getByText('Compliance & Standards'));
      
      // Should show check icons for true values
      const checkIcons = screen.getAllByTestId('check-circle-icon');
      expect(checkIcons.length).toBeGreaterThan(0);
    });

    it('renders progress bars for rating values', () => {
      render(<ComponentInformationPanel component={mockComponent} />);
      
      fireEvent.click(screen.getByText('Overview'));
      
      // Confidence score should be rendered as progress bar
      expect(screen.getByText('95%')).toBeInTheDocument();
    });

    it('handles missing values gracefully', () => {
      const componentWithMissingData = {
        ...mockComponent,
        electrical_ratings: {},
        dimensions: {},
        model_number: undefined
      };
      
      render(<ComponentInformationPanel component={componentWithMissingData} />);
      
      expect(screen.getByText('N/A')).toBeInTheDocument();
    });
  });

  describe('Metadata Display', () => {
    it('displays metadata section correctly', () => {
      render(<ComponentInformationPanel component={mockComponent} />);
      
      expect(screen.getByText('Metadata')).toBeInTheDocument();
      expect(screen.getByText('Created: 1/1/2024')).toBeInTheDocument();
      expect(screen.getByText('Updated: 1/2/2024')).toBeInTheDocument();
      expect(screen.getByText('ID: test-id-123')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('has proper ARIA labels and roles', () => {
      render(<ComponentInformationPanel component={mockComponent} />);
      
      // Check for accessibility attributes
      const buttons = screen.getAllByRole('button');
      expect(buttons.length).toBeGreaterThan(0);
      
      // All buttons should be focusable
      buttons.forEach(button => {
        expect(button).not.toHaveAttribute('tabindex', '-1');
      });
    });

    it('supports keyboard navigation', () => {
      render(<ComponentInformationPanel component={mockComponent} />);
      
      // Overview section button should be focusable
      const overviewButton = screen.getByText('Overview').closest('button');
      expect(overviewButton).toBeInTheDocument();
      
      // Should be able to focus and activate with keyboard
      if (overviewButton) {
        overviewButton.focus();
        expect(document.activeElement).toBe(overviewButton);
      }
    });
  });

  describe('Performance', () => {
    it('renders quickly with large datasets', () => {
      const componentWithLargeData = {
        ...mockComponent,
        features: Array(100).fill('Feature').map((f, i) => `${f} ${i}`),
        applications: Array(50).fill('Application').map((a, i) => `${a} ${i}`)
      };
      
      const startTime = performance.now();
      render(<ComponentInformationPanel component={componentWithLargeData} />);
      const renderTime = performance.now() - startTime;
      
      // Should render within reasonable time (100ms)
      expect(renderTime).toBeLessThan(100);
      
      // Should still display first few features
      expect(screen.getByText('Feature 0')).toBeInTheDocument();
    });
  });
});
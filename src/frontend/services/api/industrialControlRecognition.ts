import { ApiResponse, BoundingBox } from '../../types/api';

// Types for industrial control device recognition
export interface IndustrialDeviceSpecification {
  manufacturer: string;
  model_number: string;
  series?: string;
  category: string;
  voltage_rating?: number;
  current_rating?: number;
  power_consumption?: number;
  supply_voltage_range?: [number, number];
  digital_inputs?: number;
  digital_outputs?: number;
  analog_inputs?: number;
  analog_outputs?: number;
  communication_protocols: string[];
  network_ports?: number;
  serial_ports?: number;
  dimensions: Record<string, number>;
  mounting_type?: string;
  operating_temperature?: [number, number];
  ip_rating?: string;
  measurement_range?: [number, number];
  accuracy?: number;
  resolution?: number;
  units?: string;
  motor_hp_range?: [number, number];
  speed_range?: [number, number];
  torque_rating?: number;
  certifications: string[];
  hazardous_area_rating?: string;
  sil_rating?: string;
  datasheet_url?: string;
  manual_url?: string;
  wiring_diagram_url?: string;
  installation_notes: string;
  price_estimate?: number;
  availability: string;
  replacement_parts: string[];
  end_of_life?: string;
}

export interface ISASymbolRecognition {
  symbol_type: string;
  isa_code: string;
  description: string;
  confidence: number;
  bounding_box: [number, number, number, number];
  tag_number?: string;
  loop_identifier?: string;
}

export interface ControlLoopIdentification {
  loop_id: string;
  loop_type: string;
  components: string[];
  control_strategy?: string;
  setpoint?: number;
  process_variable?: string;
  controlled_variable?: string;
}

export interface IndustrialRecognitionResult {
  component_id: string;
  category: string;
  confidence: number;
  bounding_box: [number, number, number, number];
  specifications?: IndustrialDeviceSpecification;
  isa_symbol?: ISASymbolRecognition;
  control_loop?: ControlLoopIdentification;
  visual_features: Record<string, any>;
  recognition_timestamp: string;
  alternative_matches: Array<{
    category: string;
    confidence: number;
  }>;
  network_connections: string[];
}

export interface IndustrialAnalysisRequest {
  bounding_boxes: BoundingBox[];
  include_isa_symbols?: boolean;
  include_control_loops?: boolean;
  include_network_topology?: boolean;
}

export interface IndustrialAnalysisResponse {
  success: boolean;
  industrial_devices: IndustrialRecognitionResult[];
  isa_symbols: ISASymbolRecognition[];
  control_loops: ControlLoopIdentification[];
  network_topology: {
    protocols: string[];
    devices_by_protocol: Record<string, Array<{
      component_id: string;
      category: string;
      network_connections: string[];
    }>>;
    total_networked_devices: number;
  };
  processing_time: number;
}

export interface ControlSystemArchitectureRequest {
  drawing_image_path: string;
  analysis_scope?: 'full' | 'power_only' | 'control_only';
  include_safety_systems?: boolean;
  include_communication_networks?: boolean;
}

export interface ControlSystemArchitectureResponse {
  success: boolean;
  system_hierarchy: {
    supervision_level: {
      hmi_systems: any[];
      scada_systems: any[];
      historian_systems: any[];
    };
    control_level: {
      plc_systems: any[];
      dcs_systems: any[];
      safety_systems: any[];
    };
    field_level: {
      sensors: any[];
      actuators: any[];
      field_devices: any[];
    };
  };
  communication_networks: Array<{
    network_type: string;
    devices: any[];
    topology: string;
    redundancy: string;
  }>;
  io_summary: {
    total_digital_inputs: number;
    total_digital_outputs: number;
    total_analog_inputs: number;
    total_analog_outputs: number;
    spare_capacity: {
      digital_inputs: number;
      digital_outputs: number;
      analog_inputs: number;
      analog_outputs: number;
    };
  };
  control_loops: ControlLoopIdentification[];
  safety_systems: any[];
}

export interface ComponentRecognitionRequest {
  bounding_boxes: BoundingBox[];
  enable_specification_lookup?: boolean;
  enable_industrial_analysis?: boolean;
}

export interface ComponentRecognitionResponse {
  success: boolean;
  results: Array<{
    component_id: string;
    category: string;
    confidence: number;
    confidence_level: string;
    bounding_box: [number, number, number, number];
    recognition_timestamp: string;
    alternative_matches: Array<{
      category: string;
      confidence: number;
    }>;
    visual_features: Record<string, any>;
    specifications?: any;
    industrial_analysis?: {
      category: string;
      confidence: number;
      isa_symbol?: ISASymbolRecognition;
      control_loop?: ControlLoopIdentification;
      network_connections: string[];
    };
  }>;
  processing_time: number;
  total_components: number;
}

class IndustrialControlRecognitionService {
  private baseUrl: string;

  constructor(baseUrl: string = process.env.NEXT_PUBLIC_COMPONENT_INTELLIGENCE_API || 'http://localhost:8001') {
    this.baseUrl = baseUrl;
  }

  /**
   * Recognize electrical components with optional industrial analysis
   */
  async recognizeComponents(
    imageFile: File,
    request: ComponentRecognitionRequest
  ): Promise<ApiResponse<ComponentRecognitionResponse>> {
    try {
      const formData = new FormData();
      formData.append('image', imageFile);
      formData.append('request_data', JSON.stringify(request));

      const response = await fetch(`${this.baseUrl}/recognize-components`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      return { success: true, data };
    } catch (error) {
      console.error('Error recognizing components:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  /**
   * Perform comprehensive industrial system analysis
   */
  async analyzeIndustrialSystems(
    imageFile: File,
    request: IndustrialAnalysisRequest
  ): Promise<ApiResponse<IndustrialAnalysisResponse>> {
    try {
      const formData = new FormData();
      formData.append('image', imageFile);
      formData.append('request_data', JSON.stringify({
        bounding_boxes: request.bounding_boxes,
        include_isa_symbols: request.include_isa_symbols ?? true,
        include_control_loops: request.include_control_loops ?? true,
        include_network_topology: request.include_network_topology ?? true
      }));

      const response = await fetch(`${this.baseUrl}/industrial-analysis`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      return { success: true, data };
    } catch (error) {
      console.error('Error analyzing industrial systems:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  /**
   * Analyze complete control system architecture
   */
  async analyzeControlSystemArchitecture(
    imageFile: File,
    request: ControlSystemArchitectureRequest
  ): Promise<ApiResponse<ControlSystemArchitectureResponse>> {
    try {
      const formData = new FormData();
      formData.append('image', imageFile);
      formData.append('request_data', JSON.stringify({
        drawing_image_path: request.drawing_image_path,
        analysis_scope: request.analysis_scope ?? 'full',
        include_safety_systems: request.include_safety_systems ?? true,
        include_communication_networks: request.include_communication_networks ?? true
      }));

      const response = await fetch(`${this.baseUrl}/control-system-architecture`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      return { success: true, data };
    } catch (error) {
      console.error('Error analyzing control system architecture:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  /**
   * Get service health and statistics
   */
  async getServiceHealth(): Promise<ApiResponse<any>> {
    try {
      const response = await fetch(`${this.baseUrl}/health`);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      return { success: true, data };
    } catch (error) {
      console.error('Error getting service health:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Service unavailable'
      };
    }
  }

  /**
   * Get recognition statistics
   */
  async getStatistics(): Promise<ApiResponse<any>> {
    try {
      const response = await fetch(`${this.baseUrl}/statistics`);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      return { success: true, data };
    } catch (error) {
      console.error('Error getting statistics:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  /**
   * Format industrial device category for display
   */
  formatDeviceCategory(category: string): string {
    return category
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (l) => l.toUpperCase());
  }

  /**
   * Format communication protocol for display
   */
  formatProtocol(protocol: string): string {
    return protocol.replace(/_/g, '/').toUpperCase();
  }

  /**
   * Get category icon name for UI components
   */
  getCategoryIcon(category: string): string {
    const iconMap: Record<string, string> = {
      'plc': 'cpu',
      'hmi': 'monitor',
      'vfd': 'zap',
      'pressure_transmitter': 'gauge',
      'temperature_transmitter': 'thermometer',
      'flow_transmitter': 'activity',
      'control_valve': 'settings',
      'ethernet_switch': 'network',
      'safety_plc': 'shield',
      'motor_starter': 'zap',
      'bas_controller': 'radio',
      'proximity_sensor': 'eye',
      'photoelectric_sensor': 'sun',
      'solenoid_valve': 'toggle-left',
      'emergency_stop': 'stop-circle',
      'ups': 'battery'
    };
    
    return iconMap[category] || 'settings';
  }

  /**
   * Get confidence level color for UI display
   */
  getConfidenceColor(confidence: number): string {
    if (confidence >= 0.95) return 'emerald';
    if (confidence >= 0.85) return 'blue';
    if (confidence >= 0.70) return 'yellow';
    return 'red';
  }

  /**
   * Validate ISA tag number format
   */
  validateISATagNumber(tagNumber: string): boolean {
    // Basic ISA tag number validation (e.g., TI-101, PT-205)
    const tagPattern = /^[A-Z]{1,3}-?\d{1,4}$/;
    return tagPattern.test(tagNumber);
  }

  /**
   * Extract loop number from ISA tag
   */
  extractLoopNumber(tagNumber: string): string | null {
    const parts = tagNumber.split('-');
    return parts.length === 2 ? parts[1] : null;
  }

  /**
   * Get SIL rating color
   */
  getSILRatingColor(silRating: string): string {
    switch (silRating) {
      case 'SIL 1': return 'green';
      case 'SIL 2': return 'yellow';
      case 'SIL 3': return 'orange';
      case 'SIL 4': return 'red';
      default: return 'gray';
    }
  }

  /**
   * Check if device supports specific protocol
   */
  supportsProtocol(device: IndustrialDeviceSpecification, protocol: string): boolean {
    return device.communication_protocols.includes(protocol);
  }

  /**
   * Get device mounting type icon
   */
  getMountingTypeIcon(mountingType: string): string {
    const mountingIcons: Record<string, string> = {
      'din_rail': 'minus',
      'panel_mount': 'square',
      'field_mount': 'map-pin'
    };
    
    return mountingIcons[mountingType] || 'box';
  }
}

// Export singleton instance
export const industrialControlRecognitionService = new IndustrialControlRecognitionService();
export default IndustrialControlRecognitionService;
/**
 * Component Specifications API Service
 * 
 * Provides frontend API calls to the component specifications microservice
 */

export interface ComponentSpecification {
  id: string;
  part_number: string;
  model_number?: string;
  category: ComponentCategory;
  name: string;
  manufacturer: Manufacturer;
  electrical_ratings: ElectricalRatings;
  dimensions: Dimensions;
  mounting_type?: MountingType;
  operating_temperature?: { min: number; max: number };
  compliance: Compliance;
  features: string[];
  applications: string[];
  compatible_parts: string[];
  replacement_parts: string[];
  datasheet_url?: string;
  installation_guide_url?: string;
  manual_url?: string;
  cad_files: string[];
  created_at: string;
  updated_at: string;
  verified: boolean;
  confidence_score: number;
}

export interface Manufacturer {
  name: string;
  brand?: string;
  website?: string;
  support_phone?: string;
  support_email?: string;
}

export interface ElectricalRatings {
  voltage_rating?: number;
  current_rating?: number;
  power_rating?: number;
  voltage_type?: 'AC' | 'DC' | 'BOTH';
  frequency?: number;
  phases?: number;
  short_circuit_rating?: number;
}

export interface Dimensions {
  length?: number;
  width?: number;
  height?: number;
  depth?: number;
  weight?: number;
}

export interface Compliance {
  ul_listed: boolean;
  nec_compliant: boolean;
  nema_rating?: string;
  ip_rating?: string;
  ieee_standards: string[];
  iec_standards: string[];
}

export type ComponentCategory = 
  | 'breaker'
  | 'switch'
  | 'outlet'
  | 'light_fixture'
  | 'motor'
  | 'transformer'
  | 'panel'
  | 'conduit'
  | 'wire'
  | 'junction_box'
  | 'disconnect'
  | 'relay'
  | 'contactor'
  | 'fuse'
  | 'meter'
  | 'sensor'
  | 'other';

export type MountingType = 'surface' | 'flush' | 'pole' | 'rack' | 'din_rail' | 'panel';

export interface ComponentSearchRequest {
  query?: string;
  category?: ComponentCategory;
  manufacturer?: string;
  voltage_min?: number;
  voltage_max?: number;
  current_min?: number;
  current_max?: number;
  nema_rating?: string;
  ul_listed_only?: boolean;
}

export interface ComponentSearchResponse {
  components: ComponentSpecification[];
  total_count: number;
  page: number;
  page_size: number;
  has_next: boolean;
}

export interface DatabaseStats {
  total_components: number;
  verified_components: number;
  verification_rate: number;
  categories: Record<string, number>;
  manufacturers: Record<string, number>;
  top_manufacturers: [string, number][];
}

class ComponentSpecificationsAPI {
  private baseUrl: string;

  constructor() {
    this.baseUrl = process.env.NEXT_PUBLIC_COMPONENT_SPECS_API_URL || 'http://localhost:8003';
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || `API request failed: ${response.status}`);
    }

    return response.json();
  }

  /**
   * Get health status of the component specifications service
   */
  async getHealth(): Promise<{ status: string; service: string }> {
    return this.request('/health');
  }

  /**
   * Get a specific component by ID
   */
  async getComponent(componentId: string): Promise<ComponentSpecification> {
    return this.request(`/components/${componentId}`);
  }

  /**
   * Get a component by part number
   */
  async getComponentByPartNumber(partNumber: string): Promise<ComponentSpecification> {
    return this.request(`/components/part-number/${encodeURIComponent(partNumber)}`);
  }

  /**
   * Search components with filters and pagination
   */
  async searchComponents(
    searchRequest: ComponentSearchRequest,
    page: number = 1,
    pageSize: number = 20
  ): Promise<ComponentSearchResponse> {
    const url = `/components/search?page=${page}&page_size=${pageSize}`;
    return this.request(url, {
      method: 'POST',
      body: JSON.stringify(searchRequest),
    });
  }

  /**
   * List components with optional filters
   */
  async listComponents(
    filters: {
      category?: ComponentCategory;
      manufacturer?: string;
      page?: number;
      page_size?: number;
    } = {}
  ): Promise<ComponentSearchResponse> {
    const params = new URLSearchParams();
    
    if (filters.category) params.append('category', filters.category);
    if (filters.manufacturer) params.append('manufacturer', filters.manufacturer);
    if (filters.page) params.append('page', filters.page.toString());
    if (filters.page_size) params.append('page_size', filters.page_size.toString());

    const query = params.toString() ? `?${params.toString()}` : '';
    return this.request(`/components${query}`);
  }

  /**
   * Create a new component specification
   */
  async createComponent(component: Omit<ComponentSpecification, 'id' | 'created_at' | 'updated_at'>): Promise<ComponentSpecification> {
    return this.request('/components', {
      method: 'POST',
      body: JSON.stringify(component),
    });
  }

  /**
   * Update a component specification
   */
  async updateComponent(componentId: string, component: ComponentSpecification): Promise<ComponentSpecification> {
    return this.request(`/components/${componentId}`, {
      method: 'PUT',
      body: JSON.stringify(component),
    });
  }

  /**
   * Delete a component specification
   */
  async deleteComponent(componentId: string): Promise<{ message: string }> {
    return this.request(`/components/${componentId}`, {
      method: 'DELETE',
    });
  }

  /**
   * Get list of all manufacturers
   */
  async getManufacturers(): Promise<string[]> {
    return this.request('/manufacturers');
  }

  /**
   * Get list of all component categories
   */
  async getCategories(): Promise<ComponentCategory[]> {
    return this.request('/categories');
  }

  /**
   * Get components compatible with the specified component
   */
  async getCompatibleComponents(componentId: string): Promise<ComponentSpecification[]> {
    return this.request(`/components/${componentId}/compatible`);
  }

  /**
   * Get database statistics
   */
  async getDatabaseStats(): Promise<DatabaseStats> {
    return this.request('/stats');
  }

  /**
   * Search components by text query
   */
  async quickSearch(query: string, limit: number = 10): Promise<ComponentSpecification[]> {
    const response = await this.searchComponents({ query }, 1, limit);
    return response.components;
  }

  /**
   * Get component specifications for multiple part numbers
   */
  async getMultipleComponents(partNumbers: string[]): Promise<ComponentSpecification[]> {
    const components: ComponentSpecification[] = [];
    
    // Use Promise.allSettled to handle cases where some components might not be found
    const results = await Promise.allSettled(
      partNumbers.map(partNumber => this.getComponentByPartNumber(partNumber))
    );
    
    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        components.push(result.value);
      } else {
        console.warn(`Component not found for part number: ${partNumbers[index]}`);
      }
    });
    
    return components;
  }

  /**
   * Get components by category with caching
   */
  private categoryCache = new Map<ComponentCategory, { data: ComponentSpecification[]; timestamp: number }>();
  private cacheTimeout = 5 * 60 * 1000; // 5 minutes

  async getComponentsByCategory(category: ComponentCategory, useCache: boolean = true): Promise<ComponentSpecification[]> {
    if (useCache && this.categoryCache.has(category)) {
      const cached = this.categoryCache.get(category)!;
      if (Date.now() - cached.timestamp < this.cacheTimeout) {
        return cached.data;
      }
    }

    const response = await this.listComponents({ category, page_size: 1000 });
    const components = response.components;

    if (useCache) {
      this.categoryCache.set(category, { data: components, timestamp: Date.now() });
    }

    return components;
  }

  /**
   * Clear category cache
   */
  clearCache(): void {
    this.categoryCache.clear();
  }

  /**
   * Get component specifications for detected components in PDF
   */
  async getSpecificationsForDetectedComponents(
    detectedComponents: Array<{ part_number?: string; category?: ComponentCategory; confidence: number }>
  ): Promise<Array<{ detected: any; specification?: ComponentSpecification }>> {
    const results = [];

    for (const detected of detectedComponents) {
      let specification: ComponentSpecification | undefined;

      try {
        if (detected.part_number) {
          // Try to find by exact part number first
          specification = await this.getComponentByPartNumber(detected.part_number);
        } else if (detected.category) {
          // If no part number, search by category and pick best match
          const categoryComponents = await this.getComponentsByCategory(detected.category);
          // For now, just take the first one - in practice, you'd use ML to match
          specification = categoryComponents[0];
        }
      } catch (error) {
        console.warn(`Could not find specification for component:`, detected);
      }

      results.push({
        detected,
        specification
      });
    }

    return results;
  }
}

// Export singleton instance
export const componentSpecificationsAPI = new ComponentSpecificationsAPI();
export default componentSpecificationsAPI;
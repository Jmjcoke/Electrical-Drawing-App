// User-related types
export interface User {
  id: string;
  email: string;
  full_name: string | null;
  avatar: string | null;
  role: UserRole;
  department: string | null;
  phone: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  last_login: string | null;
}

export type UserRole = 
  | 'SUPER_ADMIN'
  | 'PROJECT_MANAGER'
  | 'LEAD_ENGINEER'
  | 'SENIOR_ENGINEER'
  | 'ENGINEER'
  | 'CLIENT_REPRESENTATIVE'
  | 'VIEWER';

// Project-related types
export interface Project {
  id: string;
  name: string;
  description: string;
  status: ProjectStatus;
  priority: ProjectPriority;
  project_type: ProjectType | null;
  industry_sector: IndustrySector | null;
  facility_type: FacilityType | null;
  budget: number | null;
  start_date: string;
  end_date: string;
  location: string | null;
  client_name: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  team_members?: ProjectTeamMember[];
  settings?: ProjectSettings;
  milestones?: ProjectMilestone[];
}

export type ProjectStatus = 
  | 'PLANNING'
  | 'ACTIVE'
  | 'ON_HOLD'
  | 'COMPLETED'
  | 'CANCELLED';

export type ProjectPriority = 
  | 'LOW'
  | 'MEDIUM'
  | 'HIGH'
  | 'CRITICAL';

export type ProjectType = 
  | 'BROWNFIELD'
  | 'GREENFIELD'
  | 'RETROFIT'
  | 'MAINTENANCE';

export type IndustrySector = 
  | 'OIL_GAS'
  | 'PETROCHEMICAL'
  | 'REFINING'
  | 'POWER_GENERATION'
  | 'MINING'
  | 'MANUFACTURING';

export type FacilityType = 
  | 'OFFSHORE_PLATFORM'
  | 'ONSHORE_FACILITY'
  | 'REFINERY'
  | 'CHEMICAL_PLANT'
  | 'POWER_PLANT'
  | 'MINING_SITE';

export interface ProjectTeamMember {
  user: User;
  role: string;
  added_at: string;
}

export interface ProjectSettings {
  id: string;
  project_id: string;
  estimation_methodology: EstimationMethodology;
  accuracy_target: AccuracyTarget;
  currency: string;
  labor_rates_region: string;
  safety_factor: number;
  contingency_percentage: number;
  created_at: string;
  updated_at: string;
}

export type EstimationMethodology = 
  | 'HISTORICAL'
  | 'PARAMETRIC'
  | 'DETAILED'
  | 'HYBRID';

export type AccuracyTarget = 
  | 'CONCEPTUAL'
  | 'PRELIMINARY'
  | 'DEFINITIVE'
  | 'CONTROL';

export interface ProjectMilestone {
  id: string;
  project_id: string;
  name: string;
  description: string | null;
  due_date: string;
  status: MilestoneStatus;
  completion_percentage: number;
  created_at: string;
  updated_at: string;
}

export type MilestoneStatus = 
  | 'NOT_STARTED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'OVERDUE';

// Request/Response types
export interface ProjectCreate {
  name: string;
  description: string;
  status: ProjectStatus;
  priority: ProjectPriority;
  project_type?: ProjectType;
  industry_sector?: IndustrySector;
  facility_type?: FacilityType;
  budget?: number;
  start_date: string;
  end_date: string;
  location?: string;
  client_name?: string;
  created_by: string;
  settings: {
    estimation_methodology: EstimationMethodology;
    accuracy_target: AccuracyTarget;
    currency: string;
    labor_rates_region: string;
    safety_factor: number;
    contingency_percentage: number;
  };
}

export interface ProjectUpdate {
  name?: string;
  description?: string;
  status?: ProjectStatus;
  priority?: ProjectPriority;
  project_type?: ProjectType;
  industry_sector?: IndustrySector;
  facility_type?: FacilityType;
  budget?: number;
  start_date?: string;
  end_date?: string;
  location?: string;
  client_name?: string;
}

export interface ProjectResponse extends Project {}

export interface ProjectListResponse {
  items: Project[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}

// Authentication types
export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  user: User;
}

export interface RefreshTokenRequest {
  refresh_token: string;
}

export interface RefreshTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

// Error types
export interface ApiError {
  detail: string;
  code?: string;
  field?: string;
}

export interface ValidationError {
  detail: Array<{
    loc: (string | number)[];
    msg: string;
    type: string;
  }>;
}
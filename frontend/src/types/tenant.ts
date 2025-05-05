// src/types/tenant.ts
import { BaseEntity } from './common';

export interface Tenant extends BaseEntity {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  address: string;
  unit_id: number | null;
  rent_start_date: string;
  rent_end_date: string | null;
  active: boolean;
  
  // Include these fields that are returned from the API
  unit_name?: string;
  unit_type?: string;
  property_address?: string;
  property_type?: string;
}

export interface TenantFormData {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  address: string;
  unit_id: number | null | string; // Accept string for form select handling
  rent_start_date: string;
  rent_end_date: string | null;
  active?: boolean; // Allow undefined in form but add in service
}
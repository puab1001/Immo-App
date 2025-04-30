// src/types/tenant.ts
import { BaseEntity } from './common';

export interface Tenant extends BaseEntity {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  address: string;
  unit_id?: number;
  rent_start_date: string;
  rent_end_date?: string;
  active: boolean;
}

export interface TenantFormData {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  address: string;
  unit_id?: number | null;
  rent_start_date: string;
  rent_end_date?: string | null;
}
// src/types/property.ts
import { BaseEntity } from './common';

export interface Property extends BaseEntity {
  address: string;
  property_type: string;
  total_rent: number;
  units: Unit[];
}

export interface Unit extends BaseEntity {
  property_id: number;
  name: string;
  type: string;
  size: number;
  status: 'verfügbar' | 'besetzt';
  rent?: number;
}

export interface PropertyFormData {
  address: string;
  property_type: string;
  units: Omit<Unit, 'id' | 'property_id' | 'created_at' | 'updated_at'>[];
}
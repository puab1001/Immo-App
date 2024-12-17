// src/types/property.ts

export interface Unit {
  id?: number;
  name: string;
  type: string;
  size: number;
  status: string;
  rent: number;
}

export interface Property {
  id?: number;
  address: string;
  size: number;
  price: number;
  status: string;
  property_type: string;
  units?: Unit[];
}

export const propertyTypes = [
  'Einfamilienhaus',
  'Mehrfamilienhaus', 
  'Eigentumswohnung',
  'Doppelhaushälfte',
  'Reihenhaus',
  'Villa'
] as const;

// Form state types
export interface PropertyFormData extends Omit<Property, 'id'> {
  units?: Omit<Unit, 'id'>[];
}

// API response types 
export interface ApiResponse<T> {
  data?: T;
  error?: string;
}

// Status options
export const PROPERTY_STATUS = {
  AVAILABLE: 'verfügbar',
  RENTED: 'vermietet',
  SOLD: 'verkauft',
  INACTIVE: 'inaktiv'
} as const;

export type PropertyStatus = typeof PROPERTY_STATUS[keyof typeof PROPERTY_STATUS];

// Unit status options
export const UNIT_STATUS = {
  AVAILABLE: 'frei',
  RENTED: 'vermietet',
  MAINTENANCE: 'wartung'
} as const;

export type UnitStatus = typeof UNIT_STATUS[keyof typeof UNIT_STATUS];

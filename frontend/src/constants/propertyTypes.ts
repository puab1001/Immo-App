// src/constants/propertyTypes.ts

// Immobilientypen
export const propertyTypes = [
  'Einfamilienhaus',
  'Mehrfamilienhaus', 
  'Eigentumswohnung',
  'Doppelhaushälfte',
  'Reihenhaus',
  'Villa'
] as const;

// Typen für Einheiten (Wohnungen/Gewerbe)
export const UNIT_TYPES = [
  'Wohnung',
  'Gewerbe'
] as const;

// Status für Einheiten
export const UNIT_STATUS = [
  'verfügbar',
  'besetzt'
] as const;

// TypeScript Typ-Definitionen
export type PropertyType = typeof propertyTypes[number];
export type UnitType = typeof UNIT_TYPES[number];
export type UnitStatus = typeof UNIT_STATUS[number];

// Interface für Property
export interface Property {
  id?: number;
  address: string;
  property_type: PropertyType;
  total_rent: number; 
  units: Unit[];
}

// Interface für Unit
export interface Unit {
  id?: number;
  name: string;
  type: UnitType;
  size: number | '';
  status: UnitStatus;
  rent?: number | '';
}

// Interface für API-Antworten
export interface ApiResponse<T> {
  data?: T;
  error?: string;
}
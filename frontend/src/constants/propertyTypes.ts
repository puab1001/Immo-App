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

// Status-Konfigurationen
export const STATUS_CONFIG = {
  verfügbar: {
    label: 'Verfügbar',
    color: 'green',
  },
  besetzt: {
    label: 'Besetzt',
    color: 'blue',
  }
} as const;

// Document Categories
export const DOCUMENT_CATEGORIES = [
  'Mietvertrag',
  'Nebenkostenabrechnung',
  'Wartungsvertrag',
  'Versicherung',
  'Sonstiges'
] as const;

// Document Types
export const DOCUMENT_TYPES = {
  pdf: {
    icon: 'FileText',
    color: 'red',
  },
  doc: {
    icon: 'FileText',
    color: 'blue',
  },
  image: {
    icon: 'Image',
    color: 'green',
  }
} as const;

// API Configuration
export const API_CONFIG = {
  baseUrl: 'http://localhost:3001',
  timeout: 15000,  // Increased from 5000ms to 15000ms
  retryAttempts: 3,
  loadingStateTimeout: 30000, // 30 seconds max for loading states
} as const;

// Table Configuration
export const TABLE_CONFIG = {
  defaultPageSize: 10,
  pageSizeOptions: [5, 10, 20, 50],
} as const;

// Form Configuration
export const FORM_CONFIG = {
  maxFileSize: 10 * 1024 * 1024, // 10MB
  allowedFileTypes: ['.pdf', '.doc', '.docx', '.jpg', '.jpeg', '.png'],
} as const;

// Validation Configuration
export const VALIDATION_CONFIG = {
  minPasswordLength: 8,
  maxNameLength: 100,
  phonePattern: /^[+]?[(]?[0-9]{3}[)]?[-\s.]?[0-9]{3}[-\s.]?[0-9]{4,6}$/,
  emailPattern: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
} as const;
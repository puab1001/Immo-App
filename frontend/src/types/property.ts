// types/property.ts

export interface Property {
  id?: number;
  address: string;
  size: number;
  price: number;
  property_type: string;
  total_rent: number; 
  units: Unit[];
}

export interface Unit {
  id?: number;
  name: string;
  type: string;
  size: number;
  status: string;
  rent: number;
}

export interface PropertyFormData {
  address: string;
  size: number | string;
  price: number | string;
  status: string;
  property_type: string;
  units?: Unit[];
}

export interface ApiResponse<T> {
  data?: T;
  error?: string;
}
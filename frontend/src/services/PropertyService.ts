// src/services/PropertyService.ts
import { API } from './api';
import { Property, PropertyFormData } from '@/types/property';

export class PropertyService {
  private static endpoint = '/properties';

  static async getAll(): Promise<Property[]> {
    return API.get<Property[]>(this.endpoint);
  }

  static async getById(id: number): Promise<Property> {
    return API.get<Property>(`${this.endpoint}/${id}`);
  }

  static async create(data: PropertyFormData): Promise<Property> {
    return API.post<Property>(this.endpoint, data);
  }

  static async update(id: number, data: PropertyFormData): Promise<Property> {
    return API.put<Property>(`${this.endpoint}/${id}`, data);
  }

  static async delete(id: number): Promise<void> {
    return API.delete(`${this.endpoint}/${id}`);
  }
}

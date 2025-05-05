// src/services/TenantService.ts
import { API } from './api';
import { Tenant, TenantFormData } from '@/types/tenant';

export class TenantService {
  private static endpoint = '/tenants';

  static async getAll(): Promise<Tenant[]> {
    return API.get<Tenant[]>(this.endpoint);
  }

  static async getById(id: number): Promise<Tenant> {
    return API.get<Tenant>(`${this.endpoint}/${id}`);
  }

  static async create(data: TenantFormData): Promise<Tenant> {
    return API.post<Tenant>(this.endpoint, data);
  }

  static async update(id: number, data: TenantFormData): Promise<Tenant> {
    // Make sure we're sending the active status which might be needed by the backend
    const updatedData = {
      ...data,
      active: true, // Assume active for updates unless explicitly set otherwise
    };
    
    return API.put<Tenant>(`${this.endpoint}/${id}`, updatedData);
  }

  static async delete(id: number): Promise<void> {
    return API.delete(`${this.endpoint}/${id}`);
  }
}
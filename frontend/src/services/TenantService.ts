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
    return API.put<Tenant>(`${this.endpoint}/${id}`, data);
  }

  static async delete(id: number): Promise<void> {
    return API.delete(`${this.endpoint}/${id}`);
  }
}
// src/services/WorkerService.ts
import { API } from './api';
import { Worker, WorkerFormData } from '@/types/worker';

export class WorkerService {
  private static endpoint = '/workers';

  static async getAll(): Promise<Worker[]> {
    return API.get<Worker[]>(this.endpoint);
  }

  static async getById(id: number): Promise<Worker> {
    return API.get<Worker>(`${this.endpoint}/${id}`);
  }

  static async create(data: WorkerFormData): Promise<Worker> {
    return API.post<Worker>(this.endpoint, data);
  }

  static async update(id: number, data: WorkerFormData): Promise<Worker> {
    return API.put<Worker>(`${this.endpoint}/${id}`, data);
  }

  static async delete(id: number): Promise<void> {
    return API.delete(`${this.endpoint}/${id}`);
  }

  static async getSkills(): Promise<any[]> {
    return API.get<any[]>(`${this.endpoint}/skills`);
  }
}
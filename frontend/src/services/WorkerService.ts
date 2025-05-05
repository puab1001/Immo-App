// src/services/WorkerService.ts
import { API } from './api';
import { Worker, WorkerFormData, WorkerSkill } from '@/types/worker';

export class WorkerService {
  private static endpoint = '/workers';

  static async getAll(): Promise<Worker[]> {
    return API.get<Worker[]>(this.endpoint);
  }

  static async getById(id: number): Promise<Worker> {
    return API.get<Worker>(`${this.endpoint}/${id}`);
  }

  static async create(data: WorkerFormData): Promise<Worker> {
    // Ensure all skills have the required properties
    const formattedData = {
      ...data,
      hourly_rate: typeof data.hourly_rate === 'string' 
        ? parseFloat(data.hourly_rate) 
        : data.hourly_rate,
      skills: data.skills.map(skill => ({
        id: typeof skill.id === 'string' ? parseInt(skill.id) : skill.id,
        experience_years: skill.experience_years
      }))
    };
    
    return API.post<Worker>(this.endpoint, formattedData);
  }

  static async update(id: number, data: WorkerFormData): Promise<Worker> {
    // Ensure all skills have the required properties and proper types
    const formattedData = {
      ...data,
      hourly_rate: typeof data.hourly_rate === 'string' 
        ? parseFloat(data.hourly_rate) 
        : data.hourly_rate,
      skills: data.skills.map(skill => ({
        id: typeof skill.id === 'string' ? parseInt(skill.id) : skill.id,
        experience_years: skill.experience_years
      })),
      active: data.active !== undefined ? data.active : true, // Default to active if not specified
    };
    
    return API.put<Worker>(`${this.endpoint}/${id}`, formattedData);
  }

  static async delete(id: number): Promise<void> {
    return API.delete(`${this.endpoint}/${id}`);
  }

  static async getSkills(): Promise<any[]> {
    return API.get<any[]>(`${this.endpoint}/skills`);
  }
}
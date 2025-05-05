// src/types/worker.ts
import { BaseEntity } from './common';

export interface Worker extends BaseEntity {
  first_name: string;
  last_name: string;
  phone: string;
  email: string;
  hourly_rate: number;
  skills: WorkerSkill[];
  active: boolean;
}

export interface Skill {
  id: number;
  name: string;
  description?: string;
}

export interface WorkerSkill {
  id: number;
  name?: string;
  experience_years: number;
}

export interface WorkerFormData {
  first_name: string;
  last_name: string;
  phone: string;
  email: string;
  hourly_rate: number | string; // Accept both types for form handling flexibility
  skills: WorkerSkill[];
  active: boolean; // Make sure this is required
}
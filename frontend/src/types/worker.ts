// src/types/worker.ts

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

export interface Worker {
    id?: number;
    first_name: string;
    last_name: string;
    phone: string;
    email: string;
    hourly_rate: number | string;
    skills: WorkerSkill[];
    active?: boolean;
}

export interface WorkerFormData {
    first_name: string;
    last_name: string;
    phone: string;
    email: string;
    hourly_rate: number | string;
    skills: WorkerSkill[];
    active?: boolean;
}
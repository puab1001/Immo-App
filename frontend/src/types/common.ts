// src/types/common.ts

export class ApiError extends Error {
  status: number;
  data?: any;

  constructor(message: string, status: number = 500, data?: any) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
    
    // Damit instanceof auch mit transpiliertem Code funktioniert
    Object.setPrototypeOf(this, ApiError.prototype);
  }
}

export type PaginatedResponse<T> = {
  data: T[];
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
};

export type ApiResponse<T> = {
  data: T;
  message?: string;
  status: number;
};

export type ApiErrorType = {
  message: string;
  code?: string;
  details?: Record<string, any>;
  status?: number;
  field?: string;
};

export type BaseEntity = {
  id: number;
  created_at: string;
  updated_at: string;
};
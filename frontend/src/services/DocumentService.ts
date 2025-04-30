// src/services/DocumentService.ts
import { API } from './api';
import { API_CONFIG } from '@/constants/propertyTypes';
import { Document, DocumentUploadData } from '@/types/document';
import { ApiError } from '@/types/common';

export class DocumentService {
  private static endpoint = '/documents';

  static async getAll(filters?: {
    tenantId?: number;
    categoryId?: number;
    isConfidential?: boolean;
    tags?: string[];
  }): Promise<Document[]> {
    const queryParams = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined) {
          queryParams.append(key, String(value));
        }
      });
    }
    const queryString = queryParams.toString();
    const url = queryString ? `${this.endpoint}?${queryString}` : this.endpoint;
    return API.get<Document[]>(url);
  }

  static async getById(id: number): Promise<Document> {
    return API.get<Document>(`${this.endpoint}/${id}`);
  }

  static async upload(data: DocumentUploadData): Promise<Document> {
    const formData = new FormData();
    Object.entries(data).forEach(([key, value]) => {
      if (value !== undefined) {
        if (key === 'tags' && Array.isArray(value)) {
          formData.append(key, JSON.stringify(value));
        } else {
          formData.append(key, value as string | Blob);
        }
      }
    });

    const response = await fetch(`${API_CONFIG.baseUrl}/documents`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Upload fehlgeschlagen' }));
      throw new ApiError(error.error || 'Upload fehlgeschlagen', response.status);
    }
    
    return response.json();
  }

  static async delete(id: number): Promise<void> {
    return API.delete(`${this.endpoint}/${id}`);
  }

  static getDownloadUrl(id: number): string {
    return `${API_CONFIG.baseUrl}${this.endpoint}/${id}/download`;
  }

  static async getPreview(id: number): Promise<Blob> {
    const response = await fetch(`${API_CONFIG.baseUrl}${this.endpoint}/${id}/preview`);
    if (!response.ok) {
      throw new ApiError('Vorschau konnte nicht geladen werden', response.status);
    }
    return await response.blob();
  }

  static async getCategories(): Promise<any[]> {
    return API.get<any[]>(`${this.endpoint}/categories`);
  }
}
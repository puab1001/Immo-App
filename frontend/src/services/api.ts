// src/services/api.ts
import { API_CONFIG } from '@/constants/propertyTypes';
import { ApiError } from '@/types/common';

export class API {
  private static baseUrl = API_CONFIG.baseUrl;
  private static timeout = API_CONFIG.timeout;

  private static async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        let errorMessage = 'Ein Fehler ist aufgetreten';
        let errorData;
        
        try {
          errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
        } catch {
          // Falls keine JSON-Antwort verfügbar ist
        }

        throw new ApiError(errorMessage, response.status, errorData);
      }

      // For endpoints that return no content
      if (response.status === 204) {
        return {} as T;
      }

      return response.json();
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof ApiError) throw error;
      
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new ApiError('Die Anfrage wurde wegen Zeitüberschreitung abgebrochen', 408);
        }
        throw new ApiError(error.message);
      }
      
      throw new ApiError('Ein unerwarteter Fehler ist aufgetreten');
    }
  }

  static get<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint);
  }

  static post<T>(endpoint: string, data: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  static put<T>(endpoint: string, data: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  static delete(endpoint: string): Promise<void> {
    return this.request(endpoint, {
      method: 'DELETE',
    });
  }
}
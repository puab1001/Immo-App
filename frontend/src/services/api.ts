// src/services/api.ts
import { API_CONFIG } from '@/constants/propertyTypes';
import { ApiError } from '@/types/common';

export class API {
  private static baseUrl = API_CONFIG.baseUrl;
  private static timeout = API_CONFIG.timeout;
  private static retryAttempts = API_CONFIG.retryAttempts || 0;
  public static loadingStateTimeout = API_CONFIG.loadingStateTimeout || 30000;

  private static async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      console.log(`API Request: ${options.method || 'GET'} ${url}`);
      
      const response = await fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          ...options.headers,
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // Log raw response for debugging
      console.log(`API Response Status: ${response.status}`);
      
      // Debug response content
      const responseText = await response.text();
      
      if (!response.ok) {
        let errorMessage = 'Ein Fehler ist aufgetreten';
        let errorData;
        
        try {
          errorData = responseText ? JSON.parse(responseText) : {};
          errorMessage = errorData.error || errorMessage;
        } catch (parseError) {
          console.error('Error parsing error response:', parseError);
          // Keep default error message
        }

        throw new ApiError(errorMessage, response.status, errorData);
      }

      // For endpoints that return no content
      if (response.status === 204 || !responseText) {
        return {} as T;
      }

      // Parse the response
      try {
        return JSON.parse(responseText) as T;
      } catch (parseError) {
        console.error('Error parsing success response:', parseError);
        console.error('Raw response:', responseText);
        throw new ApiError('Fehler beim Verarbeiten der Antwort', 500);
      }
    } catch (error) {
      clearTimeout(timeoutId);
      
      if (error instanceof ApiError) throw error;
      
      if (error instanceof Error) {
        console.error('API request error:', error);
        
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

  static async deleteWithConfirm(endpoint: string): Promise<boolean> {
    try {
      await this.delete(endpoint);
      return true;
    } catch (error) {
      console.error('Delete error:', error);
      return false;
    }
  }
}
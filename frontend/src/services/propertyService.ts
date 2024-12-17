// services/propertyService.ts

import { Property, PropertyFormData } from '@/types/property'

const API_URL = 'http://localhost:3001/properties'

export const propertyService = {
  // Alle Properties laden
  async getAll(): Promise<Property[]> {
    const response = await fetch(API_URL)
    if (!response.ok) throw new Error('Failed to fetch properties')
    return response.json()
  },

  // Eine Property laden
  async getById(id: string): Promise<Property> {
    const response = await fetch(`${API_URL}/${id}`)
    if (!response.ok) throw new Error('Failed to fetch property')
    return response.json()
  },

  // Neue Property erstellen
  async create(data: PropertyFormData): Promise<Property> {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })
    if (!response.ok) throw new Error('Failed to create property')
    return response.json()
  },

  // Property aktualisieren
  async update(id: string, data: PropertyFormData): Promise<Property> {
    const response = await fetch(`${API_URL}/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })
    if (!response.ok) throw new Error('Failed to update property')
    return response.json()
  },

  // Property löschen
  async delete(id: number): Promise<void> {
    const response = await fetch(`${API_URL}/${id}`, {
      method: 'DELETE'
    })
    if (!response.ok) throw new Error('Failed to delete property')
  }
}
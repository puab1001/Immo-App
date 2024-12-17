// hooks/useProperties.ts

import { useState, useCallback } from 'react'
import { Property, PropertyFormData } from '@/types/property'
import { propertyService } from '@/services/propertyService'

export function useProperties() {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [properties, setProperties] = useState<Property[]>([])

  const loadProperties = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const data = await propertyService.getAll()
      setProperties(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ein Fehler ist aufgetreten')
    } finally {
      setIsLoading(false)
    }
  }, [])

  const createProperty = async (data: PropertyFormData) => {
    setIsLoading(true)
    setError(null)
    try {
      const newProperty = await propertyService.create(data)
      setProperties(prev => [...prev, newProperty])
      return newProperty
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ein Fehler ist aufgetreten')
      throw err
    } finally {
      setIsLoading(false)
    }
  }

  const updateProperty = async (id: string, data: PropertyFormData) => {
    setIsLoading(true)
    setError(null)
    try {
      const updatedProperty = await propertyService.update(id, data)
      setProperties(prev => prev.map(p => p.id === Number(id) ? updatedProperty : p))
      return updatedProperty
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ein Fehler ist aufgetreten')
      throw err
    } finally {
      setIsLoading(false)
    }
  }

  const deleteProperty = async (id: number) => {
    setIsLoading(true)
    setError(null)
    try {
      await propertyService.delete(id)
      setProperties(prev => prev.filter(p => p.id !== id))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ein Fehler ist aufgetreten')
      throw err
    } finally {
      setIsLoading(false)
    }
  }

  return {
    properties,
    isLoading,
    error,
    loadProperties,
    createProperty,
    updateProperty,
    deleteProperty
  }
}
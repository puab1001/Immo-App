// src/hooks/useFormState.ts
import { useState, useCallback } from 'react';

export function useFormState<T>(initialState: T) {
  const [formData, setFormData] = useState<T>(initialState);
  const [errors, setErrors] = useState<Partial<Record<keyof T, string>>>({});
  const [isDirty, setIsDirty] = useState(false);

  const updateField = useCallback(<K extends keyof T>(
    field: K,
    value: T[K]
  ) => {
    setFormData(prev => ({
      ...prev,
      [field]: value,
    }));
    setIsDirty(true);
    // Lösche Fehler wenn Feld aktualisiert wird
    setErrors(prev => ({
      ...prev,
      [field]: undefined,
    }));
  }, []);

  const validateField = useCallback((
    field: keyof T,
    validator: (value: T[typeof field]) => string | undefined
  ) => {
    const error = validator(formData[field]);
    setErrors(prev => ({
      ...prev,
      [field]: error,
    }));
    return !error;
  }, [formData]);

  const resetForm = useCallback(() => {
    setFormData(initialState);
    setErrors({});
    setIsDirty(false);
  }, [initialState]);

  return {
    formData,
    setFormData,
    errors,
    setErrors,
    isDirty,
    updateField,
    validateField,
    resetForm,
  };
}
// src/lib/validators.ts
import { VALIDATION_CONFIG } from '@/constants/propertyTypes';

export const required = (value: any): string | undefined => {
  if (value === undefined || value === null || value === '') {
    return 'Dieses Feld ist erforderlich';
  }
  return undefined;
};

export const email = (value: string): string | undefined => {
  if (!value) return undefined;
  
  if (!VALIDATION_CONFIG.emailPattern.test(value)) {
    return 'Bitte geben Sie eine gültige E-Mail-Adresse ein';
  }
  return undefined;
};

export const phone = (value: string): string | undefined => {
  if (!value) return undefined;

  if (!VALIDATION_CONFIG.phonePattern.test(value)) {
    return 'Bitte geben Sie eine gültige Telefonnummer ein';
  }
  return undefined;
};

export const minLength = (min: number) => (value: string): string | undefined => {
  if (!value) return undefined;

  if (value.length < min) {
    return `Mindestens ${min} Zeichen erforderlich`;
  }
  return undefined;
};

export const maxLength = (max: number) => (value: string): string | undefined => {
  if (!value) return undefined;

  if (value.length > max) {
    return `Maximal ${max} Zeichen erlaubt`;
  }
  return undefined;
};

export const number = (value: string): string | undefined => {
  if (!value) return undefined;

  if (isNaN(Number(value))) {
    return 'Bitte geben Sie eine gültige Zahl ein';
  }
  return undefined;
};

export const positiveNumber = (value: number): string | undefined => {
  if (value === undefined || value === null) return undefined;

  if (value <= 0) {
    return 'Der Wert muss größer als 0 sein';
  }
  return undefined;
};

export const dateNotInPast = (value: string): string | undefined => {
  if (!value) return undefined;

  const date = new Date(value);
  const now = new Date();
  
  if (date < now) {
    return 'Das Datum darf nicht in der Vergangenheit liegen';
  }
  return undefined;
};

export const dateNotInFuture = (value: string): string | undefined => {
  if (!value) return undefined;

  const date = new Date(value);
  const now = new Date();
  
  if (date > now) {
    return 'Das Datum darf nicht in der Zukunft liegen';
  }
  return undefined;
};

export const composeValidators = (...validators: ((value: any) => string | undefined)[]) => 
  (value: any): string | undefined => 
    validators.reduce(
      (error, validator) => error || validator(value),
      undefined as string | undefined
    );
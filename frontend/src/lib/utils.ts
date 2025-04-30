// src/lib/utils.ts
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

// Utility für Tailwind CSS Klassen-Kombinationen
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Generische Error Handler
export function isApiError(error: unknown): error is Error {
  return error instanceof Error;
}

// Allgemeine Dateiverarbeitung
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

// Debounce Funktion für Suchfelder etc.
export function debounce<T extends (...args: any[]) => void>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  
  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };

    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// Array Utilities
export function groupBy<T>(array: T[], key: keyof T): Record<string, T[]> {
  return array.reduce((groups, item) => {
    const value = item[key];
    const keyString = String(value);
    groups[keyString] = groups[keyString] ?? [];
    groups[keyString].push(item);
    return groups;
  }, {} as Record<string, T[]>);
}
// src/lib/formatters.ts
export const formatCurrency = (value: number): string => {
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value);
  };
  
  export const formatDate = (date: string | Date): string => {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    
    return new Intl.DateTimeFormat('de-DE', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(dateObj);
  };
  
  export const formatDateTime = (date: string | Date): string => {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    
    return new Intl.DateTimeFormat('de-DE', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    }).format(dateObj);
  };
  
  export const formatPhoneNumber = (phoneNumber: string): string => {
    // Entferne alle nicht-numerischen Zeichen
    const cleaned = phoneNumber.replace(/\D/g, '');
    
    // Formatiere je nach Länge
    if (cleaned.length === 10) {
      return cleaned.replace(/(\d{3})(\d{3})(\d{4})/, '($1) $2-$3');
    } else if (cleaned.length === 11) {
      return cleaned.replace(/(\d{1})(\d{3})(\d{3})(\d{4})/, '+$1 ($2) $3-$4');
    }
    
    // Fallback: Gib die originale Nummer zurück
    return phoneNumber;
  };
  
  export const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  };
  
  export const formatPercentage = (value: number): string => {
    return new Intl.NumberFormat('de-DE', {
      style: 'percent',
      minimumFractionDigits: 1,
      maximumFractionDigits: 1
    }).format(value / 100);
  };
  
  export const formatNumber = (value: number): string => {
    return new Intl.NumberFormat('de-DE').format(value);
  };
  
  export const formatAddress = (
    street: string,
    number: string,
    zip: string,
    city: string
  ): string => {
    return `${street} ${number}, ${zip} ${city}`;
  };
  
  export const formatName = (firstName: string, lastName: string): string => {
    return `${firstName} ${lastName}`;
  };
  
  export const formatDuration = (minutes: number): string => {
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    
    if (hours === 0) {
      return `${remainingMinutes} Min.`;
    }
    
    return `${hours} Std. ${remainingMinutes} Min.`;
  };
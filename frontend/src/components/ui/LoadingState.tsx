// src/components/ui/LoadingState.tsx
import { useEffect, useState } from 'react';

export function LoadingState() {
  const [showRetryMessage, setShowRetryMessage] = useState(false);
  
  useEffect(() => {
    // After 10 seconds, show a message suggesting reload if still loading
    const timeoutId = setTimeout(() => {
      setShowRetryMessage(true);
    }, 10000);
    
    return () => clearTimeout(timeoutId);
  }, []);
  
  return (
    <div className="w-full h-48 flex flex-col items-center justify-center gap-4">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      {showRetryMessage && (
        <p className="text-sm text-muted-foreground">
          Laden dauert länger als erwartet. Prüfen Sie Ihre Netzwerkverbindung oder laden Sie die Seite neu.
        </p>
      )}
    </div>
  );
}
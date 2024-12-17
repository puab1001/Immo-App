// src/components/EditPropertyWrapper.tsx
import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import PropertyForm from './PropertyForm';

export default function EditPropertyWrapper() {
  const { id } = useParams();
  const [property, setProperty] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    const loadProperty = async () => {
      try {
        const response = await fetch(`http://localhost:3001/properties/${id}`);
        if (!response.ok) throw new Error('Laden fehlgeschlagen');
        const data = await response.json();
        setProperty(data);
      } catch (error) {
        console.error('Fehler beim Laden:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadProperty();
  }, [id]);

  if (isLoading) return <div>Lade...</div>;
  if (!property) return <div>Immobilie nicht gefunden</div>;
  
  return <PropertyForm initialData={property} />;
}
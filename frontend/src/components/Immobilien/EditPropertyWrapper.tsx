// src/components/Immobilien/EditPropertyWrapper.tsx
import { useParams } from 'react-router-dom';
import PropertyForm from './PropertyForm';
import { useEffect, useState } from 'react';
import { Property } from '@/types/property';
import { PropertyService } from '@/services/PropertyService';
import { LoadingState } from '@/components/ui/LoadingState';
import { ErrorState } from '@/components/ui/ErrorState';

export default function EditPropertyWrapper() {
  const { id } = useParams<{ id: string }>();
  const [property, setProperty] = useState<Property | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    async function loadProperty() {
      try {
        setIsLoading(true);
        const data = await PropertyService.getById(Number(id));
        setProperty(data);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Error loading property'));
      } finally {
        setIsLoading(false);
      }
    }

    if (id) {
      loadProperty();
    }
  }, [id]);

  if (isLoading) return <LoadingState />;
  if (error || !property) return <ErrorState title="Error" message={error?.message || 'Property not found'} />;

  return <PropertyForm initialData={property} />;
}
// src/components/Mieter/TenantEditWrapper.tsx
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import TenantForm from './TenantForm';
import { Tenant } from '@/types/tenant';
import { useAsync } from '@/hooks/useAsync';
import { TenantService } from '@/services/TenantService';
import { LoadingState } from '@/components/ui/LoadingState';
import { ErrorState } from '@/components/ui/ErrorState';

export default function TenantEditWrapper() {
  const { id } = useParams<{ id: string }>();
  const [tenant, setTenant] = useState<Tenant | null>(null);

  const { execute: fetchTenant, isLoading, error } = useAsync(
    () => TenantService.getById(Number(id)),
    {
      errorMessage: 'Fehler beim Laden des Mieters'
    }
  );

  useEffect(() => {
    if (id) {
      loadTenant();
    }
  }, [id]);

  const loadTenant = async () => {
    try {
      const data = await fetchTenant();
      setTenant(data);
    } catch (error) {
      console.error('Fehler beim Laden:', error);
    }
  };

  if (isLoading) {
    return <LoadingState />;
  }

  if (error || !tenant) {
    return (
      <ErrorState
        title="Fehler beim Laden"
        message={error?.message || 'Mieter nicht gefunden'}
        onRetry={loadTenant}
      />
    );
  }

  return <TenantForm initialData={tenant} />;
}
// src/components/Mitarbeiter/WorkerEditWrapper.tsx
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import WorkerForm from './WorkerForm';
import { Worker } from '@/types/worker';
import { useAsync } from '@/hooks/useAsync';
import { WorkerService } from '@/services/WorkerService';
import { LoadingState } from '@/components/ui/LoadingState';
import { ErrorState } from '@/components/ui/ErrorState';

export default function WorkerEditWrapper() {
  const { id } = useParams<{ id: string }>();
  const [worker, setWorker] = useState<Worker | null>(null);

  const { execute: fetchWorker, isLoading, error } = useAsync(
    () => WorkerService.getById(Number(id)),
    {
      errorMessage: 'Fehler beim Laden des Handwerkers'
    }
  );

  useEffect(() => {
    if (id) {
      loadWorker();
    }
  }, [id]);

  const loadWorker = async () => {
    try {
      const data = await fetchWorker();
      setWorker(data);
    } catch (error) {
      console.error('Fehler beim Laden:', error);
    }
  };

  if (isLoading) {
    return <LoadingState />;
  }

  if (error || !worker) {
    return (
      <ErrorState
        title="Fehler beim Laden"
        message={error?.message || 'Handwerker nicht gefunden'}
        onRetry={loadWorker}
      />
    );
  }

  return <WorkerForm initialData={worker} />;
}
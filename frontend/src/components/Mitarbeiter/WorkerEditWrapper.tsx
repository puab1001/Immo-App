// src/components/Handwerker/WorkerEditWrapper.tsx
import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import WorkerForm from './WorkerForm';
import { Worker } from '@/types/worker';

export default function WorkerEditWrapper() {
  const { id } = useParams();
  const [worker, setWorker] = useState<Worker | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    const loadWorker = async () => {
      try {
        const response = await fetch(`http://localhost:3001/workers/${id}`);
        if (!response.ok) throw new Error('Laden fehlgeschlagen');
        const data = await response.json();
        setWorker(data);
      } catch (error) {
        console.error('Fehler beim Laden:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadWorker();
  }, [id]);

  if (isLoading) return <div>Lade...</div>;
  if (!worker) return <div>Handwerker nicht gefunden</div>;
  
  return <WorkerForm initialData={worker} />;
}
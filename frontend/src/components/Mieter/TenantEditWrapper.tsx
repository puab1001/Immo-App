import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import TenantForm from './TenantForm';

export default function TenantEditWrapper() {
  const { id } = useParams();
  const [tenant, setTenant] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    const loadTenant = async () => {
      try {
        const response = await fetch(`http://localhost:3001/tenants/${id}`);
        if (!response.ok) throw new Error('Laden fehlgeschlagen');
        const data = await response.json();
        setTenant(data);
      } catch (error) {
        console.error('Fehler beim Laden:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadTenant();
  }, [id]);

  if (isLoading) return <div>Lade...</div>;
  if (!tenant) return <div>Mieter nicht gefunden</div>;
  
  return <TenantForm initialData={tenant} />;
}
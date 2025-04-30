// src/components/Immobilien/PropertyList.tsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Building2, PlusCircle } from 'lucide-react';
import { Property } from '@/types/property';
import { useAsync } from '@/hooks/useAsync';
import { useConfirmation } from '@/hooks/useConfirmation';
import { PropertyService } from '@/services/PropertyService';
import { PropertyCard } from './PropertyCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingState } from '@/components/ui/LoadingState';
import { ErrorState } from '@/components/ui/ErrorState';

export default function PropertyList() {
  const navigate = useNavigate();
  const [properties, setProperties] = useState<Property[]>([]);
  const [expandedProperty, setExpandedProperty] = useState<number | null>(null);

  const { execute: fetchProperties, isLoading, error } = useAsync<Property[]>(
    () => PropertyService.getAll(),
    {
      errorMessage: 'Fehler beim Laden der Immobilien'
    }
  );

  const { confirm: confirmDelete } = useConfirmation({
    title: 'Immobilie löschen',
    message: 'Möchten Sie diese Immobilie wirklich löschen? Alle zugehörigen Daten werden ebenfalls gelöscht.',
    confirmText: 'Löschen',
    cancelText: 'Abbrechen'
  });

  useEffect(() => {
    loadProperties();
  }, []);

  const loadProperties = async () => {
    try {
      const data = await fetchProperties();
      setProperties(data);
    } catch (error) {
      console.error('Fehler beim Laden:', error);
    }
  };

  const handleDelete = async (id: number) => {
    const confirmed = await confirmDelete();
    if (!confirmed) return;

    try {
      await PropertyService.delete(id);
      await loadProperties();
    } catch (error) {
      console.error('Fehler beim Löschen:', error);
    }
  };

  if (isLoading) {
    return <LoadingState />;
  }

  if (error) {
    return (
      <ErrorState
        title="Fehler beim Laden"
        message={error.message}
        onRetry={loadProperties}
      />
    );
  }

  return (
    <div className="p-4 max-w-5xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-2">
          <Building2 className="w-6 h-6" />
          <h1 className="text-2xl font-bold">Immobilien</h1>
        </div>
        <Button
          onClick={() => navigate('/properties/new')}
          className="flex items-center gap-2"
        >
          <PlusCircle className="w-4 h-4" />
          Neue Immobilie
        </Button>
      </div>

      {properties.length === 0 ? (
        <EmptyState
          title="Keine Immobilien vorhanden"
          description="Fügen Sie Ihre erste Immobilie hinzu"
          icon={<Building2 className="w-12 h-12 text-muted-foreground" />}
          action={{
            label: 'Erste Immobilie hinzufügen',
            onClick: () => navigate('/properties/new')
          }}
        />
      ) : (
        <div className="grid gap-4">
          {properties.map(property => (
            <PropertyCard
              key={property.id}
              property={property}
              isExpanded={expandedProperty === property.id}
              onToggleExpand={() => setExpandedProperty(
                expandedProperty === property.id ? null : property.id
              )}
              onEdit={() => navigate(`/properties/edit/${property.id}`)}
              onDelete={() => handleDelete(property.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
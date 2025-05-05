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
import { API } from '@/services/api';
import { useToast } from '@/hooks/useToast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

export default function PropertyList() {
  const navigate = useNavigate();
  const [properties, setProperties] = useState<Property[]>([]);
  const [expandedProperty, setExpandedProperty] = useState<number | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [propertyToDelete, setPropertyToDelete] = useState<number | null>(null);
  const { toast } = useToast();

  const { execute: fetchProperties, isLoading, error } = useAsync<Property[]>(
    () => PropertyService.getAll(),
    {
      errorMessage: 'Fehler beim Laden der Immobilien',
      loadingTimeout: API.loadingStateTimeout
    }
  );

  // Diese Zeile entfernen, da wir unseren eigenen Dialog verwenden werden
  // const { confirm: confirmDelete } = useConfirmation({...

  useEffect(() => {
    console.log('PropertyList mounted, loading properties');
    loadProperties();
  }, []);

  const loadProperties = async () => {
    console.log('loadProperties called');
    try {
      console.log('Executing fetchProperties');
      const data = await fetchProperties();
      console.log('Properties loaded successfully:', data);
      setProperties(data);
    } catch (error) {
      console.error('Fehler beim Laden:', error);
    }
  };

  const initiateDelete = (id: number) => {
    console.log('Löschvorgang initiiert für Immobilie mit ID:', id);
    setPropertyToDelete(id);
    setShowConfirmDialog(true);
  };

  const handleConfirmDelete = async () => {
    if (propertyToDelete === null) return;
    
    const id = propertyToDelete;
    setShowConfirmDialog(false);
    
    try {
      console.log('Führe API-Aufruf zum Löschen durch für ID:', id);
      
      // Direkter API-Aufruf mit Fehlerbehandlung
      const response = await fetch(`http://localhost:3001/properties/${id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        // Versuche Fehlerdaten zu lesen
        const errorData = await response.json().catch(() => ({}));
        console.error('Fehler beim Löschen:', response.status, errorData);
        throw new Error(`Löschen fehlgeschlagen: ${errorData.error || response.statusText}`);
      }

      console.log('Immobilie erfolgreich gelöscht, lade Liste neu');
      
      // Erfolgstoast anzeigen
      toast({
        title: "Erfolgreich gelöscht",
        description: "Die Immobilie wurde erfolgreich gelöscht",
      });
      
      // Liste neu laden
      await loadProperties();
      
    } catch (error) {
      console.error('Fehler beim Löschen der Immobilie:', error);
      
      // Fehlertoast anzeigen
      toast({
        title: "Fehler beim Löschen",
        description: error instanceof Error ? error.message : "Unbekannter Fehler beim Löschen der Immobilie",
        variant: "destructive",
      });
    } finally {
      setPropertyToDelete(null);
    }
  };

  const handleCancelDelete = () => {
    console.log('Löschvorgang abgebrochen');
    setShowConfirmDialog(false);
    setPropertyToDelete(null);
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
              onDelete={() => initiateDelete(property.id)}
            />
          ))}
        </div>
      )}
      
      {/* Bestätigungsdialog für das Löschen */}
      <AlertDialog open={showConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Immobilie löschen</AlertDialogTitle>
            <AlertDialogDescription>
              Möchten Sie diese Immobilie wirklich löschen? Alle zugehörigen Daten werden ebenfalls gelöscht.
              Diese Aktion kann nicht rückgängig gemacht werden.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancelDelete}>Abbrechen</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleConfirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
// src/components/Mieter/TenantList.tsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PlusCircle, Pencil, Trash2, UserPlus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { SkeletonCard } from '@/components/ui/Skeleton-Card';
import { ErrorCard } from '@/components/ui/Error-Card';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/AlertDialog';

interface Tenant {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  address: string;
  unit_name?: string;
  unit_type?: string;
  property_address?: string;
}

export default function TenantList() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState<number | null>(null);
  const [tenantToDelete, setTenantToDelete] = useState<Tenant | null>(null);
  const navigate = useNavigate();
  const { showSuccessToast, showErrorToast } = useToast();

  const loadTenants = async () => {
    try {
      setError(null);
      const response = await fetch('http://localhost:3001/tenants');
      if (!response.ok) throw new Error('Laden fehlgeschlagen');
      const data = await response.json();
      setTenants(data);
    } catch (error) {
      console.error('Fehler beim Laden:', error);
      setError('Die Mieter konnten nicht geladen werden.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadTenants();
  }, []);

  const handleDelete = async (tenant: Tenant) => {
    setTenantToDelete(tenant);
  };

  const confirmDelete = async () => {
    if (!tenantToDelete) return;
    
    setIsDeleting(tenantToDelete.id);
    try {
      const response = await fetch(`http://localhost:3001/tenants/${tenantToDelete.id}`, {
        method: 'DELETE'
      });

      if (!response.ok) throw new Error('Löschen fehlgeschlagen');
      
      await loadTenants();
      showSuccessToast(
        'Mieter gelöscht',
        'Der Mieter wurde erfolgreich gelöscht.'
      );
    } catch (error) {
      console.error('Fehler beim Löschen:', error);
      showErrorToast(
        'Fehler beim Löschen',
        'Der Mieter konnte nicht gelöscht werden.'
      );
    } finally {
      setIsDeleting(null);
      setTenantToDelete(null);
    }
  };

  if (isLoading) {
    return (
      <div className="p-4 max-w-4xl mx-auto space-y-4">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">Mieterverwaltung</h1>
        </div>
        {[1, 2, 3].map((i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 max-w-4xl mx-auto">
        <ErrorCard
          title="Fehler beim Laden"
          message={error}
          onRetry={loadTenants}
        />
      </div>
    );
  }

  return (
    <div className="p-4 max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Mieterverwaltung</h1>
        <Button
          className="flex items-center gap-2"
          onClick={() => navigate('/tenants/new')}
        >
          <UserPlus className="w-4 h-4" />
          Neuer Mieter
        </Button>
      </div>

      {tenants.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="text-muted-foreground mb-4">Keine Mieter vorhanden</p>
            <Button
              onClick={() => navigate('/tenants/new')}
              className="flex items-center gap-2"
            >
              <PlusCircle className="w-4 h-4" />
              Ersten Mieter hinzufügen
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {tenants.map(tenant => (
            <Card 
              key={tenant.id}
              className="transition-all duration-200 hover:border-primary/50"
            >
              <CardHeader>
                <div className="flex justify-between items-start">
                  <CardTitle>
                    {tenant.first_name} {tenant.last_name}
                  </CardTitle>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => navigate(`/tenants/edit/${tenant.id}`)}
                      disabled={isDeleting === tenant.id}
                      className="transition-colors hover:border-primary"
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleDelete(tenant)}
                      disabled={isDeleting === tenant.id}
                      className="transition-colors hover:border-destructive hover:text-destructive"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-500">Kontakt</p>
                    <p>{tenant.email}</p>
                    <p>{tenant.phone}</p>
                    <p>{tenant.address}</p>
                  </div>
                  {tenant.unit_name && (
                    <div>
                      <p className="text-sm text-gray-500">Wohneinheit</p>
                      <p>{tenant.unit_name}</p>
                      <p>{tenant.property_address}</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <AlertDialog 
        open={tenantToDelete !== null}
        onOpenChange={(open) => !open && setTenantToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Mieter löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              Möchten Sie den Mieter {tenantToDelete?.first_name} {tenantToDelete?.last_name} wirklich löschen?
              Diese Aktion kann nicht rückgängig gemacht werden.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmDelete}
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
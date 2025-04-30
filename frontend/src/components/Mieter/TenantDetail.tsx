// src/components/Mieter/TenantDetail.tsx
import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Users, Mail, Phone, MapPin, Home, Calendar } from 'lucide-react';
import { Tenant } from '@/types/tenant';
import { useAsync } from '@/hooks/useAsync';
import { TenantService } from '@/services/TenantService';
import { LoadingState } from '@/components/ui/LoadingState';
import { ErrorState } from '@/components/ui/ErrorState';
import { formatDate } from '@/lib/formatters';

export default function TenantDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
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

  return (
    <div className="p-4 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <Button
          variant="ghost"
          onClick={() => navigate('/tenants')}
          className="mb-4"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Zurück zur Übersicht
        </Button>
        
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Users className="w-6 h-6" />
              {tenant.first_name} {tenant.last_name}
            </h1>
            {tenant.unit_id && (
              <p className="text-muted-foreground mt-1">
                Mieter seit {formatDate(tenant.rent_start_date)}
              </p>
            )}
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => navigate(`/tenants/${tenant.id}/documents`)}
            >
              Dokumente
            </Button>
            <Button
              onClick={() => navigate(`/tenants/edit/${tenant.id}`)}
            >
              Bearbeiten
            </Button>
          </div>
        </div>
      </div>

      {/* Inhalt */}
      <div className="grid gap-6">
        {/* Kontaktinformationen */}
        <Card>
          <CardHeader>
            <CardTitle>Kontaktinformationen</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="flex items-center gap-3">
              <Mail className="w-5 h-5 text-muted-foreground" />
              <div>
                <p className="font-medium">E-Mail</p>
                <a href={`mailto:${tenant.email}`} className="text-primary hover:underline">
                  {tenant.email}
                </a>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Phone className="w-5 h-5 text-muted-foreground" />
              <div>
                <p className="font-medium">Telefon</p>
                <a href={`tel:${tenant.phone}`} className="text-primary hover:underline">
                  {tenant.phone}
                </a>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <MapPin className="w-5 h-5 text-muted-foreground" />
              <div>
                <p className="font-medium">Adresse</p>
                <p>{tenant.address}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Mietverhältnis */}
        {tenant.unit_id && (
          <Card>
            <CardHeader>
              <CardTitle>Mietverhältnis</CardTitle>
            </CardHeader>
            <CardContent className="grid sm:grid-cols-3 gap-4">
              <div className="flex items-center gap-3">
                <Home className="w-5 h-5 text-muted-foreground" />
                <div>
                  <p className="font-medium">Wohneinheit</p>
                  <p className="text-muted-foreground">
                    {/* TODO: Unit-Details ergänzen */}
                    Wohneinheit {tenant.unit_id}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Calendar className="w-5 h-5 text-muted-foreground" />
                <div>
                  <p className="font-medium">Mietbeginn</p>
                  <p className="text-muted-foreground">
                    {formatDate(tenant.rent_start_date)}
                  </p>
                </div>
              </div>
              {tenant.rent_end_date && (
                <div className="flex items-center gap-3">
                  <Calendar className="w-5 h-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium">Mietende</p>
                    <p className="text-muted-foreground">
                      {formatDate(tenant.rent_end_date)}
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
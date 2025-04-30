// src/components/Immobilien/PropertyDetail.tsx
import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Property } from '@/types/property';
import { useAsync } from '@/hooks/useAsync';
import { PropertyService } from '@/services/PropertyService';
import { LoadingState } from '@/components/ui/LoadingState';
import { ErrorState } from '@/components/ui/ErrorState';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { Building2, ArrowLeft, MapPin, Home, Euro, Users } from 'lucide-react';

export default function PropertyDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [property, setProperty] = useState<Property | null>(null);

  const { execute: fetchProperty, isLoading, error } = useAsync(
    () => PropertyService.getById(Number(id)),
    {
      errorMessage: 'Fehler beim Laden der Immobilie'
    }
  );

  useEffect(() => {
    if (id) {
      loadProperty();
    }
  }, [id]);

  const loadProperty = async () => {
    try {
      const data = await fetchProperty();
      setProperty(data);
    } catch (error) {
      console.error('Fehler beim Laden:', error);
    }
  };

  if (isLoading) {
    return <LoadingState />;
  }

  if (error || !property) {
    return (
      <ErrorState
        title="Fehler beim Laden"
        message={error?.message || 'Immobilie nicht gefunden'}
        onRetry={loadProperty}
      />
    );
  }

  return (
    <div className="p-4 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <Button
          variant="ghost"
          onClick={() => navigate('/properties')}
          className="mb-4"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Zurück zur Übersicht
        </Button>
        
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Building2 className="w-6 h-6" />
              {property.address}
            </h1>
            <p className="text-muted-foreground mt-1">
              {property.property_type}
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => navigate(`/properties/${property.id}/documents`)}
            >
              Dokumente
            </Button>
            <Button
              onClick={() => navigate(`/properties/edit/${property.id}`)}
            >
              Bearbeiten
            </Button>
          </div>
        </div>
      </div>

      {/* Übersichtskarten */}
      <div className="grid gap-6">
        {/* Allgemeine Informationen */}
        <Card>
          <CardHeader>
            <CardTitle>Übersicht</CardTitle>
          </CardHeader>
          <CardContent className="grid sm:grid-cols-3 gap-6">
            <div className="flex items-start gap-3">
              <MapPin className="w-5 h-5 text-muted-foreground shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">Adresse</p>
                <p className="text-muted-foreground">{property.address}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Home className="w-5 h-5 text-muted-foreground shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">Wohneinheiten</p>
                <p className="text-muted-foreground">
                  {property.units.length} Einheiten
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Euro className="w-5 h-5 text-muted-foreground shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">Gesamtmiete</p>
                <p className="text-muted-foreground">
                  {formatCurrency(property.total_rent)} / Monat
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Wohneinheiten */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Wohneinheiten</CardTitle>
            <Button
              variant="outline"
              onClick={() => navigate(`/properties/edit/${property.id}#units`)}
            >
              Einheiten verwalten
            </Button>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4">
              {property.units.map((unit) => (
                <div
                  key={unit.id}
                  className="p-4 rounded-lg border bg-card hover:shadow-sm transition-shadow"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-medium">{unit.name}</h3>
                      <p className="text-sm text-muted-foreground">
                        {unit.type} • {unit.size} m²
                      </p>
                    </div>
                    <div className={`px-2 py-1 rounded-full text-sm ${
                      unit.status === 'besetzt'
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-green-100 text-green-700'
                    }`}>
                      {unit.status}
                    </div>
                  </div>
                  
                  {unit.status === 'besetzt' && (
                    <div className="mt-4 pt-4 border-t">
                      <div className="flex items-center gap-2 text-sm">
                        <Users className="w-4 h-4 text-muted-foreground" />
                        <span>Vermietet für {formatCurrency(unit.rent || 0)} / Monat</span>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Statistiken */}
        <div className="grid sm:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Vermietungsstatus</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-sm">Vermietungsquote</span>
                    <span className="text-sm font-medium">
                      {Math.round((property.units.filter(u => u.status === 'besetzt').length / property.units.length) * 100)}%
                    </span>
                  </div>
                  <div className="h-2 bg-secondary rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-primary"
                      style={{ 
                        width: `${(property.units.filter(u => u.status === 'besetzt').length / property.units.length) * 100}%`
                      }}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 pt-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Vermietet</p>
                    <p className="text-2xl font-bold">
                      {property.units.filter(u => u.status === 'besetzt').length}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Verfügbar</p>
                    <p className="text-2xl font-bold">
                      {property.units.filter(u => u.status === 'verfügbar').length}
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Mieteinnahmen</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-muted-foreground">Aktuelle Monatsmiete</p>
                  <p className="text-2xl font-bold">{formatCurrency(property.total_rent)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Durchschnittliche Miete pro m²</p>
                  <p className="text-2xl font-bold">
                    {formatCurrency(
                      property.total_rent / 
                      property.units.reduce((sum, unit) => sum + unit.size, 0)
                    )}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Unit {
  id: number;
  name: string;
  property_address: string;
  status: string;
}

interface Tenant {
  id?: number;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  address: string;
  unit_id?: number;
  rent_start_date?: string;
}

interface TenantFormProps {
  initialData?: Tenant;
}

export default function TenantForm({ initialData }: TenantFormProps) {
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [availableUnits, setAvailableUnits] = useState<Unit[]>([]);

  // Form State mit initialData oder Defaultwerten
  const [tenant, setTenant] = useState<Tenant>(() => ({
    first_name: initialData?.first_name || '',
    last_name: initialData?.last_name || '',
    email: initialData?.email || '',
    phone: initialData?.phone || '',
    address: initialData?.address || '',
    unit_id: initialData?.unit_id,
    rent_start_date: initialData?.rent_start_date || new Date().toISOString().split('T')[0]
  }));

  // Lade verfügbare Units
  useEffect(() => {
    const loadAvailableUnits = async () => {
      try {
        const response = await fetch('http://localhost:3001/properties');
        if (!response.ok) throw new Error('Laden fehlgeschlagen');
        const properties = await response.json();
        
        // Extrahiere alle verfügbaren Units aus den Properties
        const units = properties.flatMap((property: any) => 
          property.units
            .filter((unit: any) => 
              unit.status === 'verfügbar' || unit.id === initialData?.unit_id
            )
            .map((unit: any) => ({
              ...unit,
              property_address: property.address
            }))
        );
        
        setAvailableUnits(units);
      } catch (error) {
        console.error('Fehler beim Laden der Units:', error);
      }
    };

    loadAvailableUnits();
  }, [initialData?.unit_id]);

  // Form Submit Handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const url = initialData
        ? `http://localhost:3001/tenants/${initialData.id}`
        : 'http://localhost:3001/tenants';

      const response = await fetch(url, {
        method: initialData ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(tenant)
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Ein Fehler ist aufgetreten');
      }

      navigate('/tenants');
    } catch (error) {
      console.error('Fehler beim Speichern:', error);
      alert(error instanceof Error ? error.message : 'Ein Fehler ist aufgetreten');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="p-4 max-w-2xl mx-auto">
      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>
              {initialData ? 'Mieter bearbeiten' : 'Neuer Mieter'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Persönliche Daten */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Vorname</label>
                <Input
                  required
                  value={tenant.first_name}
                  onChange={e => setTenant({ ...tenant, first_name: e.target.value })}
                  className="mt-1"
                  disabled={isSubmitting}
                />
              </div>

              <div>
                <label className="text-sm font-medium">Nachname</label>
                <Input
                  required
                  value={tenant.last_name}
                  onChange={e => setTenant({ ...tenant, last_name: e.target.value })}
                  className="mt-1"
                  disabled={isSubmitting}
                />
              </div>

              <div>
                <label className="text-sm font-medium">E-Mail</label>
                <Input
                  type="email"
                  value={tenant.email}
                  onChange={e => setTenant({ ...tenant, email: e.target.value })}
                  className="mt-1"
                  disabled={isSubmitting}
                />
              </div>

              <div>
                <label className="text-sm font-medium">Telefon</label>
                <Input
                  type="tel"
                  value={tenant.phone}
                  onChange={e => setTenant({ ...tenant, phone: e.target.value })}
                  className="mt-1"
                  disabled={isSubmitting}
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium">Adresse</label>
              <Input
                value={tenant.address}
                onChange={e => setTenant({ ...tenant, address: e.target.value })}
                className="mt-1"
                disabled={isSubmitting}
              />
            </div>

            {/* Wohneinheit und Mietbeginn */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Wohneinheit</label>
                <Select
                  value={tenant.unit_id?.toString()}
                  onValueChange={(value) => 
                    setTenant({ ...tenant, unit_id: parseInt(value) })
                  }
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Wohneinheit auswählen" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableUnits.map((unit) => (
                      <SelectItem key={unit.id} value={unit.id.toString()}>
                        {unit.name} ({unit.property_address})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium">Mietbeginn</label>
                <Input
                  type="date"
                  value={tenant.rent_start_date}
                  onChange={e => setTenant({ ...tenant, rent_start_date: e.target.value })}
                  className="mt-1"
                  disabled={isSubmitting}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Formular-Buttons */}
        <div className="flex gap-4">
          <Button
            type="submit"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Wird gespeichert...' : 'Speichern'}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate('/tenants')}
            disabled={isSubmitting}
          >
            Abbrechen
          </Button>
        </div>
      </form>
    </div>
  );
}
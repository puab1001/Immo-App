// src/components/Mieter/TenantForm.tsx
import { useEffect, useState } from 'react';
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
import { TenantService } from '@/services/TenantService';
import { PropertyService } from '@/services/PropertyService';
import { useAsync } from '@/hooks/useAsync';
import { useFormState } from '@/hooks/useFormState';
import { useConfirmation } from '@/hooks/useConfirmation';
import { Tenant, TenantFormData } from '@/types/tenant';
import { Property, Unit } from '@/types/property';
import { required, email, phone } from '@/lib/validators';

interface TenantFormProps {
  initialData?: Tenant;
}

const INITIAL_TENANT_DATA: TenantFormData = {
  first_name: '',
  last_name: '',
  email: '',
  phone: '',
  address: '',
  unit_id: null,
  rent_start_date: new Date().toISOString().split('T')[0],
  rent_end_date: null
};

export default function TenantForm({ initialData }: TenantFormProps) {
  const navigate = useNavigate();
  const [availableUnits, setAvailableUnits] = useState<Unit[]>([]);
  
  const {
    formData,
    updateField,
    errors,
    setErrors,
    validateField
  } = useFormState<TenantFormData>(
    initialData || INITIAL_TENANT_DATA
  );

  // API calls
  const { execute: saveTenant, isLoading: isSaving } = useAsync(
    async (data: TenantFormData) => {
      if (initialData) {
        return TenantService.update(initialData.id, data);
      }
      return TenantService.create(data);
    },
    {
      successMessage: initialData 
        ? 'Mieter wurde erfolgreich aktualisiert'
        : 'Mieter wurde erfolgreich erstellt',
      errorMessage: 'Fehler beim Speichern des Mieters'
    }
  );

  const { execute: fetchAvailableUnits } = useAsync(
    () => PropertyService.getAll(),
    {
      errorMessage: 'Fehler beim Laden der verfügbaren Wohneinheiten'
    }
  );

  // Confirmation Dialog
  const confirmDiscardDialog = useConfirmation({
    title: 'Änderungen verwerfen?',
    message: 'Möchten Sie die Bearbeitung wirklich abbrechen? Alle nicht gespeicherten Änderungen gehen verloren.',
    confirmText: 'Verwerfen',
    cancelText: 'Weiter bearbeiten'
  });

  // Load available units on mount
  useEffect(() => {
    loadAvailableUnits();
  }, []);

  const loadAvailableUnits = async () => {
    try {
      const properties = await fetchAvailableUnits();
      const units = properties.flatMap(property => 
        property.units
          .filter(unit => unit.status === 'verfügbar' || unit.id === initialData?.unit_id)
          .map(unit => ({
            ...unit,
            property_address: property.address
          }))
      );
      setAvailableUnits(units);
    } catch (error) {
      console.error('Fehler beim Laden der Wohneinheiten:', error);
    }
  };

  // Form validation
  const validateForm = (): boolean => {
    let isValid = true;
    const newErrors: Partial<Record<keyof TenantFormData, string>> = {};

    // Required fields
    if (!required(formData.first_name)) {
      newErrors.first_name = 'Vorname ist erforderlich';
      isValid = false;
    }

    if (!required(formData.last_name)) {
      newErrors.last_name = 'Nachname ist erforderlich';
      isValid = false;
    }

    const emailError = email(formData.email);
    if (emailError) {
      newErrors.email = emailError;
      isValid = false;
    }

    const phoneError = phone(formData.phone);
    if (phoneError) {
      newErrors.phone = phoneError;
      isValid = false;
    }

    if (!required(formData.address)) {
      newErrors.address = 'Adresse ist erforderlich';
      isValid = false;
    }

    if (!required(formData.rent_start_date)) {
      newErrors.rent_start_date = 'Mietbeginn ist erforderlich';
      isValid = false;
    }

    setErrors(newErrors);
    return isValid;
  };

  // Form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    try {
      await saveTenant(formData);
      navigate('/tenants');
    } catch (error) {
      // Error wird bereits durch useAsync behandelt
    }
  };

  // Cancel handling
  const handleCancel = async () => {
    const hasChanges = JSON.stringify(initialData) !== JSON.stringify(formData);
    if (hasChanges) {
      const confirmed = await confirmDiscardDialog.confirm();
      if (!confirmed) return;
    }
    navigate('/tenants');
  };

  return (
    <div className="p-4 max-w-3xl mx-auto">
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Persönliche Informationen */}
        <Card>
          <CardHeader>
            <CardTitle>
              {initialData ? 'Mieter bearbeiten' : 'Neuer Mieter'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              {/* Vorname */}
              <div>
                <label className="text-sm font-medium">Vorname</label>
                <Input
                  value={formData.first_name}
                  onChange={e => updateField('first_name', e.target.value)}
                  className="mt-1"
                  disabled={isSaving}
                />
                {errors.first_name && (
                  <p className="text-sm text-destructive mt-1">{errors.first_name}</p>
                )}
              </div>

              {/* Nachname */}
              <div>
                <label className="text-sm font-medium">Nachname</label>
                <Input
                  value={formData.last_name}
                  onChange={e => updateField('last_name', e.target.value)}
                  className="mt-1"
                  disabled={isSaving}
                />
                {errors.last_name && (
                  <p className="text-sm text-destructive mt-1">{errors.last_name}</p>
                )}
              </div>

              {/* Email */}
              <div>
                <label className="text-sm font-medium">E-Mail</label>
                <Input
                  type="email"
                  value={formData.email}
                  onChange={e => updateField('email', e.target.value)}
                  className="mt-1"
                  disabled={isSaving}
                />
                {errors.email && (
                  <p className="text-sm text-destructive mt-1">{errors.email}</p>
                )}
              </div>

              {/* Telefon */}
              <div>
                <label className="text-sm font-medium">Telefon</label>
                <Input
                  type="tel"
                  value={formData.phone}
                  onChange={e => updateField('phone', e.target.value)}
                  className="mt-1"
                  disabled={isSaving}
                />
                {errors.phone && (
                  <p className="text-sm text-destructive mt-1">{errors.phone}</p>
                )}
              </div>

              {/* Adresse */}
              <div className="col-span-2">
                <label className="text-sm font-medium">Adresse</label>
                <Input
                  value={formData.address}
                  onChange={e => updateField('address', e.target.value)}
                  className="mt-1"
                  disabled={isSaving}
                />
                {errors.address && (
                  <p className="text-sm text-destructive mt-1">{errors.address}</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Mietverhältnis */}
        <Card>
          <CardHeader>
            <CardTitle>Mietverhältnis</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Wohneinheit */}
            <div>
              <label className="text-sm font-medium">Wohneinheit</label>
              <Select
                value={formData.unit_id?.toString() || ''}
                onValueChange={(value) => updateField('unit_id', value ? parseInt(value) : null)}
                disabled={isSaving}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Wohneinheit wählen" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Keine Wohneinheit</SelectItem>
                  {availableUnits.map((unit) => (
                    <SelectItem key={unit.id} value={unit.id.toString()}>
                      {unit.name} ({unit.property_address})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Mietbeginn */}
              <div>
                <label className="text-sm font-medium">Mietbeginn</label>
                <Input
                  type="date"
                  value={formData.rent_start_date}
                  onChange={e => updateField('rent_start_date', e.target.value)}
                  className="mt-1"
                  disabled={isSaving}
                />
                {errors.rent_start_date && (
                  <p className="text-sm text-destructive mt-1">{errors.rent_start_date}</p>
                )}
              </div>

              {/* Mietende */}
              <div>
                <label className="text-sm font-medium">Mietende (optional)</label>
                <Input
                  type="date"
                  value={formData.rent_end_date || ''}
                  onChange={e => updateField('rent_end_date', e.target.value || null)}
                  className="mt-1"
                  disabled={isSaving}
                />
                {errors.rent_end_date && (
                  <p className="text-sm text-destructive mt-1">{errors.rent_end_date}</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Form Buttons */}
        <div className="flex justify-end gap-4">
          <Button
            type="submit"
            disabled={isSaving}
          >
            {isSaving ? 'Wird gespeichert...' : 'Speichern'}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={handleCancel}
            disabled={isSaving}
          >
            Abbrechen
          </Button>
        </div>
      </form>
    </div>
  );
}
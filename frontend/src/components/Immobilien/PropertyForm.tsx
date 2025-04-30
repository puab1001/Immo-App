// src/components/Immobilien/PropertyForm.tsx
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
import { Plus, X } from 'lucide-react';
import { PropertyService } from '@/services/PropertyService';
import { useAsync } from '@/hooks/useAsync';
import { useFormState } from '@/hooks/useFormState';
import { useConfirmation } from '@/hooks/useConfirmation';
import { Property, PropertyFormData, Unit } from '@/types/property';
import { required, number } from '@/lib/validators';
import { propertyTypes, UNIT_TYPES, UNIT_STATUS } from '@/constants/propertyTypes';

interface PropertyFormProps {
  initialData?: Property;
}

const INITIAL_PROPERTY_DATA: PropertyFormData = {
  address: '',
  property_type: '',
  units: []
};

const INITIAL_UNIT: Omit<Unit, 'id' | 'property_id' | 'created_at' | 'updated_at'> = {
  name: '',
  type: 'Wohnung',
  size: 0,
  status: 'verfügbar',
  rent: 0
};

export default function PropertyForm({ initialData }: PropertyFormProps) {
  const navigate = useNavigate();
  
  const {
    formData,
    updateField,
    errors,
    setErrors,
  } = useFormState<PropertyFormData>(
    initialData || INITIAL_PROPERTY_DATA
  );

  const { execute: saveProperty, isLoading: isSaving } = useAsync(
    async (data: PropertyFormData) => {
      if (initialData) {
        return PropertyService.update(initialData.id, data);
      }
      return PropertyService.create(data);
    },
    {
      successMessage: initialData 
        ? 'Immobilie wurde erfolgreich aktualisiert'
        : 'Immobilie wurde erfolgreich erstellt',
      errorMessage: 'Fehler beim Speichern der Immobilie'
    }
  );

  const confirmDiscardDialog = useConfirmation({
    title: 'Änderungen verwerfen?',
    message: 'Möchten Sie die Bearbeitung wirklich abbrechen? Alle nicht gespeicherten Änderungen gehen verloren.',
    confirmText: 'Verwerfen',
    cancelText: 'Weiter bearbeiten'
  });

  const validateForm = (): boolean => {
    let isValid = true;
    const newErrors: Partial<Record<keyof PropertyFormData, string>> = {};

    if (!formData.address) {
      newErrors.address = 'Adresse ist erforderlich';
      isValid = false;
    }

    if (!formData.property_type) {
      newErrors.property_type = 'Immobilientyp ist erforderlich';
      isValid = false;
    }

    // Validiere alle Units
    const unitErrors: any[] = [];
    formData.units.forEach((unit, index) => {
      const unitError: any = {};
      
      if (!unit.name) {
        unitError.name = 'Name ist erforderlich';
        isValid = false;
      }
      
      if (unit.size <= 0) {
        unitError.size = 'Größe muss größer als 0 sein';
        isValid = false;
      }

      if (unit.status === 'besetzt' && (!unit.rent || unit.rent <= 0)) {
        unitError.rent = 'Miete ist erforderlich für besetzte Einheiten';
        isValid = false;
      }

      if (Object.keys(unitError).length > 0) {
        unitErrors[index] = unitError;
      }
    });

    if (unitErrors.length > 0) {
      newErrors.units = unitErrors;
    }

    setErrors(newErrors);
    return isValid;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    try {
      await saveProperty(formData);
      navigate('/properties');
    } catch (error) {
      // Error wird bereits durch useAsync behandelt
    }
  };

  const handleCancel = async () => {
    const hasChanges = JSON.stringify(initialData) !== JSON.stringify(formData);
    if (hasChanges) {
      const confirmed = await confirmDiscardDialog.confirm();
      if (!confirmed) return;
    }
    navigate('/properties');
  };

  const addUnit = () => {
    updateField('units', [...formData.units, { ...INITIAL_UNIT }]);
  };

  const removeUnit = (index: number) => {
    const newUnits = formData.units.filter((_, i) => i !== index);
    updateField('units', newUnits);
  };

  const updateUnit = (index: number, field: keyof Unit, value: any) => {
    const newUnits = formData.units.map((unit, i) => {
      if (i !== index) return unit;

      // Wenn der Status von "besetzt" auf "verfügbar" wechselt, Miete zurücksetzen
      if (field === 'status' && value === 'verfügbar') {
        return { ...unit, [field]: value, rent: 0 };
      }

      // Für numerische Felder
      if (field === 'size' || field === 'rent') {
        value = value === '' ? 0 : Number(value);
      }

      return { ...unit, [field]: value };
    });

    updateField('units', newUnits);
  };

  return (
    <div className="p-4 max-w-3xl mx-auto">
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Immobilien-Hauptdaten */}
        <Card>
          <CardHeader>
            <CardTitle>
              {initialData ? 'Immobilie bearbeiten' : 'Neue Immobilie'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4">
              {/* Adresse */}
              <div>
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

              {/* Immobilientyp */}
              <div>
                <label className="text-sm font-medium">Art der Immobilie</label>
                <Select
                  value={formData.property_type}
                  onValueChange={value => updateField('property_type', value)}
                  disabled={isSaving}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Bitte wählen..." />
                  </SelectTrigger>
                  <SelectContent>
                    {propertyTypes.map((type) => (
                      <SelectItem key={type} value={type}>
                        {type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.property_type && (
                  <p className="text-sm text-destructive mt-1">{errors.property_type}</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Einheiten */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Einheiten</CardTitle>
            <Button
              type="button"
              onClick={addUnit}
              className="flex items-center gap-2"
              disabled={isSaving}
            >
              <Plus className="w-4 h-4" />
              Einheit hinzufügen
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {formData.units.map((unit, index) => (
                <div 
                  key={index}
                  className="p-4 bg-secondary/50 rounded-lg space-y-4"
                >
                  <div className="flex justify-between items-start">
                    <h3 className="text-sm font-medium">Einheit {index + 1}</h3>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => removeUnit(index)}
                      disabled={isSaving}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    {/* Name */}
                    <div>
                      <label className="text-sm font-medium">Name</label>
                      <Input
                        value={unit.name}
                        onChange={e => updateUnit(index, 'name', e.target.value)}
                        placeholder="z.B. Wohnung 1"
                        className="mt-1"
                        disabled={isSaving}
                      />
                      {errors.units?.[index]?.name && (
                        <p className="text-sm text-destructive mt-1">
                          {errors.units[index].name}
                        </p>
                      )}
                    </div>

                    {/* Typ */}
                    <div>
                      <label className="text-sm font-medium">Typ</label>
                      <Select
                        value={unit.type}
                        onValueChange={value => updateUnit(index, 'type', value)}
                        disabled={isSaving}
                      >
                        <SelectTrigger className="mt-1">
                          <SelectValue placeholder="Bitte wählen..." />
                        </SelectTrigger>
                        <SelectContent>
                          {UNIT_TYPES.map((type) => (
                            <SelectItem key={type} value={type}>
                              {type}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Größe */}
                    <div>
                      <label className="text-sm font-medium">Größe (m²)</label>
                      <Input
                        type="number"
                        value={unit.size || ''}
                        onChange={e => updateUnit(index, 'size', e.target.value)}
                        className="mt-1"
                        min="0"
                        disabled={isSaving}
                      />
                      {errors.units?.[index]?.size && (
                        <p className="text-sm text-destructive mt-1">
                          {errors.units[index].size}
                        </p>
                      )}
                    </div>

                    {/* Status */}
                    <div>
                      <label className="text-sm font-medium">Status</label>
                      <Select
                        value={unit.status}
                        onValueChange={value => updateUnit(index, 'status', value)}
                        disabled={isSaving}
                      >
                        <SelectTrigger className="mt-1">
                          <SelectValue placeholder="Bitte wählen..." />
                        </SelectTrigger>
                        <SelectContent>
                          {UNIT_STATUS.map((status) => (
                            <SelectItem key={status} value={status}>
                              {status}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Miete - nur anzeigen wenn Status "besetzt" ist */}
                    {unit.status === 'besetzt' && (
                      <div>
                        <label className="text-sm font-medium">Monatliche Miete (€)</label>
                        <Input
                          type="number"
                          value={unit.rent || ''}
                          onChange={e => updateUnit(index, 'rent', e.target.value)}
                          className="mt-1"
                          min="0"
                          disabled={isSaving}
                        />
                        {errors.units?.[index]?.rent && (
                          <p className="text-sm text-destructive mt-1">
                            {errors.units[index].rent}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
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
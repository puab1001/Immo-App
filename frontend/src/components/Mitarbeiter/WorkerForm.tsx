// src/components/Mitarbeiter/WorkerForm.tsx
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
import { Plus, X } from 'lucide-react';
import { WorkerService } from '@/services/WorkerService';
import { useAsync } from '@/hooks/useAsync';
import { useFormState } from '@/hooks/useFormState';
import { useConfirmation } from '@/hooks/useConfirmation';
import { Worker, WorkerFormData, Skill, WorkerSkill } from '@/types/worker';
import { required, email, phone, number } from '@/lib/validators';

interface WorkerFormProps {
  initialData?: Worker;
}

const INITIAL_WORKER_DATA: WorkerFormData = {
  first_name: '',
  last_name: '',
  email: '',
  phone: '',
  hourly_rate: '',
  skills: [],
  active: true
};

const INITIAL_SKILL: WorkerSkill = {
  id: 0,
  name: '',
  experience_years: 0
};

export default function WorkerForm({ initialData }: WorkerFormProps) {
  const navigate = useNavigate();
  const [availableSkills, setAvailableSkills] = useState<Skill[]>([]);

  // Form state mit initialData oder default values
  const {
    formData,
    updateField,
    errors,
    setErrors,
    validateField,
    resetForm
  } = useFormState<WorkerFormData>(
    initialData || INITIAL_WORKER_DATA
  );

  // API calls mit useAsync
  const { execute: saveWorker, isLoading: isSaving } = useAsync(
    async (data: WorkerFormData) => {
      if (initialData) {
        return WorkerService.update(initialData.id, data);
      }
      return WorkerService.create(data);
    },
    {
      successMessage: initialData 
        ? 'Handwerker wurde erfolgreich aktualisiert'
        : 'Handwerker wurde erfolgreich erstellt',
      errorMessage: 'Fehler beim Speichern des Handwerkers'
    }
  );

  const { execute: fetchSkills } = useAsync(
    () => WorkerService.getSkills(),
    {
      errorMessage: 'Fehler beim Laden der verfügbaren Fähigkeiten'
    }
  );

  // Confirmation Dialog
  const confirmDiscardDialog = useConfirmation({
    title: 'Änderungen verwerfen?',
    message: 'Möchten Sie die Bearbeitung wirklich abbrechen? Alle nicht gespeicherten Änderungen gehen verloren.',
    confirmText: 'Verwerfen',
    cancelText: 'Weiter bearbeiten'
  });

  // Load skills on mount
  useEffect(() => {
    loadSkills();
  }, []);

  const loadSkills = async () => {
    try {
      const skills = await fetchSkills();
      setAvailableSkills(skills);
    } catch (error) {
      console.error('Fehler beim Laden der Fähigkeiten:', error);
    }
  };

  // Form validation
  const validateForm = (): boolean => {
    let isValid = true;
    const newErrors: Partial<Record<keyof WorkerFormData, string>> = {};

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

    if (!number(String(formData.hourly_rate))) {
      newErrors.hourly_rate = 'Gültiger Stundensatz erforderlich';
      isValid = false;
    }

    // At least one skill required
    if (formData.skills.length === 0) {
      newErrors.skills = 'Mindestens eine Fähigkeit ist erforderlich';
      isValid = false;
    }

    setErrors(newErrors);
    return isValid;
  };

 // src/components/Mitarbeiter/WorkerForm.tsx (Form submission part)

// Replace the handleSubmit function in WorkerForm.tsx with this improved version:

const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  
  if (!validateForm()) {
    return;
  }

  try {
    // Format skills properly, ensuring each skill has proper numeric values
    const formattedSkills = formData.skills.map(skill => ({
      id: typeof skill.id === 'string' ? parseInt(skill.id) : Number(skill.id),
      experience_years: typeof skill.experience_years === 'string' 
        ? parseInt(skill.experience_years) 
        : Number(skill.experience_years)
    }));

    // Create a clean submission object with proper types
    const submissionData = {
      ...formData,
      hourly_rate: typeof formData.hourly_rate === 'string' 
        ? parseFloat(formData.hourly_rate) 
        : formData.hourly_rate,
      skills: formattedSkills,
      active: formData.active !== undefined ? formData.active : true
    };

    // Log submission data for debugging
    console.log('Submitting worker data:', submissionData);
    
    const result = await saveWorker(submissionData);
    console.log('Worker saved successfully:', result);
    navigate('/workers');
  } catch (error) {
    console.error('Error during form submission:', error);
    // Error already handled by useAsync
  }
};

  // Cancel handling
  const handleCancel = async () => {
    const hasChanges = JSON.stringify(initialData) !== JSON.stringify(formData);
    if (hasChanges) {
      const confirmed = await confirmDiscardDialog.confirm();
      if (!confirmed) return;
    }
    navigate('/workers');
  };

  // Skill management
  const addSkill = () => {
    updateField('skills', [...formData.skills, { ...INITIAL_SKILL }]);
  };

  const removeSkill = (index: number) => {
    const newSkills = formData.skills.filter((_, i) => i !== index);
    updateField('skills', newSkills);
  };

  const updateSkill = (index: number, field: keyof WorkerSkill, value: any) => {
    const newSkills = formData.skills.map((skill, i) => {
      if (i !== index) return skill;
      
      // Make sure we're handling skill IDs consistently
      if (field === 'id') {
        const skillId = typeof value === 'string' ? parseInt(value) : Number(value);
        
        // If we have a skill name in the available skills, include it
        const selectedSkill = availableSkills.find(s => s.id === skillId);
        if (selectedSkill) {
          return { 
            ...skill, 
            id: skillId,
            name: selectedSkill.name 
          };
        }
        
        return { ...skill, id: skillId };
      }
      
      return { ...skill, [field]: value };
    });
    
    updateField('skills', newSkills);
  };

  return (
    <div className="p-4 max-w-3xl mx-auto">
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Persönliche Informationen */}
        <Card>
          <CardHeader>
            <CardTitle>
              {initialData ? 'Handwerker bearbeiten' : 'Neuer Handwerker'}
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

              {/* Stundensatz */}
              <div>
                <label className="text-sm font-medium">Stundensatz (€)</label>
                <Input
                  type="number"
                  value={formData.hourly_rate}
                  onChange={e => updateField('hourly_rate', parseFloat(e.target.value))}
                  className="mt-1"
                  min="0"
                  step="0.01"
                  disabled={isSaving}
                />
                {errors.hourly_rate && (
                  <p className="text-sm text-destructive mt-1">{errors.hourly_rate}</p>
                )}
              </div>

              {/* Status */}
              <div>
                <label className="text-sm font-medium">Status</label>
                <Select
                  value={formData.active ? 'active' : 'inactive'}
                  onValueChange={(value) => updateField('active', value === 'active')}
                  disabled={isSaving}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Status wählen" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Aktiv</SelectItem>
                    <SelectItem value="inactive">Inaktiv</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Fähigkeiten */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Fähigkeiten</CardTitle>
            <Button
              type="button"
              onClick={addSkill}
              disabled={isSaving}
              className="flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Fähigkeit hinzufügen
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {formData.skills.map((skill, index) => (
                <div 
                  key={index}
                  className="flex items-end gap-4 p-4 bg-secondary/50 rounded-lg"
                >
                  <div className="flex-1">
                    <label className="text-sm font-medium">Fähigkeit</label>
                    <Select
                      value={skill.id.toString()}
                      onValueChange={(value) => updateSkill(index, 'id', parseInt(value))}
                      disabled={isSaving}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Fähigkeit wählen" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableSkills.map((availableSkill) => (
                          <SelectItem 
                            key={availableSkill.id} 
                            value={availableSkill.id.toString()}
                          >
                            {availableSkill.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="w-32">
                    <label className="text-sm font-medium">Jahre Erfahrung</label>
                    <Input
                      type="number"
                      value={skill.experience_years}
                      onChange={(e) => updateSkill(index, 'experience_years', parseInt(e.target.value))}
                      className="mt-1"
                      min="0"
                      disabled={isSaving}
                    />
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => removeSkill(index)}
                    disabled={isSaving}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ))}

              {errors.skills && (
                <p className="text-sm text-destructive">{errors.skills}</p>
              )}
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
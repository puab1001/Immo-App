// src/components/Handwerker/WorkerForm.tsx
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
import { Plus, X } from 'lucide-react';
import { Worker, Skill, WorkerSkill } from '@/types/worker';

interface WorkerFormProps {
  initialData?: Worker;
}

export default function WorkerForm({ initialData }: WorkerFormProps) {
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [availableSkills, setAvailableSkills] = useState<Skill[]>([]);
  
  // Formular-State mit initialData oder Defaultwerten
  const [worker, setWorker] = useState<Worker>(() => ({
    first_name: initialData?.first_name || '',
    last_name: initialData?.last_name || '',
    phone: initialData?.phone || '',
    email: initialData?.email || '',
    hourly_rate: initialData?.hourly_rate || '',
    skills: initialData?.skills || [],
    active: initialData?.active ?? true
  }));

  // Lade verfügbare Skills
  useEffect(() => {
    const loadSkills = async () => {
      try {
        const response = await fetch('http://localhost:3001/workers/skills');
        if (!response.ok) throw new Error('Laden fehlgeschlagen');
        const data = await response.json();
        setAvailableSkills(data);
      } catch (error) {
        console.error('Fehler beim Laden der Skills:', error);
      }
    };

    loadSkills();
  }, []);

  const handleAddSkill = () => {
    setWorker(prev => ({
      ...prev,
      skills: [...prev.skills, { id: 0, experience_years: 0 }]
    }));
  };

  const handleRemoveSkill = (index: number) => {
    setWorker(prev => ({
      ...prev,
      skills: prev.skills.filter((_, i) => i !== index)
    }));
  };

  const updateSkill = (index: number, field: keyof WorkerSkill, value: any) => {
    setWorker(prev => ({
      ...prev,
      skills: prev.skills.map((skill, i) => {
        if (i !== index) return skill;
        return { ...skill, [field]: field === 'id' ? parseInt(value) : value };
      })
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const url = initialData
        ? `http://localhost:3001/workers/${initialData.id}`
        : 'http://localhost:3001/workers';

      const response = await fetch(url, {
        method: initialData ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...worker,
          hourly_rate: worker.hourly_rate === '' ? null : Number(worker.hourly_rate)
        })
      });

      if (!response.ok) throw new Error('Speichern fehlgeschlagen');
      navigate('/workers');
    } catch (error) {
      console.error('Fehler beim Speichern:', error);
      alert('Fehler beim Speichern des Handwerkers');
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
              {initialData ? 'Handwerker bearbeiten' : 'Neuer Handwerker'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Persönliche Daten */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Vorname</label>
                <Input
                  required
                  value={worker.first_name}
                  onChange={e => setWorker({ ...worker, first_name: e.target.value })}
                  className="mt-1"
                  disabled={isSubmitting}
                />
              </div>

              <div>
                <label className="text-sm font-medium">Nachname</label>
                <Input
                  required
                  value={worker.last_name}
                  onChange={e => setWorker({ ...worker, last_name: e.target.value })}
                  className="mt-1"
                  disabled={isSubmitting}
                />
              </div>

              <div>
                <label className="text-sm font-medium">Telefon</label>
                <Input
                  required
                  type="tel"
                  value={worker.phone}
                  onChange={e => setWorker({ ...worker, phone: e.target.value })}
                  className="mt-1"
                  disabled={isSubmitting}
                />
              </div>

              <div>
                <label className="text-sm font-medium">E-Mail</label>
                <Input
                  type="email"
                  value={worker.email}
                  onChange={e => setWorker({ ...worker, email: e.target.value })}
                  className="mt-1"
                  disabled={isSubmitting}
                />
              </div>

              <div>
                <label className="text-sm font-medium">Stundensatz (€)</label>
                <Input
                  type="number"
                  value={worker.hourly_rate}
                  onChange={e => setWorker({ ...worker, hourly_rate: e.target.value })}
                  className="mt-1"
                  disabled={isSubmitting}
                  min="0"
                  step="0.01"
                />
              </div>
            </div>

            {/* Fähigkeiten */}
            <div>
              <div className="flex justify-between items-center mb-4">
                <label className="text-sm font-medium">Fähigkeiten</label>
                <Button
                  type="button"
                  onClick={handleAddSkill}
                  disabled={isSubmitting}
                  className="flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Fähigkeit hinzufügen
                </Button>
              </div>

              <div className="space-y-4">
                {worker.skills.map((skill, index) => (
                  <Card key={index}>
                    <CardContent className="pt-4">
                      <div className="flex items-end gap-4">
                        <div className="flex-1">
                          <label className="text-sm font-medium">Fähigkeit</label>
                          <Select
                            value={skill.id.toString()}
                            onValueChange={(value) => updateSkill(index, 'id', value)}
                          >
                            <SelectTrigger className="mt-1">
                              <SelectValue placeholder="Fähigkeit auswählen" />
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

                        <div className="flex-1">
                          <label className="text-sm font-medium">Erfahrung (Jahre)</label>
                          <Input
                            type="number"
                            value={skill.experience_years}
                            onChange={(e) => updateSkill(index, 'experience_years', parseInt(e.target.value))}
                            className="mt-1"
                            min="0"
                            step="1"
                          />
                        </div>

                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          onClick={() => handleRemoveSkill(index)}
                          className="mb-1"
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Form Buttons */}
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
            onClick={() => navigate('/workers')}
            disabled={isSubmitting}
          >
            Abbrechen
          </Button>
        </div>
      </form>
    </div>
  );
}
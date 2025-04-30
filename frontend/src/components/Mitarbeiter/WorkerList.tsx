// src/components/Mitarbeiter/WorkerList.tsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  UserPlus, 
  Users, 
  Search, 
  Wrench,
  Filter
} from 'lucide-react';
import { Worker } from '@/types/worker';
import { useAsync } from '@/hooks/useAsync';
import { WorkerService } from '@/services/WorkerService';
import { WorkerCard } from '@/components/Mitarbeiter/WorkerCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingState } from '@/components/ui/LoadingState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function WorkerList() {
  const navigate = useNavigate();
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSkill, setSelectedSkill] = useState<string>('all');
  const [availableSkills, setAvailableSkills] = useState<Array<{ id: number; name: string }>>([]);

  const { execute: fetchWorkers, isLoading, error } = useAsync<Worker[]>(
    () => WorkerService.getAll(),
    {
      errorMessage: 'Fehler beim Laden der Handwerker'
    }
  );

  const { execute: fetchSkills } = useAsync(
    () => WorkerService.getSkills(),
    {
      errorMessage: 'Fehler beim Laden der Fähigkeiten'
    }
  );

  useEffect(() => {
    loadWorkers();
    loadSkills();
  }, []);

  const loadWorkers = async () => {
    try {
      const data = await fetchWorkers();
      setWorkers(data);
    } catch (error) {
      console.error('Fehler beim Laden:', error);
    }
  };

  const loadSkills = async () => {
    try {
      const skills = await fetchSkills();
      setAvailableSkills(skills);
    } catch (error) {
      console.error('Fehler beim Laden der Fähigkeiten:', error);
    }
  };

  const filteredWorkers = workers.filter(worker => {
    const matchesSearch = (
      worker.first_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      worker.last_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      worker.email.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const matchesSkill = selectedSkill === 'all' || 
      worker.skills.some(skill => skill.id.toString() === selectedSkill);

    return matchesSearch && matchesSkill;
  });

  if (isLoading) {
    return <LoadingState />;
  }

  if (error) {
    return (
      <ErrorState
        title="Fehler beim Laden"
        message={error.message}
        onRetry={loadWorkers}
      />
    );
  }

  return (
    <div className="p-4 max-w-5xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-2">
          <Wrench className="w-6 h-6" />
          <h1 className="text-2xl font-bold">Handwerker</h1>
        </div>
        <Button
          onClick={() => navigate('/workers/new')}
          className="flex items-center gap-2"
        >
          <UserPlus className="w-4 h-4" />
          Neuer Handwerker
        </Button>
      </div>

      {/* Filter und Suche */}
      <div className="grid gap-4 mb-6 md:grid-cols-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Handwerker suchen..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="relative">
          <Select 
            value={selectedSkill}
            onValueChange={setSelectedSkill}
          >
            <SelectTrigger className="w-full">
              <Filter className="w-4 h-4 mr-2" />
              <SelectValue placeholder="Nach Fähigkeit filtern" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle Fähigkeiten</SelectItem>
              {availableSkills.map(skill => (
                <SelectItem key={skill.id} value={skill.id.toString()}>
                  {skill.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {workers.length === 0 ? (
        <EmptyState
          title="Keine Handwerker vorhanden"
          description="Fügen Sie Ihren ersten Handwerker hinzu"
          icon={<Wrench className="w-12 h-12 text-muted-foreground" />}
          action={{
            label: 'Ersten Handwerker hinzufügen',
            onClick: () => navigate('/workers/new')
          }}
        />
      ) : filteredWorkers.length === 0 ? (
        <Card className="p-6 text-center">
          <p className="text-muted-foreground">
            Keine Handwerker gefunden für Ihre Filterkriterien
          </p>
        </Card>
      ) : (
        <div className="grid gap-4">
          {filteredWorkers.map(worker => (
            <WorkerCard
              key={worker.id}
              worker={worker}
              onEdit={() => navigate(`/workers/edit/${worker.id}`)}
              onView={() => navigate(`/workers/${worker.id}`)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
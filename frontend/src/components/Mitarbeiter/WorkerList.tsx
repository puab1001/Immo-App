// src/components/Handwerker/WorkerList.tsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  UserPlus, 
  Pencil, 
  Trash2,
  Phone,
  Mail,
  Wrench
} from 'lucide-react';

interface Skill {
  id: number;
  name: string;
  experience_years: number;
}

interface Worker {
  id: number;
  first_name: string;
  last_name: string;
  phone: string;
  email: string;
  hourly_rate: number;
  skills: Skill[];
  active: boolean;
}

export default function WorkerList() {
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState<number | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    loadWorkers();
  }, []);

  const loadWorkers = async () => {
    try {
      const response = await fetch('http://localhost:3001/workers');
      if (!response.ok) throw new Error('Laden fehlgeschlagen');
      const data = await response.json();
      setWorkers(data);
    } catch (error) {
      console.error('Fehler beim Laden:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Möchten Sie diesen Handwerker wirklich deaktivieren?')) return;

    setIsDeleting(id);
    try {
      const response = await fetch(`http://localhost:3001/workers/${id}`, {
        method: 'DELETE'
      });

      if (!response.ok) throw new Error('Löschen fehlgeschlagen');
      await loadWorkers();
    } catch (error) {
      console.error('Fehler beim Deaktivieren:', error);
    } finally {
      setIsDeleting(null);
    }
  };

  if (isLoading) return <div>Lade Handwerker...</div>;

  return (
    <div className="p-4 max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Handwerkerverwaltung</h1>
        <Button
          className="flex items-center gap-2"
          onClick={() => navigate('/workers/new')}
        >
          <UserPlus className="w-4 h-4" />
          Neuer Handwerker
        </Button>
      </div>

      {workers.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="text-muted-foreground mb-4">Keine Handwerker vorhanden</p>
            <Button
              onClick={() => navigate('/workers/new')}
              className="flex items-center gap-2"
            >
              <UserPlus className="w-4 h-4" />
              Ersten Handwerker hinzufügen
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {workers.map(worker => (
            <Card key={worker.id}>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <CardTitle className="text-xl">
                    {worker.first_name} {worker.last_name}
                  </CardTitle>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => navigate(`/workers/edit/${worker.id}`)}
                      disabled={isDeleting === worker.id}
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleDelete(worker.id)}
                      disabled={isDeleting === worker.id}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  {/* Kontaktinformationen */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm">
                      <Phone className="w-4 h-4 text-muted-foreground" />
                      <span>{worker.phone}</span>
                    </div>
                    {worker.email && (
                      <div className="flex items-center gap-2 text-sm">
                        <Mail className="w-4 h-4 text-muted-foreground" />
                        <span>{worker.email}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2 text-sm">
                      <span className="font-medium">Stundensatz:</span>
                      <span>{worker.hourly_rate} €/h</span>
                    </div>
                  </div>

                  {/* Fähigkeiten */}
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Wrench className="w-4 h-4 text-muted-foreground" />
                      <span className="font-medium">Fähigkeiten:</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {worker.skills?.map((skill, index) => (
                        <span
                          key={index}
                          className="inline-flex items-center px-2 py-1 rounded-md bg-secondary text-secondary-foreground text-sm"
                        >
                          {skill.name} ({skill.experience_years} Jahre)
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
// src/components/Mitarbeiter/WorkerDetail.tsx
import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  ArrowLeft, 
  Wrench, 
  Mail, 
  Phone, 
  Euro, 
  Clock,
  Calendar,
  CheckCircle,
  XCircle
} from 'lucide-react';
import { Worker } from '@/types/worker';
import { useAsync } from '@/hooks/useAsync';
import { WorkerService } from '@/services/WorkerService';
import { LoadingState } from '@/components/ui/LoadingState';
import { ErrorState } from '@/components/ui/ErrorState';
import { formatCurrency } from '@/lib/formatters';

export default function WorkerDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [worker, setWorker] = useState<Worker | null>(null);

  const { execute: fetchWorker, isLoading, error } = useAsync(
    () => WorkerService.getById(Number(id)),
    {
      errorMessage: 'Fehler beim Laden des Handwerkers'
    }
  );

  useEffect(() => {
    if (id) {
      loadWorker();
    }
  }, [id]);

  const loadWorker = async () => {
    try {
      const data = await fetchWorker();
      setWorker(data);
    } catch (error) {
      console.error('Fehler beim Laden:', error);
    }
  };

  if (isLoading) {
    return <LoadingState />;
  }

  if (error || !worker) {
    return (
      <ErrorState
        title="Fehler beim Laden"
        message={error?.message || 'Handwerker nicht gefunden'}
        onRetry={loadWorker}
      />
    );
  }

  return (
    <div className="p-4 max-w-5xl mx-auto">
      {/* Header mit Navigation und Aktionen */}
      <div className="mb-6">
        <Button
          variant="ghost"
          onClick={() => navigate('/workers')}
          className="mb-4"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Zurück zur Übersicht
        </Button>
        
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Wrench className="w-6 h-6" />
              {worker.first_name} {worker.last_name}
            </h1>
            <div className="flex items-center gap-2 mt-1">
              <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-sm ${
                worker.active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
              }`}>
                {worker.active ? (
                  <CheckCircle className="w-4 h-4" />
                ) : (
                  <XCircle className="w-4 h-4" />
                )}
                {worker.active ? 'Aktiv' : 'Inaktiv'}
              </span>
              <span className="text-muted-foreground">
                Stundensatz: {formatCurrency(worker.hourly_rate)}/Std.
              </span>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => navigate(`/workers/${worker.id}/assignments`)}
            >
              Aufträge
            </Button>
            <Button
              onClick={() => navigate(`/workers/edit/${worker.id}`)}
            >
              Bearbeiten
            </Button>
          </div>
        </div>
      </div>

      {/* Hauptinhalt */}
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
                <a 
                  href={`mailto:${worker.email}`} 
                  className="text-primary hover:underline"
                >
                  {worker.email}
                </a>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Phone className="w-5 h-5 text-muted-foreground" />
              <div>
                <p className="font-medium">Telefon</p>
                <a 
                  href={`tel:${worker.phone}`} 
                  className="text-primary hover:underline"
                >
                  {worker.phone}
                </a>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Euro className="w-5 h-5 text-muted-foreground" />
              <div>
                <p className="font-medium">Stundensatz</p>
                <p>{formatCurrency(worker.hourly_rate)}/Std.</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Fähigkeiten */}
        <Card>
          <CardHeader>
            <CardTitle>Fähigkeiten & Qualifikationen</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4">
              {worker.skills.map((skill) => (
                <div 
                  key={skill.id}
                  className="flex items-center justify-between p-4 bg-secondary/50 rounded-lg hover:bg-secondary transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <Wrench className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">{skill.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {skill.experience_years} Jahre Erfahrung
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-background">
                    <Clock className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm font-medium">
                      {skill.experience_years} Jahre
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Verfügbarkeit und Termine */}
        <Card>
          <CardHeader>
            <CardTitle>Verfügbarkeit & Termine</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4">
              {/* TODO: Kalenderintegration */}
              <p className="text-muted-foreground text-center py-4">
                Kalenderfunktion wird in Kürze verfügbar sein
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Dokumente */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Dokumente</CardTitle>
            <Button variant="outline" size="sm">
              Dokument hinzufügen
            </Button>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4">
              {/* TODO: Dokumentenliste */}
              <p className="text-muted-foreground text-center py-4">
                Noch keine Dokumente vorhanden
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
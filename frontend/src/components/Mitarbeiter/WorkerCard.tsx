// src/components/Mitarbeiter/WorkerCard.tsx
import { Worker } from '@/types/worker';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Eye, Pencil, Mail, Phone, Euro, Wrench } from 'lucide-react';
import { formatCurrency } from '@/lib/formatters';

interface WorkerCardProps {
  worker: Worker;
  onEdit: () => void;
  onView: () => void;
}

export function WorkerCard({ worker, onEdit, onView }: WorkerCardProps) {
  return (
    <Card className="hover:shadow-md transition-shadow duration-200">
      <CardContent className="p-4">
        <div className="flex justify-between items-start">
          <div>
            <h3 className="font-semibold text-lg">
              {worker.first_name} {worker.last_name}
            </h3>
            <div className="flex gap-2 mt-1">
              {worker.skills.map((skill, index) => (
                <span 
                  key={skill.id}
                  className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-secondary"
                >
                  {skill.name} ({skill.experience_years}J)
                </span>
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onView}
              className="flex items-center gap-1"
            >
              <Eye className="w-4 h-4" />
              <span className="hidden sm:inline">Details</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={onEdit}
              className="flex items-center gap-1"
            >
              <Pencil className="w-4 h-4" />
              <span className="hidden sm:inline">Bearbeiten</span>
            </Button>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="flex items-center gap-2 text-sm">
            <Mail className="w-4 h-4 text-muted-foreground" />
            <a href={`mailto:${worker.email}`} className="hover:underline">
              {worker.email}
            </a>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Phone className="w-4 h-4 text-muted-foreground" />
            <a href={`tel:${worker.phone}`} className="hover:underline">
              {worker.phone}
            </a>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Euro className="w-4 h-4 text-muted-foreground" />
            <span>{formatCurrency(worker.hourly_rate)}/Std.</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// src/components/Mieter/TenantCard.tsx
import { Tenant } from '@/types/tenant';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Eye, Pencil, Mail, Phone, MapPin } from 'lucide-react';
import { formatDate } from '@/lib/formatters';

interface TenantCardProps {
  tenant: Tenant;
  onEdit: () => void;
  onView: () => void;
}

export function TenantCard({ tenant, onEdit, onView }: TenantCardProps) {
  return (
    <Card className="hover:shadow-md transition-shadow duration-200">
      <CardContent className="p-4">
        <div className="flex justify-between items-start">
          <div>
            <h3 className="font-semibold text-lg">
              {tenant.first_name} {tenant.last_name}
            </h3>
            {tenant.unit_id && (
              <p className="text-sm text-muted-foreground">
                Seit {formatDate(tenant.rent_start_date)}
              </p>
            )}
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
            <a href={`mailto:${tenant.email}`} className="hover:underline">
              {tenant.email}
            </a>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Phone className="w-4 h-4 text-muted-foreground" />
            <a href={`tel:${tenant.phone}`} className="hover:underline">
              {tenant.phone}
            </a>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <MapPin className="w-4 h-4 text-muted-foreground" />
            <span>{tenant.address}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
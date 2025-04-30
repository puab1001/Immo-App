// src/components/Immobilien/PropertyCard.tsx
import { Property } from '@/types/property';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronUp, Pencil, Trash2 } from 'lucide-react';
import { formatCurrency } from '@/lib/formatters';

interface PropertyCardProps {
  property: Property;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

export function PropertyCard({
  property,
  isExpanded,
  onToggleExpand,
  onEdit,
  onDelete,
}: PropertyCardProps) {
  return (
    <Card className="hover:shadow-md transition-shadow duration-200">
      <CardHeader className="p-4">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={onToggleExpand}
              className="p-0 hover:bg-transparent"
            >
              {isExpanded ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </Button>
            <h3 className="font-semibold text-lg">{property.address}</h3>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onEdit}
              className="flex items-center gap-1"
            >
              <Pencil className="w-4 h-4" />
              <span className="hidden sm:inline">Bearbeiten</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={onDelete}
              className="flex items-center gap-1 text-destructive hover:text-destructive"
            >
              <Trash2 className="w-4 h-4" />
              <span className="hidden sm:inline">Löschen</span>
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Art der Immobilie</p>
              <p>{property.property_type || 'Keine Angabe'}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Monatliche Gesamtmiete</p>
              <p className="font-medium">
                {formatCurrency(property.total_rent)}
              </p>
            </div>
          </div>

          {isExpanded && property.units && (
            <div className="pt-4 border-t">
              <h4 className="font-medium mb-3">Wohneinheiten</h4>
              <div className="grid gap-3">
                {property.units.map((unit, index) => (
                  <div
                    key={unit.id || index}
                    className="bg-secondary/50 rounded-lg p-3"
                  >
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div>
                        <p className="text-xs text-muted-foreground">Name</p>
                        <p className="text-sm font-medium">{unit.name}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Typ</p>
                        <p className="text-sm">{unit.type}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Größe</p>
                        <p className="text-sm">{unit.size} m²</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Status</p>
                        <div className="flex items-center gap-1">
                          <span className={`w-2 h-2 rounded-full ${
                            unit.status === 'besetzt' ? 'bg-blue-500' : 'bg-green-500'
                          }`} />
                          <p className="text-sm">{unit.status}</p>
                        </div>
                      </div>
                      {unit.status === 'besetzt' && (
                        <div>
                          <p className="text-xs text-muted-foreground">Miete</p>
                          <p className="text-sm">{formatCurrency(unit.rent || 0)}</p>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

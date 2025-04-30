// src/components/ui/EmptyState.tsx
import { PlusCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";



interface EmptyStateProps {
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  icon?: React.ReactNode;
}

export function EmptyState({ title, description, action, icon }: EmptyStateProps) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center py-12">
        {icon && <div className="mb-4">{icon}</div>}
        <p className="text-lg font-medium mb-2">{title}</p>
        {description && (
          <p className="text-sm text-muted-foreground mb-4">{description}</p>
        )}
        {action && (
          <Button
            onClick={action.onClick}
            className="flex items-center gap-2"
          >
            <PlusCircle className="w-4 h-4" />
            {action.label}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
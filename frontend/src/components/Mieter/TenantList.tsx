// src/components/Mieter/TenantList.tsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { UserPlus, Users, Search } from 'lucide-react';
import { Tenant } from '@/types/tenant';
import { useAsync } from '@/hooks/useAsync';
import { TenantService } from '@/services/TenantService';
import { TenantCard } from '@/components/Mieter/TenantCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingState } from '@/components/ui/LoadingState';
import { ErrorState } from '@/components/ui/ErrorState';
import { API } from '@/services/api';

export default function TenantList() {
  const navigate = useNavigate();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  const { execute: fetchTenants, isLoading, error } = useAsync<Tenant[]>(
    () => TenantService.getAll(),
    {
      errorMessage: 'Fehler beim Laden der Mieter',
      loadingTimeout: API.loadingStateTimeout
    }
  );

  useEffect(() => {
    loadTenants();
  }, []);

  const loadTenants = async () => {
    try {
      const data = await fetchTenants();
      setTenants(data);
    } catch (error) {
      console.error('Fehler beim Laden:', error);
    }
  };

  const filteredTenants = tenants.filter(tenant => 
    tenant.first_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    tenant.last_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    tenant.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (isLoading) {
    return <LoadingState />;
  }

  if (error) {
    return (
      <ErrorState
        title="Fehler beim Laden"
        message={error.message}
        onRetry={loadTenants}
      />
    );
  }

  return (
    <div className="p-4 max-w-5xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-2">
          <Users className="w-6 h-6" />
          <h1 className="text-2xl font-bold">Mieter</h1>
        </div>
        <Button
          onClick={() => navigate('/tenants/new')}
          className="flex items-center gap-2"
        >
          <UserPlus className="w-4 h-4" />
          Neuer Mieter
        </Button>
      </div>

      {/* Suchleiste */}
      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Mieter suchen..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {tenants.length === 0 ? (
        <EmptyState
          title="Keine Mieter vorhanden"
          description="Fügen Sie Ihren ersten Mieter hinzu"
          icon={<Users className="w-12 h-12 text-muted-foreground" />}
          action={{
            label: 'Ersten Mieter hinzufügen',
            onClick: () => navigate('/tenants/new')
          }}
        />
      ) : filteredTenants.length === 0 ? (
        <Card className="p-6 text-center">
          <p className="text-muted-foreground">
            Keine Mieter gefunden für "{searchTerm}"
          </p>
        </Card>
      ) : (
        <div className="grid gap-4">
          {filteredTenants.map(tenant => (
            <TenantCard
              key={tenant.id}
              tenant={tenant}
              onEdit={() => navigate(`/tenants/edit/${tenant.id}`)}
              onView={() => navigate(`/tenants/${tenant.id}`)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
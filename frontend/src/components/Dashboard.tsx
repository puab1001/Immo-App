import { useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Building2, Home, Currency, AlertCircle } from 'lucide-react';
import { useAsync } from '@/hooks/useAsync';
import { LoadingState } from '@/components/ui/LoadingState';
import { ErrorState } from '@/components/ui/ErrorState';
import { EmptyState } from '@/components/ui/EmptyState';

interface DashboardStats {
    total_properties: number;
    total_units: number;
    monthly_rent: number;
    top_properties: Array<{
        id: number;
        address: string;
        property_type: string;
        total_rent: number;
    }>;
    vacant_units: Array<{
        id: number;
        name: string;
        property_address: string;
        type: string;
        size: number;
    }>;
}

export default function Dashboard() {
    const { execute: fetchDashboardStats, data: stats, isLoading, error } = useAsync<DashboardStats>(
        async () => {
            const response = await fetch('http://localhost:3001/dashboard/stats');
            if (!response.ok) {
                throw new Error('Fehler beim Laden der Dashboard-Daten');
            }
            return await response.json();
        },
        {
            errorMessage: 'Fehler beim Laden der Dashboard-Daten',
            autoExecute: true
        }
    );

    if (isLoading) return <LoadingState />;
    
    if (error) {
        return (
            <ErrorState
                title="Fehler beim Laden"
                message="Die Dashboard-Daten konnten nicht geladen werden."
                onRetry={fetchDashboardStats}
            />
        );
    }
    
    if (!stats) {
        return (
            <EmptyState
                title="Keine Daten verfügbar"
                description="Es sind noch keine Dashboard-Daten vorhanden."
            />
        );
    }

    return (
        <div className="p-4 space-y-6">
            {/* Übersichtskarten */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Immobilien</CardTitle>
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.total_properties}</div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Wohneinheiten</CardTitle>
                        <Home className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.total_units}</div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Monatliche Miete</CardTitle>
                        <Currency className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {stats.monthly_rent.toLocaleString('de-DE')} €
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Leerstehende Einheiten</CardTitle>
                        <AlertCircle className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.vacant_units.length}</div>
                    </CardContent>
                </Card>
            </div>



            {/* Leerstehende Einheiten */}
            <Card>
                <CardHeader>
                    <CardTitle>Leerstehende Einheiten</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="relative overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="text-xs uppercase bg-muted">
                                <tr>
                                    <th className="px-6 py-3">Einheit</th>
                                    <th className="px-6 py-3">Immobilie</th>
                                    <th className="px-6 py-3">Typ</th>
                                    <th className="px-6 py-3">Größe</th>
                                </tr>
                            </thead>
                            <tbody>
                                {stats.vacant_units.map((unit) => (
                                    <tr key={unit.id} className="border-b">
                                        <td className="px-6 py-4">{unit.name}</td>
                                        <td className="px-6 py-4">{unit.property_address}</td>
                                        <td className="px-6 py-4">{unit.type}</td>
                                        <td className="px-6 py-4">{unit.size} m²</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
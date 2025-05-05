import { useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Building2, Home, Currency, AlertCircle, Wrench } from 'lucide-react';
import { useAsync } from '@/hooks/useAsync';
import { LoadingState } from '@/components/ui/LoadingState';
import { ErrorState } from '@/components/ui/ErrorState';
import { EmptyState } from '@/components/ui/EmptyState';
import { formatCurrency } from '@/lib/formatters';

interface DashboardStats {
    total_properties: number;
    total_units: number;
    monthly_rent: number;
    vacant_units: Array<{
        id: number;
        name: string;
        property_address: string;
        type: string;
        size: number;
    }>;
    active_workers: number;
}

export default function Dashboard() {
    const { execute: fetchDashboardStats, data: stats, isLoading, error } = useAsync<DashboardStats>(
        async () => {
            console.log('Fetching dashboard stats...');
            try {
                // Klare Timeout-Einstellung für den Fetch
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 Sekunden Timeout
                
                // Verwende die API-Klasse für konsistentes Fehlerhandling
                const response = await fetch('http://localhost:3001/dashboard/stats', {
                    signal: controller.signal,
                    headers: {
                        'Accept': 'application/json'
                    }
                });
                
                clearTimeout(timeoutId);
                
                if (!response.ok) {
                    console.error('API response not OK:', response.status, response.statusText);
                    throw new Error(`Fehler beim Laden: ${response.status} ${response.statusText}`);
                }
                
                const responseText = await response.text();
                console.log('Dashboard raw response:', responseText);
                
                let data;
                try {
                    data = responseText ? JSON.parse(responseText) : {};
                } catch (parseError) {
                    console.error('Error parsing dashboard response:', parseError);
                    throw new Error('Fehler beim Parsen der Server-Antwort');
                }
                
                console.log('Dashboard data parsed:', data);
                
                // Stelle sicher, dass Werte immer als korrekte Typen vorhanden sind
                return {
                    total_properties: Number(data.total_properties) || 0,
                    total_units: Number(data.total_units) || 0,
                    monthly_rent: Number(data.monthly_rent) || 0,
                    vacant_units: Array.isArray(data.vacant_units) ? data.vacant_units : [],
                    active_workers: Number(data.active_workers) || 0
                };
            } catch (err) {
                console.error('Dashboard fetch error:', err);
                throw err;
            }
        },
        {
            errorMessage: 'Fehler beim Laden der Dashboard-Daten',
            autoExecute: true,
            showErrorToast: true,
            loadingTimeout: 20000 // 20 seconds timeout for loading state
        }
    );

    useEffect(() => {
        if (error) {
            console.error('Dashboard error occurred:', error);
        }
    }, [error]);
    
    // Stellen wir sicher, dass autoExecute korrekt funktioniert
    useEffect(() => {
        if (!stats && !isLoading && !error) {
            console.log('Manually executing fetchDashboardStats');
            fetchDashboardStats();
        }
    }, [stats, isLoading, error, fetchDashboardStats]);

    if (isLoading) {
        return <LoadingState />;
    }
    
    if (error) {
        return (
            <ErrorState
                title="Fehler beim Laden"
                message="Die Dashboard-Daten konnten nicht geladen werden."
                onRetry={() => {
                    console.log('Retrying dashboard data fetch...');
                    fetchDashboardStats();
                }}
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
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
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
                            {formatCurrency(stats.monthly_rent)}
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

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Aktive Handwerker</CardTitle>
                        <Wrench className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.active_workers}</div>
                    </CardContent>
                </Card>
            </div>

            {/* Leerstehende Einheiten */}
            <Card>
                <CardHeader>
                    <CardTitle>Leerstehende Einheiten</CardTitle>
                </CardHeader>
                <CardContent>
                    {stats.vacant_units && stats.vacant_units.length > 0 ? (
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
                    ) : (
                        <p className="text-center text-muted-foreground py-4">Keine leerstehenden Einheiten vorhanden</p>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
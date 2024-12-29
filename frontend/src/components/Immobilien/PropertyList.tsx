import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { PlusCircle, Pencil, Trash2, ChevronDown, ChevronUp } from 'lucide-react'
import { Property, Unit } from '@/types/property'

export default function PropertyList() {
  const [properties, setProperties] = useState<Property[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isDeleting, setIsDeleting] = useState<number | null>(null)
  const [expandedProperty, setExpandedProperty] = useState<number | null>(null)
  const navigate = useNavigate()

  const loadProperties = async () => {
    try {
      const response = await fetch('http://localhost:3001/properties')
      if (!response.ok) {
        throw new Error(await response.text())
      }
      const data = await response.json()
      setProperties(data)
    } catch (error) {
      console.error('Fehler beim Laden:', error)
      alert('Fehler beim Laden der Immobilien')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadProperties()
  }, [])

  const toggleExpand = (propertyId: number | undefined) => {
    if (!propertyId) return;
    setExpandedProperty(expandedProperty === propertyId ? null : propertyId);
  }

  const handleDelete = async (id: number | undefined) => {
    if (!id) return;
    if (!confirm('Möchten Sie diese Immobilie wirklich löschen?')) return;

    setIsDeleting(id);
    try {
      const response = await fetch(`http://localhost:3001/properties/${id}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        throw new Error(await response.text())
      }

      await loadProperties()
    } catch (error) {
      console.error('Fehler beim Löschen:', error)
      alert('Fehler beim Löschen der Immobilie')
    } finally {
      setIsDeleting(null)
    }
  }

  if (isLoading) return <div>Lade Immobilien...</div>

  return (
    <div className="p-4 max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Immobilienverwaltung</h1>
        {properties.length > 0 && (
          <Button
            className="flex items-center gap-2"
            onClick={() => navigate('/new')}
          >
            <PlusCircle className="w-4 h-4" />
            Neue Immobilie
          </Button>
        )}
      </div>

      {properties.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="text-muted-foreground mb-4">Keine Immobilien vorhanden, Pul darbiar Azizam!</p>
            <Button
              onClick={() => navigate('/new')}
              className="flex items-center gap-2"
            >
              <PlusCircle className="w-4 h-4" />
              Erste Immobilie hinzufügen
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {properties.map(property => (
            <Card key={property.id}>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => toggleExpand(property.id)}
                      className="p-0 hover:bg-transparent"
                    >
                      {expandedProperty === property.id ?
                        <ChevronUp className="w-4 h-4" /> :
                        <ChevronDown className="w-4 h-4" />
                      }
                    </Button>
                    <CardTitle>{property.address}</CardTitle>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => navigate(`/properties/edit/${property.id}`)} // Korrigierter Pfad
                      disabled={isDeleting === property.id}
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleDelete(property.id)}
                      disabled={isDeleting === property.id}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-gray-500">Art der Immobilie</p>
                      <p>{property.property_type || 'Keine Angabe'}</p>
                    </div>

                    <div>
                      <p className="text-sm text-gray-500">Monatliche Gesamtmiete</p>
                      <p className="font-medium">
                        {property.total_rent?.toLocaleString('de-DE')} €
                      </p>
                    </div>
                  </div>

                  {/* Units Section */}
                  {expandedProperty === property.id && property.units && property.units.length > 0 && (
                    <div className="mt-4 border-t pt-4">
                      <h3 className="text-sm font-semibold mb-3">Einheiten:</h3>
                      <div className="grid gap-3">
                        {property.units.map((unit, index) => (
                          <div key={index} className="bg-gray-50 p-3 rounded-lg">
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                              <div>
                                <p className="text-xs text-gray-500">Name</p>
                                <p className="text-sm font-medium">{unit.name}</p>
                              </div>
                              <div>
                                <p className="text-xs text-gray-500">Typ</p>
                                <p className="text-sm">{unit.type}</p>
                              </div>
                              <div>
                                <p className="text-xs text-gray-500">Größe</p>
                                <p className="text-sm">{unit.size} m²</p>
                              </div>
                              <div>
                                <p className="text-xs text-gray-500">Status</p>
                                <p className="text-sm">{unit.status}</p>
                              </div>
                              {unit.status === 'besetzt' && (
                                <div>
                                  <p className="text-xs text-gray-500">Miete</p>
                                  <p className="text-sm">{unit.rent} €</p>
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
          ))}
        </div>
      )}
    </div>
  )
}

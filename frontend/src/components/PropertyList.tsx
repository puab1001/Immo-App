import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { PlusCircle, Pencil, Trash2 } from 'lucide-react'

type Property = {
  id: number
  address: string
  size: number
  price: number
  status: string
}

export default function PropertyList() {
  const [properties, setProperties] = useState<Property[]>([])
  const navigate = useNavigate()

  const loadProperties = async () => {
    try {
      const response = await fetch('http://localhost:3001/properties')
      if (response.ok) {
        const data = await response.json()
        setProperties(data)
      }
    } catch (error) {
      console.error('Fehler beim Laden:', error)
    }
  }

  useEffect(() => {
    loadProperties()
  }, [])

  const handleDelete = async (id: number) => {
    if (!confirm('Möchten Sie diese Immobilie wirklich löschen?')) return

    try {
      const response = await fetch(`http://localhost:3001/properties/${id}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        // Liste neu laden nach dem Löschen
        loadProperties()
      }
    } catch (error) {
      console.error('Fehler beim Löschen:', error)
    }
  }

  return (
    <div className="p-4 max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Immobilienverwaltung</h1>
        <Button 
          className="flex items-center gap-2"
          onClick={() => navigate('/new')}
        >
          <PlusCircle className="w-4 h-4" />
          Neue Immobilie
        </Button>
      </div>

      <div className="grid gap-4">
        {properties.map(property => (
          <Card key={property.id}>
            <CardHeader>
              <div className="flex justify-between items-start">
                <CardTitle>{property.address}</CardTitle>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => navigate(`/edit/${property.id}`)}
                  >
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleDelete(property.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">Größe</p>
                  <p>{property.size} m²</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Preis</p>
                  <p>{property.price} €</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
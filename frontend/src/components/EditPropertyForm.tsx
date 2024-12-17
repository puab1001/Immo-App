import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Plus, Trash } from 'lucide-react'

interface Unit {
  id?: number
  name: string
  type: string
  size: number
  status: string
  rent: number
}

interface Property {
  id: number
  address: string
  size: number
  price: number
  status: string
  units: Unit[]
}

export default function EditPropertyForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [property, setProperty] = useState<Property | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    const loadProperty = async () => {
      try {
        const response = await fetch(`http://localhost:3001/properties/${id}`)
        if (!response.ok) throw new Error(await response.text())
        const data = await response.json()
        setProperty(data)
      } catch (error) {
        console.error('Fehler beim Laden:', error)
        alert('Fehler beim Laden der Immobilie')
      } finally {
        setIsLoading(false)
      }
    }
    loadProperty()
  }, [id])

  const addUnit = () => {
    if (!property) return
    
    const newUnit: Unit = {
      name: '',
      type: 'Wohnung',
      size: 0,
      status: 'frei',
      rent: 0
    }
    
    setProperty({
      ...property,
      units: [...property.units, newUnit]
    })
  }

  const removeUnit = (index: number) => {
    if (!property) return
    setProperty({
      ...property,
      units: property.units.filter((_, i) => i !== index)
    })
  }

  const updateUnit = (index: number, field: keyof Unit, value: any) => {
    if (!property) return
    
    const newUnits = [...property.units]
    newUnits[index] = {
      ...newUnits[index],
      [field]: value
    }
    
    setProperty({
      ...property,
      units: newUnits
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!property) return
    setIsSubmitting(true)
    
    try {
      const response = await fetch(`http://localhost:3001/properties/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(property)
      })

      if (!response.ok) throw new Error(await response.text())
      navigate('/properties')
    } catch (error) {
      console.error('Fehler beim Speichern:', error)
      alert('Fehler beim Aktualisieren der Immobilie')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isLoading) return <div>Lade...</div>
  if (!property) return <div>Immobilie nicht gefunden</div>

  return (
    <div className="p-4 max-w-4xl mx-auto">
      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Immobilie bearbeiten</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Adresse</label>
                <Input
                  value={property.address}
                  onChange={e => setProperty({...property, address: e.target.value})}
                  className="mt-1"
                  disabled={isSubmitting}
                />
              </div>
              <div>
                <label className="text-sm font-medium">Gesamtgröße (m²)</label>
                <Input
                  type="number"
                  value={property.size}
                  onChange={e => setProperty({...property, size: Number(e.target.value)})}
                  className="mt-1"
                  disabled={isSubmitting}
                />
              </div>
              <div>
                <label className="text-sm font-medium">Preis (€)</label>
                <Input
                  type="number"
                  value={property.price}
                  onChange={e => setProperty({...property, price: Number(e.target.value)})}
                  className="mt-1"
                  disabled={isSubmitting}
                />
              </div>
              <div>
                <label className="text-sm font-medium">Status</label>
                <Input
                  value={property.status}
                  onChange={e => setProperty({...property, status: e.target.value})}
                  className="mt-1"
                  disabled={isSubmitting}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Einheiten</CardTitle>
            <Button 
              type="button"
              onClick={addUnit}
              className="flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Einheit hinzufügen
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {property.units?.map((unit, index) => (
                <Card key={index}>
                  <CardContent className="pt-4">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-lg font-semibold">Einheit {index + 1}</h3>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => removeUnit(index)}
                      >
                        <Trash className="w-4 h-4" />
                      </Button>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium">Name</label>
                        <Input
                          value={unit.name}
                          onChange={e => updateUnit(index, 'name', e.target.value)}
                          placeholder="z.B. Wohnung 1"
                          className="mt-1"
                          disabled={isSubmitting}
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium">Typ</label>
                        <Input
                          value={unit.type}
                          onChange={e => updateUnit(index, 'type', e.target.value)}
                          placeholder="z.B. Wohnung"
                          className="mt-1"
                          disabled={isSubmitting}
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium">Größe (m²)</label>
                        <Input
                          type="number"
                          value={unit.size}
                          onChange={e => updateUnit(index, 'size', Number(e.target.value))}
                          className="mt-1"
                          disabled={isSubmitting}
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium">Miete (€)</label>
                        <Input
                          type="number"
                          value={unit.rent}
                          onChange={e => updateUnit(index, 'rent', Number(e.target.value))}
                          className="mt-1"
                          disabled={isSubmitting}
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium">Status</label>
                        <Input
                          value={unit.status}
                          onChange={e => updateUnit(index, 'status', e.target.value)}
                          placeholder="z.B. frei"
                          className="mt-1"
                          disabled={isSubmitting}
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-4">
          <Button 
            type="submit" 
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Wird gespeichert...' : 'Speichern'}
          </Button>
          <Button 
            type="button" 
            variant="outline"
            onClick={() => navigate('/properties')}
            disabled={isSubmitting}
          >
            Abbrechen
          </Button>
        </div>
      </form>
    </div>
  )
}
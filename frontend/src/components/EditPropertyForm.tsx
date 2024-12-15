import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

type Property = {
  id: number
  address: string
  size: number
  price: number
  status: string
}

export default function EditPropertyForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [property, setProperty] = useState<Property | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const loadProperty = async () => {
      try {
        const response = await fetch(`http://localhost:3001/properties/${id}`)
        if (response.ok) {
          const data = await response.json()
          setProperty(data)
        }
      } catch (error) {
        console.error('Fehler beim Laden:', error)
      } finally {
        setIsLoading(false)
      }
    }

    loadProperty()
  }, [id])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!property) return

    try {
      const response = await fetch(`http://localhost:3001/properties/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(property)
      })

      if (response.ok) {
        navigate('/')
      }
    } catch (error) {
      console.error('Fehler beim Speichern:', error)
    }
  }

  if (isLoading) return <div>Lade...</div>
  if (!property) return <div>Immobilie nicht gefunden</div>

  return (
    <div className="p-4 max-w-2xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle>Immobilie bearbeiten</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-sm font-medium">Adresse</label>
              <Input
                value={property.address}
                onChange={e => setProperty({...property, address: e.target.value})}
                className="mt-1"
              />
            </div>
            
            <div>
              <label className="text-sm font-medium">Größe (m²)</label>
              <Input
                type="number"
                value={property.size}
                onChange={e => setProperty({...property, size: Number(e.target.value)})}
                className="mt-1"
              />
            </div>
            
            <div>
              <label className="text-sm font-medium">Preis (€)</label>
              <Input
                type="number"
                value={property.price}
                onChange={e => setProperty({...property, price: Number(e.target.value)})}
                className="mt-1"
              />
            </div>

            <div className="flex gap-4 pt-4">
              <Button type="submit">Speichern</Button>
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => navigate('/')}
              >
                Abbrechen
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
// PropertyForm.tsx
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export default function PropertyForm() {
  const navigate = useNavigate()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [property, setProperty] = useState({
    address: '',
    size: '',
    price: '',
    status: 'available'
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      const response = await fetch('http://localhost:3001/properties', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...property,
          size: Number(property.size),
          price: Number(property.price)
        })
      })

      if (response.ok) {
        navigate('/properties')
      } else {
        alert('Fehler beim Speichern der Immobilie')
      }
    } catch (err) {
      console.error('Fehler beim Speichern:', err)
      alert('Fehler beim Speichern der Immobilie')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="p-4 max-w-2xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle>Neue Immobilie hinzufügen</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-sm font-medium">Adresse</label>
              <Input
                required
                value={property.address}
                onChange={e => setProperty({...property, address: e.target.value})}
                className="mt-1"
              />
            </div>
            
            <div>
              <label className="text-sm font-medium">Größe (m²)</label>
              <Input
                required
                type="number"
                min="1"
                value={property.size}
                onChange={e => setProperty({...property, size: e.target.value})}
                className="mt-1"
              />
            </div>
            
            <div>
              <label className="text-sm font-medium">Preis (€)</label>
              <Input
                required
                type="number"
                min="0"
                value={property.price}
                onChange={e => setProperty({...property, price: e.target.value})}
                className="mt-1"
              />
            </div>

            <div className="flex gap-4 pt-4">
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
        </CardContent>
      </Card>
    </div>
  )
}
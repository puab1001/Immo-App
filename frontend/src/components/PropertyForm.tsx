// PropertyForm.tsx
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { propertyTypes } from '@/constants/PropertyTypes'


export default function PropertyForm() {
  const navigate = useNavigate()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [property, setProperty] = useState({
    address: '',
    size: '',
    price: '',
    status: 'available',
    property_type: ''
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
  
    try {
      const response = await fetch('http://localhost:3001/properties', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...property,  // Dies behält alle Felder bei
          size: Number(property.size),
          price: Number(property.price)
          // property_type wird jetzt nicht mehr herausgefiltert
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
                onChange={e => setProperty({ ...property, address: e.target.value })}
                className="mt-1"
              />
            </div>

            <div>
              <label className="text-sm font-medium">Art der Immobilie</label>
              <Select
                value={property.property_type}
                onValueChange={(value) => setProperty({ ...property, property_type: value })}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Bitte wählen..." />
                </SelectTrigger>
                <SelectContent>
                  {propertyTypes.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
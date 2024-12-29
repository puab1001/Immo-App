import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Plus, Trash } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { propertyTypes, UNIT_TYPES, UNIT_STATUS } from '@/constants/propertyTypes'

// Typdefinitionen
interface Unit {
  id?: number
  name: string
  type: typeof UNIT_TYPES[number]
  size: number | ''
  status: typeof UNIT_STATUS[number]
  rent?: number | ''
}

interface Property {
  id?: number
  address: string
  size: number
  price: number
  property_type: string
  units: Unit[]
}

interface PropertyFormProps {
  initialData?: Property
}

export default function PropertyForm({ initialData }: PropertyFormProps) {
  console.log('PropertyForm received initialData:', initialData); // Logging
  const navigate = useNavigate()
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Formular-State mit initialData oder Defaultwerten
  const [property, setProperty] = useState<Property>(() => ({
    address: initialData?.address || '',
    size: initialData?.size || 0,
    price: initialData?.price || 0,
    property_type: initialData?.property_type || '',
    units: initialData?.units || []
  }))

  // Unit Management Funktionen
  const addUnit = () => {
    const newUnit: Unit = {
      name: '',
      type: 'Wohnung',
      size: '',
      status: 'verfügbar',
      rent: ''
    }
    setProperty(prev => ({
      ...prev,
      units: [...prev.units, newUnit]
    }))
  }

  const removeUnit = (index: number) => {
    setProperty(prev => ({
      ...prev,
      units: prev.units.filter((_, i) => i !== index)
    }))
  }

  const updateUnit = (index: number, field: keyof Unit, value: any) => {
    setProperty(prev => ({
      ...prev,
      units: prev.units.map((unit, i) => {
        if (i !== index) return unit;

        // Wenn der Status von "besetzt" auf "verfügbar" wechselt, Miete zurücksetzen
        if (field === 'status' && value === 'verfügbar') {
          return { ...unit, [field]: value, rent: '' };
        }

        // Für numerische Felder
        if (field === 'size' || field === 'rent') {
          value = value === '' ? '' : Number(value);
        }

        return { ...unit, [field]: value };
      })
    }))
  }

  // Form Submit Handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    // Konvertiere leere Strings zu 0
    const submissionData = {
      ...property,
      units: property.units.map(unit => ({
        ...unit,
        size: unit.size === '' ? 0 : Number(unit.size),
        rent: unit.rent === '' ? 0 : Number(unit.rent)
      }))
    }

    try {
      const url = initialData
        ? `http://localhost:3001/properties/${initialData.id}`
        : 'http://localhost:3001/properties'

      const response = await fetch(url, {
        method: initialData ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(submissionData)
      })

      if (!response.ok) throw new Error('Fehler beim Speichern')
      navigate('/properties')
    } catch (error) {
      console.error('Fehler beim Speichern:', error)
      alert('Fehler beim Speichern der Immobilie')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="p-4 max-w-4xl mx-auto">
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Immobilien-Hauptdaten */}
        <Card>
          <CardHeader>
            <CardTitle>
              {initialData ? 'Immobilie bearbeiten' : 'Neue Immobilie'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              {/* Adresse */}
              <div>
                <label className="text-sm font-medium">Adresse</label>
                <Input
                  required
                  value={property.address}
                  onChange={e => setProperty({ ...property, address: e.target.value })}
                  className="mt-1"
                  disabled={isSubmitting}
                />
              </div>

              {/* Immobilientyp */}
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
            </div>
          </CardContent>
        </Card>

        {/* Einheiten */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Einheiten</CardTitle>
            <Button
              type="button"
              onClick={addUnit}
              className="flex items-center gap-2"
              disabled={isSubmitting}
            >
              <Plus className="w-4 h-4" />
              Einheit hinzufügen
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {property.units.map((unit, index) => (
                <Card key={index}>
                  <CardContent className="pt-4">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-lg font-semibold">Einheit {index + 1}</h3>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => removeUnit(index)}
                        disabled={isSubmitting}
                      >
                        <Trash className="w-4 h-4" />
                      </Button>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      {/* Name */}
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

                      {/* Typ */}
                      <div>
                        <label className="text-sm font-medium">Typ</label>
                        <Select
                          value={unit.type}
                          onValueChange={(value) => updateUnit(index, 'type', value)}
                        >
                          <SelectTrigger className="mt-1">
                            <SelectValue placeholder="Bitte wählen..." />
                          </SelectTrigger>
                          <SelectContent>
                            {UNIT_TYPES.map((type) => (
                              <SelectItem key={type} value={type}>
                                {type}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Größe */}
                      <div>
                        <label className="text-sm font-medium">Größe (m²)</label>
                        <Input
                          type="number"
                          value={unit.size === '' ? '' : unit.size}
                          onChange={e => updateUnit(index, 'size', e.target.value || '')}
                          className="mt-1"
                          disabled={isSubmitting}
                        />
                      </div>

                      {/* Status */}
                      <div>
                        <label className="text-sm font-medium">Status</label>
                        <Select
                          value={unit.status}
                          onValueChange={(value) => updateUnit(index, 'status', value)}
                        >
                          <SelectTrigger className="mt-1">
                            <SelectValue placeholder="Bitte wählen..." />
                          </SelectTrigger>
                          <SelectContent>
                            {UNIT_STATUS.map((status) => (
                              <SelectItem key={status} value={status}>
                                {status}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Miete - nur anzeigen wenn Status "besetzt" ist */}
                      {unit.status === 'besetzt' && (
                        <div>
                          <label className="text-sm font-medium">Monatliche Miete (€)</label>
                          <Input
                            type="number"
                            value={unit.rent === '' ? '' : unit.rent}
                            onChange={e => updateUnit(index, 'rent', e.target.value || '')}
                            className="mt-1"
                            disabled={isSubmitting}
                          />
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Formular-Buttons */}
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


# backend/package.json

```json
{
  "name": "backend",
  "version": "1.0.0",
  "main": "index.js",
  "scripts": {
    "start": "ts-node src/index.ts",
    "dev": "nodemon src/index.ts",
    "build": "tsc",
    "test": "echo \"Error: no test specified\" && exit 1"
  },
  "keywords": [],
  "author": "",
  "license": "ISC",
  "description": "",
  "dependencies": {
    "cors": "^2.8.5",
    "pg": "^8.13.1"
  },
  "devDependencies": {
    "@types/cors": "^2.8.17",
    "@types/express": "^5.0.0",
    "@types/node": "^20.10.5",
    "@types/pg": "^8.11.10",
    "express": "^4.21.2",
    "ts-node": "^10.9.2",
    "typescript": "^5.7.2"
  }
}

```

# backend/src/index.ts

```ts
import express, { RequestHandler } from 'express';
import cors from 'cors';
import { Pool } from 'pg';

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Datenbank-Verbindung
const db = new Pool({
  user: 'postgres',
  password: 'Avintuk178_7!',
  host: 'localhost',
  port: 5432,
  database: 'immo-db'
});

console.log('Versuche Datenbankverbindung aufzubauen...');
db.connect().then(() => {
  console.log('Datenbankverbindung erfolgreich!');
}).catch(err => {
  console.error('Fehler bei Datenbankverbindung:', err);
});

// GET alle Properties mit Units
const getAllProperties: RequestHandler = async (_req, res) => {
  try {
    // Properties laden
    const propertiesResult = await db.query('SELECT * FROM properties');
    
    // Für jede Property die Units laden
    const properties = await Promise.all(
      propertiesResult.rows.map(async (property) => {
        const unitsResult = await db.query(
          'SELECT * FROM units WHERE property_id = $1',
          [property.id]
        );
        return {
          ...property,
          units: unitsResult.rows
        };
      })
    );
    
    res.json(properties);
  } catch (error) {
    console.error('Datenbankfehler:', error);
    res.status(500).json({ error: 'Datenbankfehler' });
  }
};

// POST neue Property mit Units
const createProperty: RequestHandler = async (req, res) => {
  const client = await db.connect();
  
  try {
    const { address, size, price, status, property_type, units } = req.body;

    await client.query('BEGIN');
    
    // Property erstellen
    const propertyResult = await client.query(
      `INSERT INTO properties (address, size, price, status, property_type)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [address, size, price, status, property_type]  // property_type als 5. Parameter
    );

    const propertyId = propertyResult.rows[0].id;

    // Units erstellen falls vorhanden
    const unitPromises = units?.map((unit: any) =>
      client.query(
        `INSERT INTO units (property_id, name, type, size, status, rent)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [propertyId, unit.name, unit.type, unit.size, unit.status, unit.rent]
      )
    ) || [];

    const unitsResults = await Promise.all(unitPromises);
    
    await client.query('COMMIT');

    // Response zusammenbauen
    const response = {
      ...propertyResult.rows[0],
      units: unitsResults.map(result => result.rows[0])
    };
    
    res.status(201).json(response);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Fehler beim Erstellen:', error);
    res.status(500).json({ error: 'Fehler beim Erstellen' });
  } finally {
    client.release();
  }
};

// GET einzelne Property mit Units
const getPropertyById: RequestHandler = async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    
    if (isNaN(id)) {
      res.status(400).json({ error: 'Ungültige ID' });
      return;
    }

    // Property laden
    const propertyResult = await db.query(
      'SELECT * FROM properties WHERE id = $1',
      [id]
    );
    
    if (propertyResult.rows.length === 0) {
      res.status(404).json({ error: 'Immobilie nicht gefunden' });
      return;
    }

    // Units für diese Property laden
    const unitsResult = await db.query(
      'SELECT * FROM units WHERE property_id = $1',
      [id]
    );
    
    // Property und Units zusammenführen
    const property = {
      ...propertyResult.rows[0],
      units: unitsResult.rows
    };
    
    res.json(property);
  } catch (error) {
    console.error('Datenbankfehler:', error);
    res.status(500).json({ error: 'Datenbankfehler' });
  }
};

// PUT/Update Property mit Units
const updateProperty: RequestHandler = async (req, res) => {
  const client = await db.connect();
  
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      res.status(400).json({ error: 'Ungültige ID' });
      return;
    }

    await client.query('BEGIN');

    const { address, size, price, status, property_type, units } = req.body;
    
    // Update property
    const propertyResult = await client.query(
      `UPDATE properties 
       SET address = $1, size = $2, price = $3, status = $4, property_type = $5
       WHERE id = $6 
       RETURNING *`,
      [address, size, price, status, property_type, id]  // property_type als 5. Parameter
    );
    
    if (propertyResult.rows.length === 0) {
      await client.query('ROLLBACK');
      res.status(404).json({ error: 'Immobilie nicht gefunden' });
      return;
    }

    // Bestehende units löschen
    await client.query('DELETE FROM units WHERE property_id = $1', [id]);

    // Neue units einfügen
    const unitPromises = units.map((unit: any) =>
      client.query(
        `INSERT INTO units (property_id, name, type, size, status, rent)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [id, unit.name, unit.type, unit.size, unit.status, unit.rent]
      )
    );

    const unitsResults = await Promise.all(unitPromises);
    
    await client.query('COMMIT');

    // Response zusammenbauen
    const response = {
      ...propertyResult.rows[0],
      units: unitsResults.map(result => result.rows[0])
    };
    
    res.json(response);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Fehler beim Update:', error);
    res.status(500).json({ error: 'Fehler beim Aktualisieren' });
  } finally {
    client.release();
  }
};

// DELETE Property (und zugehörige Units durch ON DELETE CASCADE)
const deleteProperty: RequestHandler = async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      res.status(400).json({ error: 'Ungültige ID' });
      return;
    }

    const result = await db.query('DELETE FROM properties WHERE id = $1 RETURNING *', [id]);
    
    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Immobilie nicht gefunden' });
      return;
    }
    
    res.json({ message: 'Immobilie erfolgreich gelöscht' });
  } catch (error) {
    console.error('Fehler beim Löschen:', error);
    res.status(500).json({ error: 'Fehler beim Löschen' });
  }
};

// Routen registrieren
app.get('/properties', getAllProperties);
app.post('/properties', createProperty);
app.get('/properties/:id', getPropertyById);
app.put('/properties/:id', updateProperty);
app.delete('/properties/:id', deleteProperty);

// Server starten
const PORT = 3001;
app.listen(PORT, () => {
  console.log(`Server läuft auf Port ${PORT}`);
});
```

# backend/tsconfig.json

```json
{
  "compilerOptions": {
    "target": "es6",
    "module": "commonjs",
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": ["src/**/*"]
}
```

# frontend/.gitignore

```
# Logs
logs
*.log
npm-debug.log*
yarn-debug.log*
yarn-error.log*
pnpm-debug.log*
lerna-debug.log*

node_modules
dist
dist-ssr
*.local

# Editor directories and files
.vscode/*
!.vscode/extensions.json
.idea
.DS_Store
*.suo
*.ntvs*
*.njsproj
*.sln
*.sw?

```

# frontend/components.json

```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "new-york",
  "rsc": false,
  "tsx": true,
  "tailwind": {
    "config": "tailwind.config.js",
    "css": "src/index.css",
    "baseColor": "neutral",
    "cssVariables": true,
    "prefix": ""
  },
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils",
    "ui": "@/components/ui",
    "lib": "@/lib",
    "hooks": "@/hooks"
  },
  "iconLibrary": "lucide"
}
```

# frontend/eslint.config.js

```js
import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  { ignores: ['dist'] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],
    },
  },
)

```

# frontend/index.html

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/vite.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Vite + React + TS</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>

```

# frontend/package.json

```json
{
  "name": "frontend",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "lint": "eslint .",
    "preview": "vite preview"
  },
  "dependencies": {
    "@radix-ui/react-select": "^2.1.4",
    "@radix-ui/react-slot": "^1.1.1",
    "@radix-ui/react-toast": "^1.2.4",
    "@shadcn/ui": "^0.0.4",
    "class-variance-authority": "^0.7.1",
    "clsx": "^2.1.1",
    "lucide-react": "^0.468.0",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-router-dom": "^7.0.2",
    "tailwind-merge": "^2.5.5",
    "tailwindcss-animate": "^1.0.7"
  },
  "devDependencies": {
    "@eslint/js": "^9.15.0",
    "@types/node": "^22.10.2",
    "@types/react": "^18.3.12",
    "@types/react-dom": "^18.3.1",
    "@vitejs/plugin-react": "^4.3.4",
    "autoprefixer": "^10.4.20",
    "eslint": "^9.15.0",
    "eslint-plugin-react-hooks": "^5.0.0",
    "eslint-plugin-react-refresh": "^0.4.14",
    "globals": "^15.12.0",
    "postcss": "^8.4.49",
    "tailwindcss": "^3.4.16",
    "typescript": "~5.6.2",
    "typescript-eslint": "^8.15.0",
    "vite": "^6.0.1"
  }
}

```

# frontend/postcss.config.js

```js
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}

```

# frontend/public/vite.svg

This is a file of the type: SVG Image

# frontend/README.md

```md
# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react/README.md) uses [Babel](https://babeljs.io/) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type aware lint rules:

- Configure the top-level `parserOptions` property like this:

\`\`\`js
export default tseslint.config({
  languageOptions: {
    // other options...
    parserOptions: {
      project: ['./tsconfig.node.json', './tsconfig.app.json'],
      tsconfigRootDir: import.meta.dirname,
    },
  },
})
\`\`\`

- Replace `tseslint.configs.recommended` to `tseslint.configs.recommendedTypeChecked` or `tseslint.configs.strictTypeChecked`
- Optionally add `...tseslint.configs.stylisticTypeChecked`
- Install [eslint-plugin-react](https://github.com/jsx-eslint/eslint-plugin-react) and update the config:

\`\`\`js
// eslint.config.js
import react from 'eslint-plugin-react'

export default tseslint.config({
  // Set the react version
  settings: { react: { version: '18.3' } },
  plugins: {
    // Add the react plugin
    react,
  },
  rules: {
    // other rules...
    // Enable its recommended rules
    ...react.configs.recommended.rules,
    ...react.configs['jsx-runtime'].rules,
  },
})
\`\`\`

```

# frontend/src/App.css

```css
#root {
  max-width: 1280px;
  margin: 0 auto;
  padding: 2rem;
  text-align: center;
}

.logo {
  height: 6em;
  padding: 1.5em;
  will-change: filter;
  transition: filter 300ms;
}
.logo:hover {
  filter: drop-shadow(0 0 2em #646cffaa);
}
.logo.react:hover {
  filter: drop-shadow(0 0 2em #61dafbaa);
}

@keyframes logo-spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

@media (prefers-reduced-motion: no-preference) {
  a:nth-of-type(2) .logo {
    animation: logo-spin infinite 20s linear;
  }
}

.card {
  padding: 2em;
}

.read-the-docs {
  color: #888;
}

```

# frontend/src/App.tsx

```tsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Sidebar from './components/Sidebar'
import PropertyList from './components/PropertyList'
import NewPropertyForm from './components/PropertyForm'
import EditPropertyForm from './components/EditPropertyForm'


function App() {
  return (
    <BrowserRouter>
    
        <Sidebar>
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<div className="text-lg">Dashboard (Coming Soon)</div>} />
            <Route path="/properties" element={<PropertyList />} />
            <Route path="/new" element={<NewPropertyForm />} />
            <Route path="/edit/:id" element={<EditPropertyForm />} />
            <Route path="/settings" element={<div className="text-lg">Einstellungen (Coming Soon)</div>} />
            </Routes>
        </Sidebar>
     
    </BrowserRouter>
  )
}

export default App
```

# frontend/src/assets/react.svg

This is a file of the type: SVG Image

# frontend/src/components/EditPropertyForm.tsx

```tsx
import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
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
import { propertyTypes } from '@/constants/PropertyTypes'


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
```

# frontend/src/components/PropertyForm.tsx

```tsx
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
```

# frontend/src/components/PropertyList.tsx

```tsx
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { PlusCircle, Pencil, Trash2, ChevronDown, ChevronUp } from 'lucide-react'

type Unit = {
  id: number
  name: string
  type: string
  size: number
  status: string
  rent: number
}

type Property = {
  id: number
  address: string
  size: number
  price: number
  status: string
  property_type: string
  units: Unit[]
}

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

  const toggleExpand = (propertyId: number) => {
    setExpandedProperty(expandedProperty === propertyId ? null : propertyId)
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Möchten Sie diese Immobilie wirklich löschen?')) return

    setIsDeleting(id)
    try {
      const response = await fetch(`http://localhost:3001/properties/${id}`, {
        method: 'DELETE'
      })

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
            <p className="text-muted-foreground mb-4">Keine Immobilien vorhanden</p>
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
                      onClick={() => navigate(`/edit/${property.id}`)}
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
                <div className="mb-4">
                  <p className="text-sm text-gray-500">Art der Immobilie</p>
                  <p>{property.property_type || 'Keine Angabe'}</p>
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
                              <p className="text-xs text-gray-500">Miete</p>
                              <p className="text-sm">{unit.rent} €</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

```

# frontend/src/components/Sidebar.tsx

```tsx
import { useState } from 'react'
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { ChevronRight, HomeIcon, Building2, Settings, Menu } from "lucide-react"
import { Link, useLocation } from 'react-router-dom'

interface SidebarProps {
  children: React.ReactNode
}

const Sidebar = ({ children }: SidebarProps) => {
  const [collapsed, setCollapsed] = useState(false)
  const location = useLocation()

  const navigationItems = [
    {
      title: "Dashboard",
      icon: <HomeIcon />,
      href: "/dashboard"
    },
    {
      title: "Immobilien",
      icon: <Building2 />,
      href: "/properties"
    },
    {
      title: "Einstellungen",
      icon: <Settings />,
      href: "/settings"
    }
  ]

  return (
    <div className="flex min-h-screen">
      <div
        className={cn(
          "h-screen fixed top-0 left-0 bg-gray-900 text-white flex flex-col transition-all duration-300",
          collapsed ? "w-16" : "w-64"
        )}
      >
        <div className="flex items-center justify-between p-4 border-b border-gray-800">
          {!collapsed && <span className="text-xl font-bold">Immo-App</span>}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setCollapsed(!collapsed)}
            className="hover:bg-gray-800"
          >
            {collapsed ? <Menu className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </Button>
        </div>

        <nav className="flex-1 p-4">
          <ul className="space-y-2">
            {navigationItems.map((item) => (
              <li key={item.href}>
                <Link
                  to={item.href}
                  className={cn(
                    "flex items-center space-x-2 p-2 rounded-lg transition-colors",
                    "hover:bg-gray-800",
                    location.pathname === item.href ? "bg-gray-800" : "",
                    collapsed ? "justify-center" : ""
                  )}
                >
                  {item.icon}
                  {!collapsed && <span>{item.title}</span>}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>

      <main 
        className={cn(
          "flex-1 transition-all duration-300",
          collapsed ? "ml-16" : "ml-64"
        )}
      >
        <div className="p-8">
          {children}
        </div>
      </main>
    </div>
  )
}

export default Sidebar
```

# frontend/src/components/ui/button.tsx

```tsx
import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow hover:bg-primary/90",
        destructive:
          "bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90",
        outline:
          "border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground",
        secondary:
          "bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 rounded-md px-3 text-xs",
        lg: "h-10 rounded-md px-8",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }

```

# frontend/src/components/ui/card.tsx

```tsx
import * as React from "react"

import { cn } from "@/lib/utils"

const Card = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "rounded-xl border bg-card text-card-foreground shadow",
      className
    )}
    {...props}
  />
))
Card.displayName = "Card"

const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex flex-col space-y-1.5 p-6", className)}
    {...props}
  />
))
CardHeader.displayName = "CardHeader"

const CardTitle = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("font-semibold leading-none tracking-tight", className)}
    {...props}
  />
))
CardTitle.displayName = "CardTitle"

const CardDescription = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
))
CardDescription.displayName = "CardDescription"

const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("p-6 pt-0", className)} {...props} />
))
CardContent.displayName = "CardContent"

const CardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex items-center p-6 pt-0", className)}
    {...props}
  />
))
CardFooter.displayName = "CardFooter"

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent }

```

# frontend/src/components/ui/input.tsx

```tsx
import * as React from "react"

import { cn } from "@/lib/utils"

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }

```

# frontend/src/components/ui/select.tsx

```tsx
// src/components/ui/select.tsx
import * as React from "react"
import * as SelectPrimitive from "@radix-ui/react-select"
import { Check, ChevronDown } from "lucide-react"

import { cn } from "@/lib/utils"

const Select = SelectPrimitive.Root

const SelectGroup = SelectPrimitive.Group

const SelectValue = SelectPrimitive.Value

const SelectTrigger = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Trigger>
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Trigger
    ref={ref}
    className={cn(
      "flex h-9 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
      className
    )}
    {...props}
  >
    {children}
    <SelectPrimitive.Icon asChild>
      <ChevronDown className="h-4 w-4 opacity-50" />
    </SelectPrimitive.Icon>
  </SelectPrimitive.Trigger>
))
SelectTrigger.displayName = SelectPrimitive.Trigger.displayName

const SelectContent = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Content>
>(({ className, children, position = "popper", ...props }, ref) => (
  <SelectPrimitive.Portal>
    <SelectPrimitive.Content
      ref={ref}
      className={cn(
        "relative z-50 min-w-[8rem] overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
        position === "popper" &&
          "data-[side=bottom]:translate-y-1 data-[side=left]:-translate-x-1 data-[side=right]:translate-x-1 data-[side=top]:-translate-y-1",
        className
      )}
      position={position}
      {...props}
    >
      <SelectPrimitive.Viewport
        className={cn(
          "p-1",
          position === "popper" &&
            "h-[var(--radix-select-trigger-height)] w-full min-w-[var(--radix-select-trigger-width)]"
        )}
      >
        {children}
      </SelectPrimitive.Viewport>
    </SelectPrimitive.Content>
  </SelectPrimitive.Portal>
))
SelectContent.displayName = SelectPrimitive.Content.displayName

const SelectLabel = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Label>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Label>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.Label
    ref={ref}
    className={cn("px-2 py-1.5 text-sm font-semibold", className)}
    {...props}
  />
))
SelectLabel.displayName = SelectPrimitive.Label.displayName

const SelectItem = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Item>
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Item
    ref={ref}
    className={cn(
      "relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-2 pr-8 text-sm outline-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
      className
    )}
    {...props}
  >
    <span className="absolute right-2 flex h-3.5 w-3.5 items-center justify-center">
      <SelectPrimitive.ItemIndicator>
        <Check className="h-4 w-4" />
      </SelectPrimitive.ItemIndicator>
    </span>
    <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
  </SelectPrimitive.Item>
))
SelectItem.displayName = SelectPrimitive.Item.displayName

const SelectSeparator = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Separator>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Separator>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.Separator
    ref={ref}
    className={cn("-mx-1 my-1 h-px bg-muted", className)}
    {...props}
  />
))
SelectSeparator.displayName = SelectPrimitive.Separator.displayName

export {
  Select,
  SelectGroup,
  SelectValue,
  SelectTrigger,
  SelectContent,
  SelectLabel,
  SelectItem,
  SelectSeparator,
}
```

# frontend/src/constants/propertyTypes.ts

```ts
export const propertyTypes = [
    'Einfamilienhaus',
    'Mehrfamilienhaus', 
    'Eigentumswohnung',
    'Doppelhaushälfte',
    'Reihenhaus',
    'Villa'
  ] as const
```

# frontend/src/hooks/useForms.tsx

```tsx

```

# frontend/src/hooks/useProperties.tsx

```tsx
// hooks/useProperties.ts

import { useState, useCallback } from 'react'
import { Property, PropertyFormData } from '@/types/property'
import { propertyService } from '@/services/propertyService'

export function useProperties() {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [properties, setProperties] = useState<Property[]>([])

  const loadProperties = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const data = await propertyService.getAll()
      setProperties(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ein Fehler ist aufgetreten')
    } finally {
      setIsLoading(false)
    }
  }, [])

  const createProperty = async (data: PropertyFormData) => {
    setIsLoading(true)
    setError(null)
    try {
      const newProperty = await propertyService.create(data)
      setProperties(prev => [...prev, newProperty])
      return newProperty
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ein Fehler ist aufgetreten')
      throw err
    } finally {
      setIsLoading(false)
    }
  }

  const updateProperty = async (id: string, data: PropertyFormData) => {
    setIsLoading(true)
    setError(null)
    try {
      const updatedProperty = await propertyService.update(id, data)
      setProperties(prev => prev.map(p => p.id === Number(id) ? updatedProperty : p))
      return updatedProperty
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ein Fehler ist aufgetreten')
      throw err
    } finally {
      setIsLoading(false)
    }
  }

  const deleteProperty = async (id: number) => {
    setIsLoading(true)
    setError(null)
    try {
      await propertyService.delete(id)
      setProperties(prev => prev.filter(p => p.id !== id))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ein Fehler ist aufgetreten')
      throw err
    } finally {
      setIsLoading(false)
    }
  }

  return {
    properties,
    isLoading,
    error,
    loadProperties,
    createProperty,
    updateProperty,
    deleteProperty
  }
}
```

# frontend/src/index.css

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {


  :root {
    --background: 0 0% 100%;
    --foreground: 0 0% 3.9%;
    --card: 0 0% 100%;
    --card-foreground: 0 0% 3.9%;
    --popover: 0 0% 100%;
    --popover-foreground: 0 0% 3.9%;
    --primary: 0 0% 9%;
    --primary-foreground: 0 0% 98%;
    --secondary: 0 0% 96.1%;
    --secondary-foreground: 0 0% 9%;
    --muted: 0 0% 96.1%;
    --muted-foreground: 0 0% 45.1%;
    --accent: 0 0% 96.1%;
    --accent-foreground: 0 0% 9%;
    --destructive: 0 84.2% 60.2%;
    --destructive-foreground: 0 0% 98%;
    --border: 0 0% 89.8%;
    --input: 0 0% 89.8%;
    --ring: 0 0% 3.9%;
    --chart-1: 12 76% 61%;
    --chart-2: 173 58% 39%;
    --chart-3: 197 37% 24%;
    --chart-4: 43 74% 66%;
    --chart-5: 27 87% 67%;
    --radius: 0.5rem
  }
  .dark {
    --background: 0 0% 3.9%;
    --foreground: 0 0% 98%;
    --card: 0 0% 3.9%;
    --card-foreground: 0 0% 98%;
    --popover: 0 0% 3.9%;
    --popover-foreground: 0 0% 98%;
    --primary: 0 0% 98%;
    --primary-foreground: 0 0% 9%;
    --secondary: 0 0% 14.9%;
    --secondary-foreground: 0 0% 98%;
    --muted: 0 0% 14.9%;
    --muted-foreground: 0 0% 63.9%;
    --accent: 0 0% 14.9%;
    --accent-foreground: 0 0% 98%;
    --destructive: 0 62.8% 30.6%;
    --destructive-foreground: 0 0% 98%;
    --border: 0 0% 14.9%;
    --input: 0 0% 14.9%;
    --ring: 0 0% 83.1%;
    --chart-1: 220 70% 50%;
    --chart-2: 160 60% 45%;
    --chart-3: 30 80% 55%;
    --chart-4: 280 65% 60%;
    --chart-5: 340 75% 55%
  }
}
@layer base {
  * {
    @apply border-border;
  }
  body {
    @apply bg-background text-foreground;
  }
}

```

# frontend/src/lib/utils.ts

```ts
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

```

# frontend/src/main.tsx

```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

```

# frontend/src/services/propertyService.ts

```ts
// services/propertyService.ts

import { Property, PropertyFormData } from '@/types/property'

const API_URL = 'http://localhost:3001/properties'

export const propertyService = {
  // Alle Properties laden
  async getAll(): Promise<Property[]> {
    const response = await fetch(API_URL)
    if (!response.ok) throw new Error('Failed to fetch properties')
    return response.json()
  },

  // Eine Property laden
  async getById(id: string): Promise<Property> {
    const response = await fetch(`${API_URL}/${id}`)
    if (!response.ok) throw new Error('Failed to fetch property')
    return response.json()
  },

  // Neue Property erstellen
  async create(data: PropertyFormData): Promise<Property> {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })
    if (!response.ok) throw new Error('Failed to create property')
    return response.json()
  },

  // Property aktualisieren
  async update(id: string, data: PropertyFormData): Promise<Property> {
    const response = await fetch(`${API_URL}/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })
    if (!response.ok) throw new Error('Failed to update property')
    return response.json()
  },

  // Property löschen
  async delete(id: number): Promise<void> {
    const response = await fetch(`${API_URL}/${id}`, {
      method: 'DELETE'
    })
    if (!response.ok) throw new Error('Failed to delete property')
  }
}
```

# frontend/src/types/property.ts

```ts
// types/property.ts

export interface Unit {
    id?: number
    name: string
    type: string
    size: number
    status: string
    rent: number
  }
  
  export interface Property {
    id?: number
    address: string
    size: number
    price: number
    status: string
    units?: Unit[]
  }
  
  export interface PropertyFormData extends Omit<Property, 'id'> {
    units?: Omit<Unit, 'id'>[]
  }
```

# frontend/src/vite-env.d.ts

```ts
/// <reference types="vite/client" />

```

# frontend/tailwind.config.js

```js
/** @type {import('tailwindcss').Config} */
export default {
    darkMode: ["class"],
    content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
  	extend: {
  		borderRadius: {
  			lg: 'var(--radius)',
  			md: 'calc(var(--radius) - 2px)',
  			sm: 'calc(var(--radius) - 4px)'
  		},
  		colors: {
  			background: 'hsl(var(--background))',
  			foreground: 'hsl(var(--foreground))',
  			card: {
  				DEFAULT: 'hsl(var(--card))',
  				foreground: 'hsl(var(--card-foreground))'
  			},
  			popover: {
  				DEFAULT: 'hsl(var(--popover))',
  				foreground: 'hsl(var(--popover-foreground))'
  			},
  			primary: {
  				DEFAULT: 'hsl(var(--primary))',
  				foreground: 'hsl(var(--primary-foreground))'
  			},
  			secondary: {
  				DEFAULT: 'hsl(var(--secondary))',
  				foreground: 'hsl(var(--secondary-foreground))'
  			},
  			muted: {
  				DEFAULT: 'hsl(var(--muted))',
  				foreground: 'hsl(var(--muted-foreground))'
  			},
  			accent: {
  				DEFAULT: 'hsl(var(--accent))',
  				foreground: 'hsl(var(--accent-foreground))'
  			},
  			destructive: {
  				DEFAULT: 'hsl(var(--destructive))',
  				foreground: 'hsl(var(--destructive-foreground))'
  			},
  			border: 'hsl(var(--border))',
  			input: 'hsl(var(--input))',
  			ring: 'hsl(var(--ring))',
  			chart: {
  				'1': 'hsl(var(--chart-1))',
  				'2': 'hsl(var(--chart-2))',
  				'3': 'hsl(var(--chart-3))',
  				'4': 'hsl(var(--chart-4))',
  				'5': 'hsl(var(--chart-5))'
  			}
  		}
  	}
  },
  plugins: [require("tailwindcss-animate")],
}


```

# frontend/tsconfig.app.json

```json
{
  "compilerOptions": {
    "incremental": true,
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": [
      "ES2020",
      "DOM",
      "DOM.Iterable"
    ],
    "module": "ESNext",
    "skipLibCheck": true,
    /* Bundler mode */
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "isolatedModules": true,
    "moduleDetection": "force",
    "noEmit": true,
    "jsx": "react-jsx",
    /* Linting */
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "baseUrl": ".",
    "paths": {
      "@/*": [
        "./src/*"
      ]
    }
  },
  "include": [
    "src"
  ]
}
```

# frontend/tsconfig.json

```json
{
  "files": [],
  "references": [
    {
      "path": "./tsconfig.app.json"
    },
    {
      "path": "./tsconfig.node.json"
    }
  ],
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}

```

# frontend/tsconfig.node.json

```json
{
  "compilerOptions": {
    "incremental": true,
    "tsBuildInfoFile": "./node_modules/.tmp/tsconfig.node.tsbuildinfo",
    "target": "ES2022",
    "lib": ["ES2023"],
    "module": "ESNext",
    "skipLibCheck": true,
    /* Bundler mode */
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "isolatedModules": true,
    "moduleDetection": "force",
    "noEmit": true,
    /* Linting */
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["vite.config.ts"]
}

```

# frontend/vite.config.ts

```ts
import path from "path"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
})

```

# README.md

```md
# Immo-App

```


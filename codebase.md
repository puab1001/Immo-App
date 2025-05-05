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
    "dotenv": "^16.3.1",
    "multer": "^1.4.5-lts.1",
    "pg": "^8.13.1"
  },
  "devDependencies": {
    "@types/cors": "^2.8.17",
    "@types/express": "^5.0.0",
    "@types/multer": "^1.4.12",
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
// backend/src/index.ts
import express from 'express';
import cors from 'cors';
import { Pool } from 'pg';
import { createPropertyRoutes } from './routes/properties';
import { createTenantRoutes } from './routes/tenants';
import { createDocumentRoutes } from './routes/documents';
import { createWorkerRoutes } from './routes/workers';
import dotenv from 'dotenv';

// Lade Umgebungsvariablen
dotenv.config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Datenbank-Verbindung
const db = new Pool({
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME
});

console.log('Versuche Datenbankverbindung aufzubauen...');
db.connect().then(() => {
  console.log('Datenbankverbindung erfolgreich!');
}).catch(err => {
  console.error('Fehler bei Datenbankverbindung:', err);
});

// Routes registrieren
app.use('/properties', createPropertyRoutes(db));
app.use('/tenants', createTenantRoutes(db));
app.use('/documents', createDocumentRoutes(db));
app.use('/workers', createWorkerRoutes(db));

// Typdefinitionen für Dashboard-Statistiken
interface VacantUnit {
  id: number;
  name: string;
  property_address: string;
  type: string;
  size: number;
}

interface DashboardStats {
  total_properties: number;
  total_units: number;
  monthly_rent: number;
  vacant_units: VacantUnit[];
  active_workers: number;
}

// Typdefinitionen für Diagnose
interface DiagnosticResults {
  server: {
    status: string;
    timestamp: string;
    environment: string;
  };
  database: {
    status: string;
    connected: boolean;
    tables: Record<string, number>;
    error: string | null;
  };
}

// Dashboard Statistiken Endpunkt
app.get('/dashboard/stats', (_req, res) => {
  (async () => {
    try {
      console.log('Dashboard stats endpoint called');
      
      // Einfachere Queries mit klarem Fehlerhandling
      const stats: DashboardStats = {
        total_properties: 0,
        total_units: 0,
        monthly_rent: 0,
        vacant_units: [],
        active_workers: 0
      };

      let dbConnected = false;
      
      try {
        // Teste Datenbankverbindung zuerst
        await db.query('SELECT NOW()');
        dbConnected = true;
        console.log('Database connection for dashboard is OK');
      } catch (connErr) {
        console.error('Datenbankverbindungsfehler bei Dashboard:', connErr);
        // Sende Statistiken mit Standardwerten zurück, aber log den Fehler
        return res.json(stats);
      }

      if (!dbConnected) {
        return res.json(stats);
      }

      // Gesamtanzahl Immobilien - mit explizitem Error Handling
      try {
        const propertiesResult = await db.query('SELECT COUNT(*) as count FROM properties');
        stats.total_properties = parseInt(propertiesResult.rows[0].count) || 0;
        console.log('Properties count:', stats.total_properties);
      } catch (err) {
        console.error('Fehler beim Zählen der Immobilien:', err);
        // Wir setzen fort mit Standardwert 0
      }
      
      // Gesamtanzahl Wohneinheiten
      try {
        const unitsResult = await db.query('SELECT COUNT(*) as count FROM units');
        stats.total_units = parseInt(unitsResult.rows[0].count) || 0;
        console.log('Units count:', stats.total_units);
      } catch (err) {
        console.error('Fehler beim Zählen der Wohneinheiten:', err);
      }
      
      // Monatliche Gesamtmiete - robust gegen NULL-Werte
      try {
        const rentResult = await db.query(
          'SELECT COALESCE(SUM(rent), 0) as total FROM units WHERE status = $1', 
          ['besetzt']
        );
        stats.monthly_rent = parseFloat(rentResult.rows[0].total) || 0;
        console.log('Monthly rent:', stats.monthly_rent);
      } catch (err) {
        console.error('Fehler beim Berechnen der Gesamtmiete:', err);
      }
      
      // Leerstehende Einheiten - Vereinfachte Abfrage
      try {
        const vacantResult = await db.query(`
          SELECT 
            u.id, 
            u.name, 
            u.type, 
            u.size, 
            p.address as property_address
          FROM units u
          JOIN properties p ON u.property_id = p.id
          WHERE u.status = $1
        `, ['verfügbar']);
        
        stats.vacant_units = vacantResult.rows.map(unit => ({
          id: unit.id,
          name: unit.name,
          property_address: unit.property_address,
          type: unit.type,
          size: unit.size
        }));
        console.log('Vacant units count:', stats.vacant_units.length);
      } catch (err) {
        console.error('Fehler beim Laden leerstehender Einheiten:', err);
      }
      
      // Aktive Handwerker
      try {
        const workersResult = await db.query(
          'SELECT COUNT(*) as count FROM workers WHERE active = true'
        );
        stats.active_workers = parseInt(workersResult.rows[0].count) || 0;
        console.log('Active workers count:', stats.active_workers);
      } catch (err) {
        console.error('Fehler beim Zählen aktiver Handwerker:', err);
      }

      // Log der Ergebnisse für Debugging
      console.log('Dashboard stats generated:', stats);
      
      // Erfolgreiche Antwort senden
      res.json(stats);
    } catch (error: any) {
      // Allgemeiner Fehlerfall
      console.error('Dashboard Statistiken Fehler:', error);
      res.status(500).json({ 
        error: 'Fehler beim Laden der Dashboard-Daten',
        message: error.message 
      });
    }
  })();
});

// Diagnose-Endpunkt
app.get('/api/diagnostic', async (_req, res) => {
  console.log('Diagnostic endpoint called');
  
  const diagnosticResults: DiagnosticResults = {
    server: {
      status: 'ok',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development'
    },
    database: {
      status: 'unknown',
      connected: false,
      tables: {},
      error: null
    }
  };
  
  try {
    // Teste Datenbankverbindung
    await db.query('SELECT NOW()');
    diagnosticResults.database.connected = true;
    diagnosticResults.database.status = 'ok';
    
    // Prüfe Tabellen und Datensätze
    try {
      const tablesCheck = {
        properties: await db.query('SELECT COUNT(*) as count FROM properties'),
        units: await db.query('SELECT COUNT(*) as count FROM units'),
        tenants: await db.query('SELECT COUNT(*) as count FROM tenants'),
        workers: await db.query('SELECT COUNT(*) as count FROM workers'),
        documents: await db.query('SELECT COUNT(*) as count FROM documents')
      };
      
      // Extrahiere Anzahl der Datensätze pro Tabelle
      diagnosticResults.database.tables = {
        properties: parseInt(tablesCheck.properties.rows[0].count) || 0,
        units: parseInt(tablesCheck.units.rows[0].count) || 0,
        tenants: parseInt(tablesCheck.tenants.rows[0].count) || 0,
        workers: parseInt(tablesCheck.workers.rows[0].count) || 0,
        documents: parseInt(tablesCheck.documents.rows[0].count) || 0
      };
    } catch (tableError: any) {
      diagnosticResults.database.status = 'partial';
      diagnosticResults.database.error = `Tabellenfehler: ${tableError.message}`;
    }
  } catch (dbError: any) {
    diagnosticResults.database.status = 'error';
    diagnosticResults.database.error = `Verbindungsfehler: ${dbError.message}`;
  }
  
  // Sende Diagnoseergebnisse zurück
  res.json(diagnosticResults);
});

// CORS-Konfigurationstest-Endpoint
app.get('/api/cors-test', (_req, res) => {
  res.json({ 
    status: 'ok',
    message: 'CORS ist korrekt konfiguriert',
    timestamp: new Date().toISOString()
  });
});

// Server starten
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server läuft auf Port ${PORT}`);
});
```

# backend/src/routes/documents.ts

```ts
// backend/src/routes/documents.ts (mit Preview-Endpunkt)
import express, { Request, Response } from 'express';
import multer from 'multer';
import { Pool } from 'pg';
import { DocumentService } from '../services/DocumentService';
import path from 'path';

const upload = multer({
 storage: multer.memoryStorage(),
 limits: {
   fileSize: 10 * 1024 * 1024, // 10MB limit
 }
});

export const createDocumentRoutes = (db: Pool) => {
 const router = express.Router();
 const documentService = new DocumentService(db);

 // GET: Kategorien abrufen - MUSS VOR DER /:id ROUTE STEHEN!
 router.get('/categories', (_req: Request, res: Response) => {
   (async () => {
     try {
       console.log('Categories request received');
       const result = await db.query('SELECT * FROM document_categories ORDER BY name');
       console.log('Categories query result:', result.rows);
       
       if (!result.rows) {
         console.error('No categories found');
         return res.status(404).json({ error: 'No categories found' });
       }
       
       res.json(result.rows);
     } catch (error) {
       console.error('Error loading categories:', error);
       res.status(500).json({ error: 'Error loading categories' });
     }
   })();
 });

 // GET: Alle Dokumente abrufen
 router.get('/', (req: Request, res: Response) => {
   (async () => {
     try {
       console.log('Fetching documents...');
       const filters: any = {};
       
       // Validiere tenantId
       if (req.query.tenantId) {
         const tenantId = parseInt(req.query.tenantId as string);
         if (!isNaN(tenantId)) {
           filters.tenantId = tenantId;
         }
       }
       
       // Validiere categoryId
       if (req.query.categoryId) {
         const categoryId = parseInt(req.query.categoryId as string);
         if (!isNaN(categoryId)) {
           filters.categoryId = categoryId;
         }
       }

       // Validiere isConfidential
       if (req.query.isConfidential) {
         filters.isConfidential = req.query.isConfidential === 'true';
       }

       // Validiere tags
       if (req.query.tags) {
         filters.tags = (req.query.tags as string).split(',');
       }

       const documents = await documentService.getDocuments(filters);
       console.log(`Found ${documents.length} documents`);
       res.json(documents);
     } catch (error) {
       console.error('Error fetching documents:', error);
       res.status(500).json({ error: 'Error fetching documents' });
     }
   })();
 });

 // GET: Einzelnes Dokument abrufen
 router.get('/:id', (req: Request, res: Response) => {
   (async () => {
     try {
       const id = parseInt(req.params.id);
       if (isNaN(id)) {
         return res.status(400).json({ error: 'Invalid document ID' });
       }

       const document = await documentService.getDocument(id);
       if (!document) {
         return res.status(404).json({ error: 'Document not found' });
       }

       res.json(document);
     } catch (error) {
       console.error('Error fetching document:', error);
       res.status(500).json({ error: 'Error fetching document' });
     }
   })();
 });

 // POST: Dokument hochladen
 router.post('/', upload.single('file'), (req: Request, res: Response) => {
   (async () => {
     try {
       if (!req.file) {
         return res.status(400).json({ error: 'No file uploaded' });
       }

       const categoryId = parseInt(req.body.categoryId);
       if (isNaN(categoryId)) {
         return res.status(400).json({ error: 'Invalid category ID' });
       }

       let tenantId: number | undefined = undefined;
       if (req.body.tenantId) {
         tenantId = parseInt(req.body.tenantId);
         if (isNaN(tenantId)) {
           return res.status(400).json({ error: 'Invalid tenant ID' });
         }
       }

       const documentId = await documentService.createDocument(req.file, {
         categoryId,
         tenantId,
         description: req.body.description,
         isConfidential: req.body.isConfidential === 'true',
         createdBy: req.body.createdBy || 'system',
         tags: req.body.tags ? JSON.parse(req.body.tags) : undefined
       });

       res.status(201).json({ id: documentId });
     } catch (error) {
       console.error('Error uploading document:', error);
       res.status(500).json({ error: 'Error uploading document' });
     }
   })();
 });

 // GET: Dokument-Vorschau
 router.get('/:id/preview', (req: Request, res: Response) => {
   (async () => {
     try {
       const id = parseInt(req.params.id);
       if (isNaN(id)) {
         return res.status(400).json({ error: 'Invalid document ID' });
       }

       const document = await documentService.getDocument(id, { withContent: true });
       if (!document) {
         return res.status(404).json({ error: 'Document not found' });
       }

       // Bei Bildern und PDFs können wir Vorschau als Original zurückgeben
       if (document.mime_type.startsWith('image/') || document.mime_type === 'application/pdf') {
         res.set({
           'Content-Type': document.mime_type,
           'Content-Length': document.content?.length,
         });
         
         res.send(document.content);
         return;
       }

       // Für andere Dateitypen eine generische Vorschau zurückgeben
       // Hier könnten Sie bei Bedarf Thumbnails für verschiedene Dateitypen generieren
       res.status(415).json({ error: 'No preview available for this file type' });
     } catch (error) {
       console.error('Error generating preview:', error);
       res.status(500).json({ error: 'Error generating document preview' });
     }
   })();
 });

 // GET: Dokument herunterladen
 router.get('/:id/download', (req: Request, res: Response) => {
   (async () => {
     try {
       const id = parseInt(req.params.id);
       if (isNaN(id)) {
         return res.status(400).json({ error: 'Invalid document ID' });
       }

       const document = await documentService.getDocument(id, { withContent: true });
       if (!document) {
         return res.status(404).json({ error: 'Document not found' });
       }

       res.set({
         'Content-Type': document.mime_type,
         'Content-Disposition': `attachment; filename="${document.original_filename}"`,
         'Content-Length': document.content?.length,
       });
       
       res.send(document.content);
     } catch (error) {
       console.error('Error downloading document:', error);
       res.status(500).json({ error: 'Error downloading document' });
     }
   })();
 });

 // DELETE: Dokument löschen
 router.delete('/:id', (req: Request, res: Response) => {
   (async () => {
     try {
       const id = parseInt(req.params.id);
       if (isNaN(id)) {
         return res.status(400).json({ error: 'Invalid document ID' });
       }

       await documentService.deleteDocument(id);
       res.json({ message: 'Document deleted successfully' });
     } catch (error) {
       console.error('Error deleting document:', error);
       res.status(500).json({ error: 'Error deleting document' });
     }
   })();
 });

 return router;
};
```

# backend/src/routes/properties.ts

```ts
import express, { Request, Response } from 'express';
import { Pool } from 'pg';

export const createPropertyRoutes = (db: Pool) => {
 const router = express.Router();

 // GET alle Properties mit Units
 router.get('/', (req: Request, res: Response) => {
   (async () => {
     try {
       // Properties mit Gesamtmiete laden
       console.log('Loading all properties...');
       const propertiesResult = await db.query(`
         SELECT 
           p.*,
           COALESCE(SUM(u.rent), 0) as total_rent
         FROM properties p
         LEFT JOIN units u ON u.property_id = p.id 
         GROUP BY p.id
       `);

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
       console.error('Database error:', error);
       res.status(500).json({ error: 'Datenbankfehler' });
     }
   })();
 });

 // GET einzelne Property mit Units
 router.get('/:id', (req: Request, res: Response) => {
   (async () => {
     try {
       console.log('Fetching property by ID:', req.params.id);
       
       const id = parseInt(req.params.id);
       if (isNaN(id)) {
         console.error('Invalid ID provided:', req.params.id);
         return res.status(400).json({ error: 'Ungültige ID' });
       }

       // Property laden
       const propertyResult = await db.query(
         'SELECT * FROM properties WHERE id = $1',
         [id]
       );

       console.log('Property query result:', propertyResult.rows);

       if (propertyResult.rows.length === 0) {
         console.error('No property found with ID:', id);
         return res.status(404).json({ error: 'Immobilie nicht gefunden' });
       }

       // Units für diese Property laden
       const unitsResult = await db.query(
         'SELECT * FROM units WHERE property_id = $1',
         [id]
       );

       console.log('Units query result:', unitsResult.rows);

       // Property und Units zusammenführen
       const property = {
         ...propertyResult.rows[0],
         units: unitsResult.rows
       };

       res.json(property);
     } catch (error) {
       console.error('Database error:', error);
       res.status(500).json({ error: 'Datenbankfehler' });
     }
   })();
 });

 // POST neue Property mit Units
 router.post('/', (req: Request, res: Response) => {
   (async () => {
     const client = await db.connect();

     try {
       const { address, property_type, units } = req.body;

       await client.query('BEGIN');

       // Property erstellen
       const propertyResult = await client.query(
         `INSERT INTO properties (address, property_type)
          VALUES ($1, $2)
          RETURNING *`,
         [address, property_type]
       );

       const propertyId = propertyResult.rows[0].id;

       // Units erstellen
       const unitPromises = units?.map((unit: any) =>
         client.query(
           `INSERT INTO units (property_id, name, type, size, status, rent)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING *`,
           [
             propertyId,
             unit.name,
             unit.type,
             unit.size || 0,
             unit.status,
             unit.status === 'besetzt' ? (unit.rent || 0) : 0
           ]
         )
       ) || [];

       const unitsResults = await Promise.all(unitPromises);

       await client.query('COMMIT');

       const response = {
         ...propertyResult.rows[0],
         units: unitsResults.map(result => result.rows[0])
       };

       res.status(201).json(response);
     } catch (error) {
       await client.query('ROLLBACK');
       console.error('Error creating property:', error);
       res.status(500).json({ error: 'Fehler beim Erstellen' });
     } finally {
       client.release();
     }
   })();
 });

 // PUT/Update Property mit Units
 router.put('/:id', (req: Request, res: Response) => {
   (async () => {
     const client = await db.connect();

     try {
       const id = parseInt(req.params.id);
       if (isNaN(id)) {
         res.status(400).json({ error: 'Ungültige ID' });
         return;
       }

       const { address, property_type, units } = req.body;

       await client.query('BEGIN');

       const propertyResult = await client.query(
         `UPDATE properties 
          SET address = $1, property_type = $2
          WHERE id = $3 
          RETURNING *`,
         [address, property_type, id]
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
           [
             id,
             unit.name,
             unit.type,
             unit.size || 0,
             unit.status,
             unit.status === 'besetzt' ? (unit.rent || 0) : 0
           ]
         )
       );

       const unitsResults = await Promise.all(unitPromises);

       await client.query('COMMIT');

       const response = {
         ...propertyResult.rows[0],
         units: unitsResults.map(result => result.rows[0])
       };

       res.json(response);
     } catch (error) {
       await client.query('ROLLBACK');
       console.error('Error updating property:', error);
       res.status(500).json({ error: 'Fehler beim Aktualisieren' });
     } finally {
       client.release();
     }
   })();
 });

 // DELETE Property (und zugehörige Units durch ON DELETE CASCADE)
 router.delete('/:id', (req: Request, res: Response) => {
   (async () => {
     try {
       const id = parseInt(req.params.id);
       if (isNaN(id)) {
         res.status(400).json({ error: 'Ungültige ID' });
         return;
       }

       const result = await db.query(
         'DELETE FROM properties WHERE id = $1 RETURNING *', 
         [id]
       );

       if (result.rows.length === 0) {
         res.status(404).json({ error: 'Immobilie nicht gefunden' });
         return;
       }

       res.json({ message: 'Immobilie erfolgreich gelöscht' });
     } catch (error) {
       console.error('Error deleting property:', error);
       res.status(500).json({ error: 'Fehler beim Löschen' });
     }
   })();
 });

 return router;
};
```

# backend/src/routes/tenants.ts

```ts
// backend/src/routes/tenants.ts
import express, { Request, Response } from 'express';
import { Pool } from 'pg';

export const createTenantRoutes = (db: Pool) => {
  const router = express.Router();

  // GET alle Mieter
  router.get('/', (req: Request, res: Response) => {
    (async () => {
      try {
        const result = await db.query(`
          SELECT 
            t.*,
            u.name AS unit_name,
            u.type AS unit_type,
            p.address AS property_address,
            p.property_type
          FROM tenants t
          LEFT JOIN units u ON t.unit_id = u.id
          LEFT JOIN properties p ON u.property_id = p.id
          ORDER BY t.last_name, t.first_name
        `);
        
        res.json(result.rows);
      } catch (error) {
        console.error('Fehler beim Laden der Mieter:', error);
        res.status(500).json({ error: 'Datenbankfehler' });
      }
    })();
  });

  // GET einzelnen Mieter - NEU HINZUGEFÜGT
  router.get('/:id', (req: Request, res: Response) => {
    (async () => {
      try {
        const id = parseInt(req.params.id);
        if (isNaN(id)) {
          return res.status(400).json({ error: 'Ungültige ID' });
        }

        const result = await db.query(`
          SELECT 
            t.*,
            u.name AS unit_name,
            u.type AS unit_type,
            p.address AS property_address,
            p.property_type
          FROM tenants t
          LEFT JOIN units u ON t.unit_id = u.id
          LEFT JOIN properties p ON u.property_id = p.id
          WHERE t.id = $1
        `, [id]);

        if (result.rows.length === 0) {
          return res.status(404).json({ error: 'Mieter nicht gefunden' });
        }

        res.json(result.rows[0]);
      } catch (error) {
        console.error('Fehler beim Laden des Mieters:', error);
        res.status(500).json({ error: 'Datenbankfehler' });
      }
    })();
  });

  // POST neuen Mieter erstellen
  router.post('/', (req: Request, res: Response) => {
    (async () => {
      const client = await db.connect();
      
      try {
        const {
          first_name,
          last_name,
          email,
          phone,
          address,
          unit_id,
          rent_start_date
        } = req.body;

        await client.query('BEGIN');

        // Prüfen ob die Unit bereits einen aktiven Mieter hat
        if (unit_id) {
          const existingTenant = await client.query(
            'SELECT id FROM tenants WHERE unit_id = $1 AND active = true',
            [unit_id]
          );
          
          if (existingTenant.rows.length > 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({ 
              error: 'Diese Wohneinheit hat bereits einen aktiven Mieter' 
            });
          }
        }

        const result = await client.query(
          `INSERT INTO tenants (
            first_name, last_name, email, phone, address, 
            unit_id, rent_start_date, active
          ) 
          VALUES ($1, $2, $3, $4, $5, $6, $7, true)
          RETURNING *`,
          [first_name, last_name, email, phone, address, unit_id, rent_start_date]
        );

        if (unit_id) {
          await client.query(
            'UPDATE units SET status = $1 WHERE id = $2',
            ['besetzt', unit_id]
          );
        }

        await client.query('COMMIT');
        res.status(201).json(result.rows[0]);

      } catch (error) {
        await client.query('ROLLBACK');
        console.error('Fehler beim Erstellen des Mieters:', error);
        res.status(500).json({ error: 'Datenbankfehler' });
      } finally {
        client.release();
      }
    })();
  });

  // PUT Mieter aktualisieren
  router.put('/:id', (req: Request, res: Response) => {
    (async () => {
      const client = await db.connect();
      
      try {
        const id = parseInt(req.params.id);
        const {
          first_name,
          last_name,
          email,
          phone,
          address,
          unit_id,
          rent_start_date,
          rent_end_date,
          active
        } = req.body;

        await client.query('BEGIN');

        // Bestehende Unit-ID laden
        const currentTenant = await client.query(
          'SELECT unit_id FROM tenants WHERE id = $1',
          [id]
        );

        if (currentTenant.rows.length === 0) {
          await client.query('ROLLBACK');
          return res.status(404).json({ error: 'Mieter nicht gefunden' });
        }

        const oldUnitId = currentTenant.rows[0].unit_id;

        // Wenn neue Unit-ID angegeben und diese sich von der alten unterscheidet
        if (unit_id && unit_id !== oldUnitId) {
          const existingTenant = await client.query(
            'SELECT id FROM tenants WHERE unit_id = $1 AND active = true AND id != $2',
            [unit_id, id]
          );
          
          if (existingTenant.rows.length > 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({ 
              error: 'Diese Wohneinheit hat bereits einen aktiven Mieter' 
            });
          }
        }

        // Mieter aktualisieren
        const result = await client.query(
          `UPDATE tenants 
           SET first_name = $1, last_name = $2, email = $3, phone = $4,
               address = $5, unit_id = $6, rent_start_date = $7,
               rent_end_date = $8, active = $9
           WHERE id = $10 
           RETURNING *`,
          [first_name, last_name, email, phone, address, unit_id,
           rent_start_date, rent_end_date, active, id]
        );

        // Alte Unit auf verfügbar setzen, wenn sich die Unit geändert hat
        // oder der Mieter nicht mehr aktiv ist
        if (oldUnitId && (oldUnitId !== unit_id || !active)) {
          await client.query(
            'UPDATE units SET status = $1 WHERE id = $2',
            ['verfügbar', oldUnitId]
          );
        }

        // Neue Unit auf besetzt setzen
        if (unit_id && active) {
          await client.query(
            'UPDATE units SET status = $1 WHERE id = $2',
            ['besetzt', unit_id]
          );
        }

        await client.query('COMMIT');
        res.json(result.rows[0]);
      } catch (error) {
        await client.query('ROLLBACK');
        console.error('Fehler beim Update:', error);
        res.status(500).json({ error: 'Datenbankfehler' });
      } finally {
        client.release();
      }
    })();
  });

  return router;
};
```

# backend/src/routes/workers.ts

```ts
// backend/src/routes/workers.ts
import express, { Request, Response } from 'express';
import { Pool } from 'pg';

export const createWorkerRoutes = (db: Pool) => {
  const router = express.Router();

  // GET alle Handwerker mit ihren Fähigkeiten
  router.get('/', (_req: Request, res: Response) => {
    (async () => {
      try {
        const result = await db.query(`
          SELECT 
            w.*,
            json_agg(json_build_object(
              'id', s.id,
              'name', s.name,
              'experience_years', ws.experience_years
            )) as skills
          FROM workers w
          LEFT JOIN worker_skills ws ON w.id = ws.worker_id
          LEFT JOIN skills s ON ws.skill_id = s.id
          WHERE w.active = true
          GROUP BY w.id
          ORDER BY w.last_name, w.first_name
        `);
        
        res.json(result.rows);
      } catch (error) {
        console.error('Fehler beim Laden der Handwerker:', error);
        res.status(500).json({ error: 'Datenbankfehler' });
      }
    })();
  });

  // GET alle verfügbaren Fähigkeiten
  router.get('/skills', (_req: Request, res: Response) => {
    (async () => {
      try {
        const result = await db.query('SELECT * FROM skills ORDER BY name');
        res.json(result.rows);
      } catch (error) {
        console.error('Fehler beim Laden der Fähigkeiten:', error);
        res.status(500).json({ error: 'Datenbankfehler' });
      }
    })();
  });

  // POST neuen Handwerker erstellen
  router.post('/', (req: Request, res: Response) => {
    (async () => {
      const client = await db.connect();
      
      try {
        const {
          first_name,
          last_name,
          phone,
          email,
          hourly_rate,
          skills
        } = req.body;

        await client.query('BEGIN');

        // Handwerker erstellen
        const workerResult = await client.query(`
          INSERT INTO workers (first_name, last_name, phone, email, hourly_rate)
          VALUES ($1, $2, $3, $4, $5)
          RETURNING *
        `, [first_name, last_name, phone, email, hourly_rate]);

        const workerId = workerResult.rows[0].id;

        // Fähigkeiten zuweisen
        if (skills && skills.length > 0) {
          for (const skill of skills) {
            await client.query(`
              INSERT INTO worker_skills (worker_id, skill_id, experience_years)
              VALUES ($1, $2, $3)
            `, [workerId, skill.id, skill.experience_years]);
          }
        }

        await client.query('COMMIT');
        res.status(201).json(workerResult.rows[0]);
      } catch (error) {
        await client.query('ROLLBACK');
        console.error('Fehler beim Erstellen des Handwerkers:', error);
        res.status(500).json({ error: 'Datenbankfehler' });
      } finally {
        client.release();
      }
    })();
  });

  // PUT Handwerker aktualisieren
  router.put('/:id', (req: Request, res: Response) => {
    (async () => {
      const client = await db.connect();
      
      try {
        const { id } = req.params;
        const {
          first_name,
          last_name,
          phone,
          email,
          hourly_rate,
          skills,
          active
        } = req.body;

        await client.query('BEGIN');

        // Handwerker aktualisieren
        const workerResult = await client.query(`
          UPDATE workers 
          SET first_name = $1, last_name = $2, phone = $3, 
              email = $4, hourly_rate = $5, active = $6,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = $7
          RETURNING *
        `, [first_name, last_name, phone, email, hourly_rate, active, id]);

        // Existierende Fähigkeiten löschen
        await client.query('DELETE FROM worker_skills WHERE worker_id = $1', [id]);

        // Neue Fähigkeiten zuweisen
        if (skills && skills.length > 0) {
          for (const skill of skills) {
            await client.query(`
              INSERT INTO worker_skills (worker_id, skill_id, experience_years)
              VALUES ($1, $2, $3)
            `, [id, skill.id, skill.experience_years]);
          }
        }

        await client.query('COMMIT');
        res.json(workerResult.rows[0]);
      } catch (error) {
        await client.query('ROLLBACK');
        console.error('Fehler beim Aktualisieren des Handwerkers:', error);
        res.status(500).json({ error: 'Datenbankfehler' });
      } finally {
        client.release();
      }
    })();
  });

  // DELETE Handwerker (soft delete)
  router.delete('/:id', (req: Request, res: Response) => {
    (async () => {
      try {
        const { id } = req.params;
        const result = await db.query(`
          UPDATE workers 
          SET active = false, updated_at = CURRENT_TIMESTAMP
          WHERE id = $1
          RETURNING *
        `, [id]);

        if (result.rows.length === 0) {
          return res.status(404).json({ error: 'Handwerker nicht gefunden' });
        }

        res.json({ message: 'Handwerker erfolgreich deaktiviert' });
      } catch (error) {
        console.error('Fehler beim Deaktivieren des Handwerkers:', error);
        res.status(500).json({ error: 'Datenbankfehler' });
      }
    })();
  });

  return router;
};
```

# backend/src/services/DocumentService.ts

```ts
// src/services/DocumentService.ts
import { Pool } from 'pg';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

export class DocumentService {
  private uploadDir: string;

  constructor(private db: Pool) {
    this.uploadDir = process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads');
  }

  async createDocument(file: Express.Multer.File, data: {
    categoryId: number;
    tenantId?: number;
    description?: string;
    isConfidential?: boolean;
    createdBy: string;
    tags?: string[];
  }) {
    const client = await this.db.connect();
    
    try {
      await client.query('BEGIN');
      
      // Generiere eindeutigen Dateinamen
      const fileHash = crypto.createHash('sha256')
        .update(file.originalname + Date.now())
        .digest('hex');
      const fileExt = path.extname(file.originalname);
      const filename = `${fileHash}${fileExt}`;
      
      // Speichere Datei
      const relativePath = path.join(
        data.tenantId ? `tenant_${data.tenantId}` : 'general',
        filename
      );
      const fullPath = path.join(this.uploadDir, relativePath);
      
      // Erstelle Verzeichnis falls nicht vorhanden
      await fs.mkdir(path.dirname(fullPath), { recursive: true });
      await fs.writeFile(fullPath, file.buffer);

      // Erstelle Dokument-Eintrag
      const docResult = await client.query(`
        INSERT INTO documents (
          filename,
          original_filename,
          mime_type,
          file_size,
          category_id,
          tenant_id,
          description,
          is_confidential,
          created_by,
          file_path
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING id
      `, [
        filename,
        file.originalname,
        file.mimetype,
        file.size,
        data.categoryId,
        data.tenantId || null,
        data.description || null,
        data.isConfidential || false,
        data.createdBy,
        relativePath
      ]);

      const documentId = docResult.rows[0].id;

      // Füge Tags hinzu wenn vorhanden
      if (data.tags && data.tags.length > 0) {
        for (const tagName of data.tags) {
          // Erstelle Tag falls nicht vorhanden
          const tagResult = await client.query(`
            INSERT INTO document_tags (name)
            VALUES ($1)
            ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
            RETURNING id
          `, [tagName]);

          // Verknüpfe Tag mit Dokument
          await client.query(`
            INSERT INTO document_tag_relations (document_id, tag_id)
            VALUES ($1, $2)
          `, [documentId, tagResult.rows[0].id]);
        }
      }

      // Setze Standard-Berechtigungen
      await client.query(`
        INSERT INTO document_permissions (document_id, role_type, can_view, can_edit, can_delete)
        VALUES
          ($1, 'admin', true, true, true),
          ($1, 'manager', true, true, false),
          ($1, 'tenant', $2, false, false)
      `, [documentId, !data.isConfidential]);

      await client.query('COMMIT');
      return documentId;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async getDocuments(filters: {
    tenantId?: number;
    categoryId?: number;
    isConfidential?: boolean;
    tags?: string[];
  }) {
    let query = `
      SELECT 
        d.*,
        c.name as category_name,
        array_agg(DISTINCT t.name) as tags,
        CASE 
          WHEN d.tenant_id IS NOT NULL THEN json_build_object(
            'id', ten.id,
            'first_name', ten.first_name,
            'last_name', ten.last_name
          )
          ELSE NULL
        END as tenant
      FROM documents d
      LEFT JOIN document_categories c ON d.category_id = c.id
      LEFT JOIN document_tag_relations dtr ON d.id = dtr.document_id
      LEFT JOIN document_tags t ON dtr.tag_id = t.id
      LEFT JOIN tenants ten ON d.tenant_id = ten.id
      WHERE 1=1
    `;

    const params: any[] = [];
    let paramCount = 1;

    if (filters.tenantId !== undefined) {
      query += ` AND (d.tenant_id = $${paramCount} OR d.tenant_id IS NULL)`;
      params.push(filters.tenantId);
      paramCount++;
    }

    if (filters.categoryId !== undefined) {
      query += ` AND d.category_id = $${paramCount}`;
      params.push(filters.categoryId);
      paramCount++;
    }

    if (filters.isConfidential !== undefined) {
      query += ` AND d.is_confidential = $${paramCount}`;
      params.push(filters.isConfidential);
      paramCount++;
    }

    if (filters.tags && filters.tags.length > 0) {
      query += ` AND t.name = ANY($${paramCount})`;
      params.push(filters.tags);
      paramCount++;
    }

    query += ` GROUP BY d.id, c.name, ten.id, ten.first_name, ten.last_name
               ORDER BY d.upload_date DESC`;

    const result = await this.db.query(query, params);
    return result.rows;
  }

  async getDocument(id: number, options: { withContent?: boolean } = {}) {
    const docResult = await this.db.query(`
      SELECT d.*, c.name as category_name
      FROM documents d
      LEFT JOIN document_categories c ON d.category_id = c.id
      WHERE d.id = $1
    `, [id]);

    if (docResult.rows.length === 0) {
      throw new Error('Dokument nicht gefunden');
    }

    const document = docResult.rows[0];

    if (options.withContent) {
      const fullPath = path.join(this.uploadDir, document.file_path);
      document.content = await fs.readFile(fullPath);
    }

    return document;
  }

  async deleteDocument(id: number) {
    const client = await this.db.connect();
    
    try {
      await client.query('BEGIN');

      // Hole Dokument-Informationen
      const docResult = await client.query(
        'SELECT file_path FROM documents WHERE id = $1',
        [id]
      );

      if (docResult.rows.length === 0) {
        throw new Error('Dokument nicht gefunden');
      }

      // Lösche Datei
      const fullPath = path.join(this.uploadDir, docResult.rows[0].file_path);
      await fs.unlink(fullPath);

      // Lösche Datenbankeinträge
      await client.query('DELETE FROM document_tag_relations WHERE document_id = $1', [id]);
      await client.query('DELETE FROM document_permissions WHERE document_id = $1', [id]);
      await client.query('DELETE FROM documents WHERE id = $1', [id]);

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async updateDocument(id: number, data: {
    categoryId?: number;
    description?: string;
    isConfidential?: boolean;
    tags?: string[];
  }) {
    const client = await this.db.connect();
    
    try {
      await client.query('BEGIN');

      // Update Hauptdokument
      const updates: string[] = [];
      const values: any[] = [id];
      let paramCount = 2;

      if (data.categoryId !== undefined) {
        updates.push(`category_id = $${paramCount++}`);
        values.push(data.categoryId);
      }

      if (data.description !== undefined) {
        updates.push(`description = $${paramCount++}`);
        values.push(data.description);
      }

      if (data.isConfidential !== undefined) {
        updates.push(`is_confidential = $${paramCount++}`);
        values.push(data.isConfidential);
      }

      if (updates.length > 0) {
        await client.query(`
          UPDATE documents 
          SET ${updates.join(', ')}, last_modified = CURRENT_TIMESTAMP
          WHERE id = $1
        `, values);
      }

      // Update Tags wenn vorhanden
      if (data.tags) {
        // Lösche alte Tags
        await client.query(
          'DELETE FROM document_tag_relations WHERE document_id = $1',
          [id]
        );

        // Füge neue Tags hinzu
        for (const tagName of data.tags) {
          const tagResult = await client.query(`
            INSERT INTO document_tags (name)
            VALUES ($1)
            ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
            RETURNING id
          `, [tagName]);

          await client.query(`
            INSERT INTO document_tag_relations (document_id, tag_id)
            VALUES ($1, $2)
          `, [id, tagResult.rows[0].id]);
        }
      }

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}
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

# backend/uploads/general/d5164adba8945553670c8f58bec82afcd891ccd0ce2eff80806b725ead28c237.jpg

This is a binary file of the type: Image

# backend/uploads/tenant_3/b775842b031b8badd7f970766b19ba7c92b0d26559f106dcac47978fe8ab1a22.pdf

This is a binary file of the type: PDF

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
    "@radix-ui/react-alert-dialog": "^1.1.4",
    "@radix-ui/react-select": "^2.1.4",
    "@radix-ui/react-slot": "^1.1.1",
    "@radix-ui/react-toast": "^1.2.10",
    "@radix-ui/react-tooltip": "^1.1.6",
    "@shadcn/ui": "^0.0.4",
    "class-variance-authority": "^0.7.1",
    "clsx": "^2.1.1",
    "lucide-react": "^0.468.0",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-router-dom": "^7.0.2",
    "tailwind-merge": "^2.6.0",
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
// src/App.tsx - Überarbeitete Version
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Providers } from "@/components/providers"
import Sidebar from './components/Sidebar'
import Dashboard from './components/Dashboard'
import PropertyList from './components/Immobilien/PropertyList'
import PropertyForm from './components/Immobilien/PropertyForm'
import EditPropertyWrapper from './components/Immobilien/EditPropertyWrapper'
import TenantList from './components/Mieter/TenantList'
import TenantForm from './components/Mieter/TenantForm'
import TenantEditWrapper from './components/Mieter/TenantEditWrapper'
import DocumentList from './components/Dokumente/DocumentList'
import DocumentDetail from './components/Dokumente/DocumentDetail'
import DocumentUpload from './components/Dokumente/DocumentUpload'
import WorkerList from './components/Mitarbeiter/WorkerList'
import WorkerForm from './components/Mitarbeiter/WorkerForm'
import WorkerEditWrapper from './components/Mitarbeiter/WorkerEditWrapper'
function App() {
  return (
    <Providers>
      <BrowserRouter>
        {/* Wichtig: Sidebar bleibt beim Routing bestehen */}
        <Sidebar>
          <Routes>
            {/* Hier die statischen Routen definieren */}
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<Dashboard />} />
            
            {/* Property Routes - sortiere sie richtig */}
            <Route path="/properties" element={<PropertyList />} />
            <Route path="/properties/new" element={<PropertyForm />} />
            <Route path="/properties/edit/:id" element={<EditPropertyWrapper />} />
            
           {/* Tenant Routes */}
           <Route path="/tenants" element={<TenantList />} />
            <Route path="/tenants/new" element={<TenantForm />} />
            <Route path="/tenants/edit/:id" element={<TenantEditWrapper />} />
            
            {/* Document Routes */}
            <Route path="/documents" element={<DocumentList />} />
            <Route path="/documents/upload" element={<DocumentUpload />} />
            <Route path="/documents/:id" element={<DocumentDetail />} />
            
            {/* Worker Routes */}
            <Route path="/workers" element={<WorkerList />} />
            <Route path="/workers/new" element={<WorkerForm />} />
            <Route path="/workers/edit/:id" element={<WorkerEditWrapper />} />
            
            {/* Settings */}
            <Route path="/settings" element={<div>Einstellungen (Coming Soon)</div>} />
          </Routes>
        </Sidebar>
      </BrowserRouter>
    </Providers>
  )
}

export default App
```

# frontend/src/assets/react.svg

This is a file of the type: SVG Image

# frontend/src/components/Dashboard.tsx

```tsx
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
```

# frontend/src/components/Dokumente/DocumentDetail.tsx

```tsx
// src/components/Dokumente/DocumentDetail.tsx
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  FileText,
  Download,
  Pencil,
  Trash2,
  Calendar,
  User,
  Tag,
  Lock,
  File,
  Eye,
  Filter,
  ArrowLeft,
  XCircle
} from 'lucide-react';
import { Document } from '@/types/document';
import { useAsync } from '@/hooks/useAsync';
import { useConfirmation } from '@/hooks/useConfirmation';
import { DocumentService } from '@/services/DocumentService';
import { LoadingState } from '@/components/ui/LoadingState';
import { ErrorState } from '@/components/ui/ErrorState';
import { formatFileSize, formatDate } from '@/lib/formatters';
import { downloadFile } from '@/lib/downloads';

export default function DocumentDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [documentData, setDocumentData] = useState<Document | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const { execute: fetchDocument, isLoading, error } = useAsync(
    () => DocumentService.getById(Number(id)),
    {
      errorMessage: 'Fehler beim Laden des Dokuments'
    }
  );

  const confirmDelete = useConfirmation({
    title: 'Dokument löschen?',
    message: 'Möchten Sie dieses Dokument wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.',
    confirmText: 'Löschen',
    cancelText: 'Abbrechen'
  });

  useEffect(() => {
    if (id) {
      loadDocument();
    }
  }, [id]);

  // Aufräumen der URL beim Komponentenabbau
  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const { execute: fetchPreview, isLoading: isLoadingPreview, error: previewError } = useAsync(
    async (documentId: number) => {
      const blob = await DocumentService.getPreview(documentId);
      return URL.createObjectURL(blob);
    },
    {
      errorMessage: 'Fehler beim Laden der Vorschau',
      showErrorToast: true
    }
  );

  const loadDocument = async () => {
    try {
      const data = await fetchDocument();
      setDocumentData(data);
      if (data.id) {
        const previewUrl = await fetchPreview(data.id);
        setPreviewUrl(previewUrl);
      }
    } catch (error) {
      console.error('Fehler beim Laden:', error);
    }
  };

  const handleDownload = async () => {
    if (!documentData || !id) return;

    try {
      const response = await fetch(DocumentService.getDownloadUrl(Number(id)));
      
      if (!response.ok) {
        throw new Error('Download fehlgeschlagen');
      }
      
      const blob = await response.blob();
      const filename = documentData.original_filename;
      
      // Nutzen der Download-Hilfsfunktion statt direkter DOM-Manipulation
      downloadFile(blob, filename);
    } catch (error) {
      console.error('Fehler beim Download:', error);
    }
  };

  const handleDelete = async () => {
    if (!documentData) return;

    const confirmed = await confirmDelete.confirm();
    if (!confirmed) return;

    try {
      await DocumentService.delete(documentData.id);
      navigate('/documents');
    } catch (error) {
      console.error('Fehler beim Löschen:', error);
    }
  };

  if (isLoading) {
    return <LoadingState />;
  }

  if (error || !documentData) {
    return (
      <ErrorState
        title="Fehler beim Laden"
        message={error?.message || 'Dokument nicht gefunden'}
        onRetry={loadDocument}
      />
    );
  }

  return (
    <div className="p-4 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <Button
          variant="ghost"
          onClick={() => navigate('/documents')}
          className="mb-4"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Zurück zur Übersicht
        </Button>
        
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <FileText className="w-6 h-6" />
              {documentData.original_filename}
            </h1>
            <p className="text-muted-foreground mt-1">
              {documentData.category_name}
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex items-center gap-2"
              onClick={handleDownload}
            >
              <Download className="w-4 h-4" />
              Download
            </Button>
            <Button
              variant="outline"
              className="flex items-center gap-2"
              onClick={() => navigate(`/documents/${documentData.id}/edit`)}
            >
              <Pencil className="w-4 h-4" />
              Bearbeiten
            </Button>
            <Button
              variant="outline"
              className="flex items-center gap-2"
              onClick={handleDelete}
            >
              <Trash2 className="w-4 h-4" />
              Löschen
            </Button>
          </div>
        </div>
      </div>

      {/* Hauptinhalt */}
      <div className="grid grid-cols-3 gap-6">
        {/* Linke Spalte: Metadaten */}
        <div className="space-y-6">
          {/* Allgemeine Informationen */}
          <Card>
            <CardHeader>
              <CardTitle>Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-2">
                <File className="w-4 h-4 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Dateityp</p>
                  <p>{documentData.mime_type}</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Hochgeladen am</p>
                  <p>{formatDate(documentData.upload_date)}</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Erstellt von</p>
                  <p>{documentData.created_by}</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Kategorie</p>
                  <p>{documentData.category_name}</p>
                </div>
              </div>

              {documentData.tenant && (
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Zugeordneter Mieter</p>
                    <p>
                      {documentData.tenant.first_name} {documentData.tenant.last_name}
                    </p>
                  </div>
                </div>
              )}

              {documentData.is_confidential && (
                <div className="flex items-center gap-2 text-red-600">
                  <Lock className="w-4 h-4" />
                  <p>Vertrauliches Dokument</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Tags */}
          {documentData.tags && documentData.tags.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Tags</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {documentData.tags.map((tag, index) => (
                    <span
                      key={index}
                      className="inline-flex items-center gap-1 px-2 py-1 bg-secondary rounded-md text-sm"
                    >
                      <Tag className="w-3 h-3" />
                      {tag}
                    </span>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Beschreibung */}
          {documentData.description && (
            <Card>
              <CardHeader>
                <CardTitle>Beschreibung</CardTitle>
              </CardHeader>
              <CardContent>
                <p>{documentData.description}</p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Rechte Spalte: Vorschau */}
        <div className="col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Eye className="w-5 h-5" />
                Vorschau
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoadingPreview ? (
                <div className="h-[400px] flex items-center justify-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                </div>
              ) : previewError ? (
                <div className="h-[400px] flex flex-col items-center justify-center text-destructive">
                  <XCircle className="w-8 h-8 mb-2" />
                  <p>Fehler beim Laden der Vorschau</p>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="mt-4"
                    onClick={() => documentData && fetchPreview(documentData.id)}
                  >
                    Erneut versuchen
                  </Button>
                </div>
              ) : previewUrl ? (
                documentData.mime_type.startsWith('image/') ? (
                  <img
                    src={previewUrl}
                    alt={documentData.original_filename}
                    className="max-w-full h-auto rounded-lg"
                  />
                ) : documentData.mime_type === 'application/pdf' ? (
                  <iframe
                    src={previewUrl}
                    className="w-full h-[600px] rounded-lg"
                    title={documentData.original_filename}
                  />
                ) : (
                  <div className="h-[400px] flex items-center justify-center text-muted-foreground">
                    Keine Vorschauunterstützung für diesen Dateityp
                  </div>
                )
              ) : (
                <div className="h-[400px] flex items-center justify-center text-muted-foreground">
                  Keine Vorschau verfügbar
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
```

# frontend/src/components/Dokumente/DocumentForm.tsx

```tsx
// src/components/Dokumente/DocumentForm.tsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, X, Upload, File } from 'lucide-react';
import { DocumentService } from '@/services/DocumentService';
import { TenantService } from '@/services/TenantService';
import { useAsync } from '@/hooks/useAsync';
import { useFormState } from '@/hooks/useFormState';
import { Document, DocumentUploadData } from '@/types/document';
import { Tenant } from '@/types/tenant';
import { formatFileSize } from '@/lib/formatters';

interface DocumentFormProps {
  initialData?: Document;
  tenantId?: string;
}

const ACCEPTED_FILE_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
];

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export default function DocumentForm({ initialData, tenantId }: DocumentFormProps) {
  const navigate = useNavigate();
  const [file, setFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [categories, setCategories] = useState<any[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  
  const {
    formData,
    updateField,
    errors,
    setErrors,
  } = useFormState({
    categoryId: '',
    tenantId: tenantId || '',
    description: '',
    isConfidential: false,
    tags: [] as string[],
    newTag: ''
  });

  // API calls
  const { execute: uploadDocument, isLoading: isUploading } = useAsync(
    async (data: DocumentUploadData) => {
      return DocumentService.upload(data);
    },
    {
      successMessage: 'Dokument wurde erfolgreich hochgeladen',
      errorMessage: 'Fehler beim Hochladen des Dokuments'
    }
  );

  const { execute: fetchCategories } = useAsync(
    () => DocumentService.getCategories(),
    {
      errorMessage: 'Fehler beim Laden der Kategorien'
    }
  );

  const { execute: fetchTenants } = useAsync(
    () => TenantService.getAll(),
    {
      errorMessage: 'Fehler beim Laden der Mieter'
    }
  );

  useEffect(() => {
    loadCategories();
    if (!tenantId) {
      loadTenants();
    }
  }, [tenantId]);

  const loadCategories = async () => {
    try {
      const data = await fetchCategories();
      setCategories(data);
    } catch (error) {
      console.error('Fehler beim Laden der Kategorien:', error);
    }
  };

  const loadTenants = async () => {
    try {
      const data = await fetchTenants();
      setTenants(data);
    } catch (error) {
      console.error('Fehler beim Laden der Mieter:', error);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const handleFile = (file: File) => {
    if (!ACCEPTED_FILE_TYPES.includes(file.type)) {
      setErrors({
        file: 'Dateityp nicht unterstützt'
      });
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      setErrors({
        file: 'Datei zu groß (max. 10MB)'
      });
      return;
    }

    setFile(file);
    setErrors({});
  };

  const addTag = () => {
    if (formData.newTag && !formData.tags.includes(formData.newTag)) {
      updateField('tags', [...formData.tags, formData.newTag]);
      updateField('newTag', '');
    }
  };

  const removeTag = (tagToRemove: string) => {
    updateField('tags', formData.tags.filter(tag => tag !== tagToRemove));
  };

  const validateForm = (): boolean => {
    const newErrors: any = {};

    if (!file) {
      newErrors.file = 'Bitte wählen Sie eine Datei aus';
    }

    if (!formData.categoryId) {
      newErrors.categoryId = 'Bitte wählen Sie eine Kategorie aus';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm() || !file) {
      return;
    }

    try {
      const uploadData: DocumentUploadData = {
        file,
        categoryId: parseInt(formData.categoryId),
        description: formData.description,
        isConfidential: formData.isConfidential,
        tags: formData.tags
      };

      if (formData.tenantId) {
        uploadData.tenantId = parseInt(formData.tenantId);
      }

      await uploadDocument(uploadData);
      navigate('/documents');
    } catch (error) {
      // Error wird bereits durch useAsync behandelt
    }
  };

  return (
    <div className="p-4 max-w-3xl mx-auto">
      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Dokument hochladen</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Drop Zone */}
            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors
                ${dragActive ? 'border-primary bg-primary/5' : 'border-gray-300'}`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
            >
              {file ? (
                <div className="flex items-center justify-center gap-4">
                  <File className="w-8 h-8 text-primary" />
                  <div>
                    <p className="font-medium">{file.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {formatFileSize(file.size)}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setFile(null)}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  <Upload className="w-12 h-12 mx-auto text-muted-foreground" />
                  <div>
                    <p className="text-lg font-medium">
                      Datei hierher ziehen oder klicken zum Auswählen
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Maximale Dateigröße: 10MB
                    </p>
                  </div>
                  <Input
                    type="file"
                    className="hidden"
                    onChange={handleFileSelect}
                    accept={ACCEPTED_FILE_TYPES.join(',')}
                    id="file-upload"
                  />
                  <Button
                    type="button"
                    onClick={() => document.getElementById('file-upload')?.click()}
                  >
                    Datei auswählen
                  </Button>
                </div>
              )}

              {errors.file && (
                <p className="text-sm text-destructive mt-2">{errors.file}</p>
              )}
            </div>

            {/* Formularfelder */}
            <div className="grid gap-4">
              {/* Kategorie */}
              <div>
                <label className="text-sm font-medium">Kategorie</label>
                <Select
                  value={formData.categoryId}
                  onValueChange={value => updateField('categoryId', value)}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Kategorie wählen" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((category) => (
                      <SelectItem 
                        key={category.id} 
                        value={category.id.toString()}
                      >
                        {category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.categoryId && (
                  <p className="text-sm text-destructive mt-1">{errors.categoryId}</p>
                )}
              </div>

              {/* Mieter (optional) */}
              {!tenantId && (
                <div>
                  <label className="text-sm font-medium">Mieter (optional)</label>
                  <Select
                    value={formData.tenantId}
                    onValueChange={value => updateField('tenantId', value)}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Mieter auswählen" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Kein Mieter</SelectItem>
                      {tenants.map((tenant) => (
                        <SelectItem key={tenant.id} value={tenant.id.toString()}>
                          {tenant.first_name} {tenant.last_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Beschreibung */}
              <div>
                <label className="text-sm font-medium">Beschreibung</label>
                <Input
                  value={formData.description}
                  onChange={e => updateField('description', e.target.value)}
                  className="mt-1"
                />
              </div>

              {/* Tags */}
              <div>
                <label className="text-sm font-medium">Tags</label>
                <div className="mt-2 space-y-2">
                  <div className="flex gap-2">
                    <Input
                      value={formData.newTag}
                      onChange={e => updateField('newTag', e.target.value)}
                      placeholder="Neuen Tag eingeben"
                    />
                    <Button
                      type="button"
                      onClick={addTag}
                      disabled={!formData.newTag}
                    >
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
                  
                  {formData.tags.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {formData.tags.map((tag, index) => (
                        <span
                          key={index}
                          className="inline-flex items-center gap-1 px-2 py-1 bg-secondary rounded-md text-sm"
                        >
                          {tag}
                          <button
                            type="button"
                            onClick={() => removeTag(tag)}
                            className="text-muted-foreground hover:text-foreground"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Vertraulichkeit */}
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="confidential"
                  checked={formData.isConfidential}
                  onChange={e => updateField('isConfidential', e.target.checked)}
                  className="rounded border-gray-300"
                />
                <label htmlFor="confidential" className="text-sm">
                  Als vertraulich markieren
                </label>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Submit Buttons */}
        <div className="flex justify-end gap-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate('/documents')}
            disabled={isUploading}
          >
            Abbrechen
          </Button>
          <Button 
            type="submit"
            disabled={!file || isUploading}
          >
            {isUploading ? 'Wird hochgeladen...' : 'Dokument hochladen'}
          </Button>
        </div>
      </form>
    </div>
  );
}
```

# frontend/src/components/Dokumente/DocumentList.tsx

```tsx
// src/components/Dokumente/DocumentList.tsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  FileText,
  Upload,
  Search,
  Filter,
  Tag,
  User,
  Calendar,
  Download,
  Eye,
  Lock,
} from 'lucide-react';
import { Document } from '@/types/document';
import { useAsync } from '@/hooks/useAsync';
import { useConfirmation } from '@/hooks/useConfirmation';
import { DocumentService } from '@/services/DocumentService';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingState } from '@/components/ui/LoadingState';
import { ErrorState } from '@/components/ui/ErrorState';
import { formatFileSize, formatDate } from '@/lib/formatters';

export default function DocumentList() {
  const navigate = useNavigate();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [showConfidential, setShowConfidential] = useState<boolean | null>(null);

  const { execute: fetchDocuments, isLoading, error } = useAsync<Document[]>(
    () => DocumentService.getAll(),
    {
      errorMessage: 'Fehler beim Laden der Dokumente'
    }
  );

  const { execute: fetchCategories } = useAsync(
    () => DocumentService.getCategories(),
    {
      errorMessage: 'Fehler beim Laden der Kategorien'
    }
  );

  const confirmDelete = useConfirmation({
    title: 'Dokument löschen?',
    message: 'Möchten Sie dieses Dokument wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.',
    confirmText: 'Löschen',
    cancelText: 'Abbrechen'
  });

  useEffect(() => {
    loadDocuments();
    loadCategories();
  }, []);

  const loadDocuments = async () => {
    try {
      const data = await fetchDocuments();
      setDocuments(data);
    } catch (error) {
      console.error('Fehler beim Laden:', error);
    }
  };

  const loadCategories = async () => {
    try {
      const data = await fetchCategories();
      setCategories(data);
    } catch (error) {
      console.error('Fehler beim Laden der Kategorien:', error);
    }
  };

  const handleDownload = async (id: number, filename: string) => {
    try {
      const response = await fetch(`http://localhost:3001/documents/${id}/download`);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Fehler beim Download:', error);
    }
  };

  const handleDelete = async (id: number) => {
    const confirmed = await confirmDelete.confirm();
    if (!confirmed) return;

    try {
      await DocumentService.delete(id);
      await loadDocuments();
    } catch (error) {
      console.error('Fehler beim Löschen:', error);
    }
  };

  const filteredDocuments = documents.filter(doc => {
    const matchesSearch = 
      doc.original_filename.toLowerCase().includes(searchTerm.toLowerCase()) ||
      doc.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      doc.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesCategory = selectedCategory === 'all' || 
      doc.category_id.toString() === selectedCategory;

    const matchesConfidential = 
      showConfidential === null || 
      doc.is_confidential === showConfidential;

    return matchesSearch && matchesCategory && matchesConfidential;
  });

  if (isLoading) {
    return <LoadingState />;
  }

  if (error) {
    return (
      <ErrorState
        title="Fehler beim Laden"
        message={error.message}
        onRetry={loadDocuments}
      />
    );
  }

  return (
    <div className="p-4 max-w-5xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-2">
          <FileText className="w-6 h-6" />
          <h1 className="text-2xl font-bold">Dokumente</h1>
        </div>
        <Button
          onClick={() => navigate('/documents/upload')}
          className="flex items-center gap-2"
        >
          <Upload className="w-4 h-4" />
          Dokument hochladen
        </Button>
      </div>

      {/* Filter-Leiste */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex gap-4 flex-wrap">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Suche nach Dokumenten..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>

            <div className="w-[200px]">
              <Select
                value={selectedCategory}
                onValueChange={setSelectedCategory}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Kategorie" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alle Kategorien</SelectItem>
                  {categories.map((cat) => (
                    <SelectItem 
                      key={cat.id} 
                      value={cat.id.toString()}
                    >
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="w-[200px]">
              <Select
                value={showConfidential?.toString() ?? 'null'}
                onValueChange={(value) =>
                  setShowConfidential(
                    value === 'null' ? null : value === 'true'
                  )
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Vertraulichkeit" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="null">Alle</SelectItem>
                  <SelectItem value="true">Vertraulich</SelectItem>
                  <SelectItem value="false">Nicht vertraulich</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Dokumentenliste */}
      {documents.length === 0 ? (
        <EmptyState
          title="Keine Dokumente vorhanden"
          description="Laden Sie Ihr erstes Dokument hoch"
          icon={<FileText className="w-12 h-12 text-muted-foreground" />}
          action={{
            label: 'Dokument hochladen',
            onClick: () => navigate('/documents/upload')
          }}
        />
      ) : filteredDocuments.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center">
            <p className="text-muted-foreground">
              Keine Dokumente gefunden für die ausgewählten Filter
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {filteredDocuments.map(doc => (
            <Card 
              key={doc.id}
              className="hover:shadow-md transition-all duration-200"
            >
              <CardContent className="p-4">
                <div className="flex justify-between items-start">
                  <div className="flex gap-3">
                    <FileText className="w-8 h-8 text-primary mt-1" />
                    <div>
                      <h3 className="font-medium">{doc.original_filename}</h3>
                      {doc.description && (
                        <p className="text-sm text-muted-foreground mt-1">
                          {doc.description}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {doc.is_confidential && (
                      <Lock className="w-4 h-4 text-red-500" />
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigate(`/documents/${doc.id}`)}
                      className="flex items-center gap-1"
                    >
                      <Eye className="w-4 h-4" />
                      <span className="hidden sm:inline">Anzeigen</span>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDownload(doc.id, doc.original_filename)}
                      className="flex items-center gap-1"
                    >
                      <Download className="w-4 h-4" />
                      <span className="hidden sm:inline">Download</span>
                    </Button>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <Filter className="w-4 h-4 text-muted-foreground" />
                    {doc.category_name}
                  </div>

                  {doc.tenant && (
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-muted-foreground" />
                      {doc.tenant.first_name} {doc.tenant.last_name}
                    </div>
                  )}

                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-muted-foreground" />
                    {formatDate(doc.upload_date)}
                  </div>

                  {doc.tags.length > 0 && (
                    <div className="flex items-center gap-2">
                      <Tag className="w-4 h-4 text-muted-foreground" />
                      <div className="flex gap-1">
                        {doc.tags.map((tag, i) => (
                          <span
                            key={i}
                            className="bg-secondary px-2 py-0.5 rounded-md text-xs"
                          >
                            {tag}
                          </span>
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
  );
}
```

# frontend/src/components/Dokumente/DocumentUpload.tsx

```tsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, Upload, X } from 'lucide-react';

interface DocumentUploadProps {
  tenantId?: string;
}

interface Category {
  id: number;
  name: string;
}

interface Tenant {
  id: number;
  first_name: string;
  last_name: string;
}

interface FormData {
  categoryId: string;
  tenantId: string;
  description: string;
  isConfidential: boolean;
  tags: string[];
  newTag: string;
}

export default function DocumentUpload({ tenantId }: DocumentUploadProps) {
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);

  const [formData, setFormData] = useState<FormData>({
    categoryId: 'select',
    tenantId: tenantId || 'none',
    description: '',
    isConfidential: false,
    tags: [],
    newTag: ''
  });

  useEffect(() => {
    loadCategories();
    if (!tenantId) {
      loadTenants();
    }
  }, [tenantId]);

  const loadCategories = async () => {
    try {
      console.log('Loading categories...');
      const response = await fetch('http://localhost:3001/documents/categories');
      console.log('Response status:', response.status);
      
      if (!response.ok) {
        console.error('Categories response not OK:', response.status);
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('Received categories data:', data); // Schauen was zurückkommt
      
      if (!Array.isArray(data) || data.length === 0) {
        console.error('No categories received or invalid data format');
        return;
      }
      
      setCategories(data);
    } catch (error) {
      console.error('Error loading categories:', error);
    }
  };
  const loadTenants = async () => {
    try {
      console.log('Loading tenants...');
      const response = await fetch('http://localhost:3001/tenants');
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      console.log('Tenants loaded:', data);
      setTenants(data);
    } catch (error) {
      console.error('Error loading tenants:', error);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setSelectedFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleAddTag = () => {
    if (formData.newTag && !formData.tags.includes(formData.newTag)) {
      setFormData({
        ...formData,
        tags: [...formData.tags, formData.newTag],
        newTag: ''
      });
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setFormData({
      ...formData,
      tags: formData.tags.filter(tag => tag !== tagToRemove)
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      alert('Bitte wählen Sie eine Datei aus');
      return;
    }

    if (formData.categoryId === 'select') {
      alert('Bitte wählen Sie eine Kategorie aus');
      return;
    }

    setIsSubmitting(true);

    try {
      const formPayload = new FormData();
      formPayload.append('file', selectedFile);
      formPayload.append('categoryId', formData.categoryId);
      if (formData.tenantId !== 'none') {
        formPayload.append('tenantId', formData.tenantId);
      }
      formPayload.append('description', formData.description);
      formPayload.append('isConfidential', String(formData.isConfidential));
      formPayload.append('tags', JSON.stringify(formData.tags));

      const response = await fetch('http://localhost:3001/documents', {
        method: 'POST',
        body: formPayload
      });

      if (!response.ok) throw new Error('Upload fehlgeschlagen');

      navigate('/documents');
    } catch (error) {
      console.error('Fehler beim Upload:', error);
      alert('Fehler beim Upload des Dokuments');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Dokument hochladen</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Drop Zone */}
            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center 
                ${dragActive ? 'border-primary bg-primary/5' : 'border-gray-300'}`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
            >
              {selectedFile ? (
                <div className="flex items-center justify-center gap-4">
                  <div>
                    <p className="font-medium">{selectedFile.name}</p>
                    <p className="text-sm text-gray-500">
                      {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedFile(null)}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  <Upload className="w-12 h-12 mx-auto text-gray-400" />
                  <div>
                    <p className="text-lg font-medium">
                      Datei hierher ziehen oder klicken zum Auswählen
                    </p>
                    <p className="text-sm text-gray-500">
                      Maximale Dateigröße: 10MB
                    </p>
                  </div>
                  <Input
                    type="file"
                    className="hidden"
                    onChange={handleFileSelect}
                    id="file-upload"
                  />
                  <Button
                    type="button"
                    onClick={() => document.getElementById('file-upload')?.click()}
                  >
                    Datei auswählen
                  </Button>
                </div>
              )}
            </div>

            {/* Formularfelder */}
            <div className="grid grid-cols-2 gap-4">
              {/* Kategorie */}
              <div>
                <label className="text-sm font-medium">Kategorie</label>
                <Select
                  value={formData.categoryId}
                  onValueChange={(value) => 
                    setFormData({ ...formData, categoryId: value })
                  }
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Kategorie wählen" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories && categories.length > 0 ? (
                      categories.map((cat) => (
                        <SelectItem key={cat.id} value={cat.id.toString()}>
                          {cat.name}
                        </SelectItem>
                      ))
                    ) : (
                      <SelectItem value="select">Lade Kategorien...</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>

              {/* Mieter (optional) */}
              {!tenantId && (
                <div>
                  <label className="text-sm font-medium">Mieter (optional)</label>
                  <Select
                    value={formData.tenantId}
                    onValueChange={(value) => 
                      setFormData({ ...formData, tenantId: value })
                    }
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Mieter auswählen" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Kein Mieter</SelectItem>
                      {tenants.map((tenant) => (
                        <SelectItem key={tenant.id} value={tenant.id.toString()}>
                          {tenant.first_name} {tenant.last_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Beschreibung */}
              <div className="col-span-2">
                <label className="text-sm font-medium">Beschreibung</label>
                <Input
                  value={formData.description}
                  onChange={(e) => 
                    setFormData({ ...formData, description: e.target.value })
                  }
                  className="mt-1"
                />
              </div>
            </div>

            {/* Tags */}
            <div>
              <label className="text-sm font-medium">Tags</label>
              <div className="mt-2 space-y-2">
                <div className="flex gap-2">
                  <Input
                    value={formData.newTag}
                    onChange={(e) => 
                      setFormData({ ...formData, newTag: e.target.value })
                    }
                    placeholder="Neuen Tag eingeben"
                  />
                  <Button
                    type="button"
                    onClick={handleAddTag}
                    disabled={!formData.newTag}
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
                
                {formData.tags.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {formData.tags.map((tag, index) => (
                      <span
                        key={index}
                        className="inline-flex items-center gap-1 px-2 py-1 bg-secondary rounded-md text-sm"
                      >
                        {tag}
                        <button
                          type="button"
                          onClick={() => handleRemoveTag(tag)}
                          className="text-gray-500 hover:text-gray-700"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Vertraulichkeit */}
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="confidential"
                checked={formData.isConfidential}
                onChange={(e) => 
                  setFormData({ ...formData, isConfidential: e.target.checked })
                }
                className="rounded border-gray-300"
              />
              <label htmlFor="confidential" className="text-sm">
                Als vertraulich markieren
              </label>
            </div>
          </CardContent>
        </Card>

        {/* Submit Buttons */}
        <div className="flex justify-end gap-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate('/documents')}
            disabled={isSubmitting}
          >
            Abbrechen
          </Button>
          <Button 
            type="submit"
            disabled={!selectedFile || isSubmitting}
          >
            {isSubmitting ? 'Wird hochgeladen...' : 'Dokument hochladen'}
          </Button>
        </div>
      </form>
    </div>
  );
}
```

# frontend/src/components/Immobilien/EditPropertyWrapper.tsx

```tsx
// src/components/Immobilien/EditPropertyWrapper.tsx
import { useParams } from 'react-router-dom';
import PropertyForm from './PropertyForm';
import { useEffect, useState } from 'react';
import { Property } from '@/types/property';
import { PropertyService } from '@/services/PropertyService';
import { LoadingState } from '@/components/ui/LoadingState';
import { ErrorState } from '@/components/ui/ErrorState';

export default function EditPropertyWrapper() {
  const { id } = useParams<{ id: string }>();
  const [property, setProperty] = useState<Property | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    async function loadProperty() {
      try {
        setIsLoading(true);
        const data = await PropertyService.getById(Number(id));
        setProperty(data);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Error loading property'));
      } finally {
        setIsLoading(false);
      }
    }

    if (id) {
      loadProperty();
    }
  }, [id]);

  if (isLoading) return <LoadingState />;
  if (error || !property) return <ErrorState title="Error" message={error?.message || 'Property not found'} />;

  return <PropertyForm initialData={property} />;
}
```

# frontend/src/components/Immobilien/PropertyCard.tsx

```tsx
// src/components/Immobilien/PropertyCard.tsx
import { Property } from '@/types/property';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronUp, Pencil, Trash2 } from 'lucide-react';
import { formatCurrency } from '@/lib/formatters';

interface PropertyCardProps {
  property: Property;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

export function PropertyCard({
  property,
  isExpanded,
  onToggleExpand,
  onEdit,
  onDelete,
}: PropertyCardProps) {
  return (
    <Card className="hover:shadow-md transition-shadow duration-200">
      <CardHeader className="p-4">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={onToggleExpand}
              className="p-0 hover:bg-transparent"
            >
              {isExpanded ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </Button>
            <h3 className="font-semibold text-lg">{property.address}</h3>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onEdit}
              className="flex items-center gap-1"
            >
              <Pencil className="w-4 h-4" />
              <span className="hidden sm:inline">Bearbeiten</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={onDelete}
              className="flex items-center gap-1 text-destructive hover:text-destructive"
            >
              <Trash2 className="w-4 h-4" />
              <span className="hidden sm:inline">Löschen</span>
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Art der Immobilie</p>
              <p>{property.property_type || 'Keine Angabe'}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Monatliche Gesamtmiete</p>
              <p className="font-medium">
                {formatCurrency(property.total_rent)}
              </p>
            </div>
          </div>

          {isExpanded && property.units && (
            <div className="pt-4 border-t">
              <h4 className="font-medium mb-3">Wohneinheiten</h4>
              <div className="grid gap-3">
                {property.units.map((unit, index) => (
                  <div
                    key={unit.id || index}
                    className="bg-secondary/50 rounded-lg p-3"
                  >
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div>
                        <p className="text-xs text-muted-foreground">Name</p>
                        <p className="text-sm font-medium">{unit.name}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Typ</p>
                        <p className="text-sm">{unit.type}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Größe</p>
                        <p className="text-sm">{unit.size} m²</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Status</p>
                        <div className="flex items-center gap-1">
                          <span className={`w-2 h-2 rounded-full ${
                            unit.status === 'besetzt' ? 'bg-blue-500' : 'bg-green-500'
                          }`} />
                          <p className="text-sm">{unit.status}</p>
                        </div>
                      </div>
                      {unit.status === 'besetzt' && (
                        <div>
                          <p className="text-xs text-muted-foreground">Miete</p>
                          <p className="text-sm">{formatCurrency(unit.rent || 0)}</p>
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
  );
}

```

# frontend/src/components/Immobilien/PropertyDetail.tsx

```tsx
// src/components/Immobilien/PropertyDetail.tsx
import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Property } from '@/types/property';
import { useAsync } from '@/hooks/useAsync';
import { PropertyService } from '@/services/PropertyService';
import { LoadingState } from '@/components/ui/LoadingState';
import { ErrorState } from '@/components/ui/ErrorState';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { Building2, ArrowLeft, MapPin, Home, Euro, Users } from 'lucide-react';

export default function PropertyDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [property, setProperty] = useState<Property | null>(null);

  const { execute: fetchProperty, isLoading, error } = useAsync(
    () => PropertyService.getById(Number(id)),
    {
      errorMessage: 'Fehler beim Laden der Immobilie'
    }
  );

  useEffect(() => {
    if (id) {
      loadProperty();
    }
  }, [id]);

  const loadProperty = async () => {
    try {
      const data = await fetchProperty();
      setProperty(data);
    } catch (error) {
      console.error('Fehler beim Laden:', error);
    }
  };

  if (isLoading) {
    return <LoadingState />;
  }

  if (error || !property) {
    return (
      <ErrorState
        title="Fehler beim Laden"
        message={error?.message || 'Immobilie nicht gefunden'}
        onRetry={loadProperty}
      />
    );
  }

  return (
    <div className="p-4 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <Button
          variant="ghost"
          onClick={() => navigate('/properties')}
          className="mb-4"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Zurück zur Übersicht
        </Button>
        
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Building2 className="w-6 h-6" />
              {property.address}
            </h1>
            <p className="text-muted-foreground mt-1">
              {property.property_type}
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => navigate(`/properties/${property.id}/documents`)}
            >
              Dokumente
            </Button>
            <Button
              onClick={() => navigate(`/properties/edit/${property.id}`)}
            >
              Bearbeiten
            </Button>
          </div>
        </div>
      </div>

      {/* Übersichtskarten */}
      <div className="grid gap-6">
        {/* Allgemeine Informationen */}
        <Card>
          <CardHeader>
            <CardTitle>Übersicht</CardTitle>
          </CardHeader>
          <CardContent className="grid sm:grid-cols-3 gap-6">
            <div className="flex items-start gap-3">
              <MapPin className="w-5 h-5 text-muted-foreground shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">Adresse</p>
                <p className="text-muted-foreground">{property.address}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Home className="w-5 h-5 text-muted-foreground shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">Wohneinheiten</p>
                <p className="text-muted-foreground">
                  {property.units.length} Einheiten
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Euro className="w-5 h-5 text-muted-foreground shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">Gesamtmiete</p>
                <p className="text-muted-foreground">
                  {formatCurrency(property.total_rent)} / Monat
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Wohneinheiten */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Wohneinheiten</CardTitle>
            <Button
              variant="outline"
              onClick={() => navigate(`/properties/edit/${property.id}#units`)}
            >
              Einheiten verwalten
            </Button>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4">
              {property.units.map((unit) => (
                <div
                  key={unit.id}
                  className="p-4 rounded-lg border bg-card hover:shadow-sm transition-shadow"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-medium">{unit.name}</h3>
                      <p className="text-sm text-muted-foreground">
                        {unit.type} • {unit.size} m²
                      </p>
                    </div>
                    <div className={`px-2 py-1 rounded-full text-sm ${
                      unit.status === 'besetzt'
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-green-100 text-green-700'
                    }`}>
                      {unit.status}
                    </div>
                  </div>
                  
                  {unit.status === 'besetzt' && (
                    <div className="mt-4 pt-4 border-t">
                      <div className="flex items-center gap-2 text-sm">
                        <Users className="w-4 h-4 text-muted-foreground" />
                        <span>Vermietet für {formatCurrency(unit.rent || 0)} / Monat</span>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Statistiken */}
        <div className="grid sm:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Vermietungsstatus</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-sm">Vermietungsquote</span>
                    <span className="text-sm font-medium">
                      {Math.round((property.units.filter(u => u.status === 'besetzt').length / property.units.length) * 100)}%
                    </span>
                  </div>
                  <div className="h-2 bg-secondary rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-primary"
                      style={{ 
                        width: `${(property.units.filter(u => u.status === 'besetzt').length / property.units.length) * 100}%`
                      }}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 pt-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Vermietet</p>
                    <p className="text-2xl font-bold">
                      {property.units.filter(u => u.status === 'besetzt').length}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Verfügbar</p>
                    <p className="text-2xl font-bold">
                      {property.units.filter(u => u.status === 'verfügbar').length}
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Mieteinnahmen</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-muted-foreground">Aktuelle Monatsmiete</p>
                  <p className="text-2xl font-bold">{formatCurrency(property.total_rent)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Durchschnittliche Miete pro m²</p>
                  <p className="text-2xl font-bold">
                    {formatCurrency(
                      property.total_rent / 
                      property.units.reduce((sum, unit) => sum + unit.size, 0)
                    )}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
```

# frontend/src/components/Immobilien/PropertyForm.tsx

```tsx
// src/components/Immobilien/PropertyForm.tsx
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, X } from 'lucide-react';
import { PropertyService } from '@/services/PropertyService';
import { useAsync } from '@/hooks/useAsync';
import { useFormState } from '@/hooks/useFormState';
import { useConfirmation } from '@/hooks/useConfirmation';
import { Property, PropertyFormData, Unit } from '@/types/property';
import { required, number } from '@/lib/validators';
import { propertyTypes, UNIT_TYPES, UNIT_STATUS } from '@/constants/propertyTypes';

interface PropertyFormProps {
  initialData?: Property;
}

const INITIAL_PROPERTY_DATA: PropertyFormData = {
  address: '',
  property_type: '',
  units: []
};

const INITIAL_UNIT: Omit<Unit, 'id' | 'property_id' | 'created_at' | 'updated_at'> = {
  name: '',
  type: 'Wohnung',
  size: 0,
  status: 'verfügbar',
  rent: 0
};

export default function PropertyForm({ initialData }: PropertyFormProps) {
  const navigate = useNavigate();
  
  const {
    formData,
    updateField,
    errors,
    setErrors,
  } = useFormState<PropertyFormData>(
    initialData || INITIAL_PROPERTY_DATA
  );

  const { execute: saveProperty, isLoading: isSaving } = useAsync(
    async (data: PropertyFormData) => {
      if (initialData) {
        return PropertyService.update(initialData.id, data);
      }
      return PropertyService.create(data);
    },
    {
      successMessage: initialData 
        ? 'Immobilie wurde erfolgreich aktualisiert'
        : 'Immobilie wurde erfolgreich erstellt',
      errorMessage: 'Fehler beim Speichern der Immobilie'
    }
  );

  const confirmDiscardDialog = useConfirmation({
    title: 'Änderungen verwerfen?',
    message: 'Möchten Sie die Bearbeitung wirklich abbrechen? Alle nicht gespeicherten Änderungen gehen verloren.',
    confirmText: 'Verwerfen',
    cancelText: 'Weiter bearbeiten'
  });

  const validateForm = (): boolean => {
    let isValid = true;
    const newErrors: Partial<Record<keyof PropertyFormData, string>> = {};

    if (!formData.address) {
      newErrors.address = 'Adresse ist erforderlich';
      isValid = false;
    }

    if (!formData.property_type) {
      newErrors.property_type = 'Immobilientyp ist erforderlich';
      isValid = false;
    }

    // Validiere alle Units
    const unitErrors: any[] = [];
    formData.units.forEach((unit, index) => {
      const unitError: any = {};
      
      if (!unit.name) {
        unitError.name = 'Name ist erforderlich';
        isValid = false;
      }
      
      if (unit.size <= 0) {
        unitError.size = 'Größe muss größer als 0 sein';
        isValid = false;
      }

      if (unit.status === 'besetzt' && (!unit.rent || unit.rent <= 0)) {
        unitError.rent = 'Miete ist erforderlich für besetzte Einheiten';
        isValid = false;
      }

      if (Object.keys(unitError).length > 0) {
        unitErrors[index] = unitError;
      }
    });

    if (unitErrors.length > 0) {
      newErrors.units = unitErrors;
    }

    setErrors(newErrors);
    return isValid;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    try {
      await saveProperty(formData);
      navigate('/properties');
    } catch (error) {
      // Error wird bereits durch useAsync behandelt
    }
  };

  const handleCancel = async () => {
    const hasChanges = JSON.stringify(initialData) !== JSON.stringify(formData);
    if (hasChanges) {
      const confirmed = await confirmDiscardDialog.confirm();
      if (!confirmed) return;
    }
    navigate('/properties');
  };

  const addUnit = () => {
    updateField('units', [...formData.units, { ...INITIAL_UNIT }]);
  };

  const removeUnit = (index: number) => {
    const newUnits = formData.units.filter((_, i) => i !== index);
    updateField('units', newUnits);
  };

  const updateUnit = (index: number, field: keyof Unit, value: any) => {
    const newUnits = formData.units.map((unit, i) => {
      if (i !== index) return unit;

      // Wenn der Status von "besetzt" auf "verfügbar" wechselt, Miete zurücksetzen
      if (field === 'status' && value === 'verfügbar') {
        return { ...unit, [field]: value, rent: 0 };
      }

      // Für numerische Felder
      if (field === 'size' || field === 'rent') {
        value = value === '' ? 0 : Number(value);
      }

      return { ...unit, [field]: value };
    });

    updateField('units', newUnits);
  };

  return (
    <div className="p-4 max-w-3xl mx-auto">
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Immobilien-Hauptdaten */}
        <Card>
          <CardHeader>
            <CardTitle>
              {initialData ? 'Immobilie bearbeiten' : 'Neue Immobilie'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4">
              {/* Adresse */}
              <div>
                <label className="text-sm font-medium">Adresse</label>
                <Input
                  value={formData.address}
                  onChange={e => updateField('address', e.target.value)}
                  className="mt-1"
                  disabled={isSaving}
                />
                {errors.address && (
                  <p className="text-sm text-destructive mt-1">{errors.address}</p>
                )}
              </div>

              {/* Immobilientyp */}
              <div>
                <label className="text-sm font-medium">Art der Immobilie</label>
                <Select
                  value={formData.property_type}
                  onValueChange={value => updateField('property_type', value)}
                  disabled={isSaving}
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
                {errors.property_type && (
                  <p className="text-sm text-destructive mt-1">{errors.property_type}</p>
                )}
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
              disabled={isSaving}
            >
              <Plus className="w-4 h-4" />
              Einheit hinzufügen
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {formData.units.map((unit, index) => (
                <div 
                  key={index}
                  className="p-4 bg-secondary/50 rounded-lg space-y-4"
                >
                  <div className="flex justify-between items-start">
                    <h3 className="text-sm font-medium">Einheit {index + 1}</h3>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => removeUnit(index)}
                      disabled={isSaving}
                    >
                      <X className="w-4 h-4" />
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
                        disabled={isSaving}
                      />
                      {errors.units?.[index]?.name && (
                        <p className="text-sm text-destructive mt-1">
                          {errors.units[index].name}
                        </p>
                      )}
                    </div>

                    {/* Typ */}
                    <div>
                      <label className="text-sm font-medium">Typ</label>
                      <Select
                        value={unit.type}
                        onValueChange={value => updateUnit(index, 'type', value)}
                        disabled={isSaving}
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
                        value={unit.size || ''}
                        onChange={e => updateUnit(index, 'size', e.target.value)}
                        className="mt-1"
                        min="0"
                        disabled={isSaving}
                      />
                      {errors.units?.[index]?.size && (
                        <p className="text-sm text-destructive mt-1">
                          {errors.units[index].size}
                        </p>
                      )}
                    </div>

                    {/* Status */}
                    <div>
                      <label className="text-sm font-medium">Status</label>
                      <Select
                        value={unit.status}
                        onValueChange={value => updateUnit(index, 'status', value)}
                        disabled={isSaving}
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
                          value={unit.rent || ''}
                          onChange={e => updateUnit(index, 'rent', e.target.value)}
                          className="mt-1"
                          min="0"
                          disabled={isSaving}
                        />
                        {errors.units?.[index]?.rent && (
                          <p className="text-sm text-destructive mt-1">
                            {errors.units[index].rent}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Form Buttons */}
        <div className="flex justify-end gap-4">
          <Button
            type="submit"
            disabled={isSaving}
          >
            {isSaving ? 'Wird gespeichert...' : 'Speichern'}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={handleCancel}
            disabled={isSaving}
          >
            Abbrechen
          </Button>
        </div>
      </form>
    </div>
  );
}
```

# frontend/src/components/Immobilien/PropertyList.tsx

```tsx
// src/components/Immobilien/PropertyList.tsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Building2, PlusCircle } from 'lucide-react';
import { Property } from '@/types/property';
import { useAsync } from '@/hooks/useAsync';
import { useConfirmation } from '@/hooks/useConfirmation';
import { PropertyService } from '@/services/PropertyService';
import { PropertyCard } from './PropertyCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingState } from '@/components/ui/LoadingState';
import { ErrorState } from '@/components/ui/ErrorState';
import { API } from '@/services/api';

export default function PropertyList() {
  const navigate = useNavigate();
  const [properties, setProperties] = useState<Property[]>([]);
  const [expandedProperty, setExpandedProperty] = useState<number | null>(null);

  const { execute: fetchProperties, isLoading, error } = useAsync<Property[]>(
    () => PropertyService.getAll(),
    {
      errorMessage: 'Fehler beim Laden der Immobilien',
      loadingTimeout: API.loadingStateTimeout
    }
  );

  const { confirm: confirmDelete } = useConfirmation({
    title: 'Immobilie löschen',
    message: 'Möchten Sie diese Immobilie wirklich löschen? Alle zugehörigen Daten werden ebenfalls gelöscht.',
    confirmText: 'Löschen',
    cancelText: 'Abbrechen'
  });

  useEffect(() => {
    console.log('PropertyList mounted, loading properties');
    loadProperties();
  }, []);

  const loadProperties = async () => {
    console.log('loadProperties called');
    try {
      console.log('Executing fetchProperties');
      const data = await fetchProperties();
      console.log('Properties loaded successfully:', data);
      setProperties(data);
    } catch (error) {
      console.error('Fehler beim Laden:', error);
    }
  };

  const handleDelete = async (id: number) => {
    const confirmed = await confirmDelete();
    if (!confirmed) return;

    try {
      const success = await PropertyService.deleteWithConfirm(id);
      if (success) {
        await loadProperties();
      }
    } catch (error) {
      console.error('Fehler beim Löschen:', error);
    }
  };

  if (isLoading) {
    return <LoadingState />;
  }

  if (error) {
    return (
      <ErrorState
        title="Fehler beim Laden"
        message={error.message}
        onRetry={loadProperties}
      />
    );
  }

  return (
    <div className="p-4 max-w-5xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-2">
          <Building2 className="w-6 h-6" />
          <h1 className="text-2xl font-bold">Immobilien</h1>
        </div>
        <Button
          onClick={() => navigate('/properties/new')}
          className="flex items-center gap-2"
        >
          <PlusCircle className="w-4 h-4" />
          Neue Immobilie
        </Button>
      </div>

      {properties.length === 0 ? (
        <EmptyState
          title="Keine Immobilien vorhanden"
          description="Fügen Sie Ihre erste Immobilie hinzu"
          icon={<Building2 className="w-12 h-12 text-muted-foreground" />}
          action={{
            label: 'Erste Immobilie hinzufügen',
            onClick: () => navigate('/properties/new')
          }}
        />
      ) : (
        <div className="grid gap-4">
          {properties.map(property => (
            <PropertyCard
              key={property.id}
              property={property}
              isExpanded={expandedProperty === property.id}
              onToggleExpand={() => setExpandedProperty(
                expandedProperty === property.id ? null : property.id
              )}
              onEdit={() => navigate(`/properties/edit/${property.id}`)}
              onDelete={() => handleDelete(property.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
```

# frontend/src/components/Mieter/TenantCard.tsx

```tsx
// src/components/Mieter/TenantCard.tsx
import { Tenant } from '@/types/tenant';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Eye, Pencil, Mail, Phone, MapPin } from 'lucide-react';
import { formatDate } from '@/lib/formatters';

interface TenantCardProps {
  tenant: Tenant;
  onEdit: () => void;
  onView: () => void;
}

export function TenantCard({ tenant, onEdit, onView }: TenantCardProps) {
  return (
    <Card className="hover:shadow-md transition-shadow duration-200">
      <CardContent className="p-4">
        <div className="flex justify-between items-start">
          <div>
            <h3 className="font-semibold text-lg">
              {tenant.first_name} {tenant.last_name}
            </h3>
            {tenant.unit_id && (
              <p className="text-sm text-muted-foreground">
                Seit {formatDate(tenant.rent_start_date)}
              </p>
            )}
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onView}
              className="flex items-center gap-1"
            >
              <Eye className="w-4 h-4" />
              <span className="hidden sm:inline">Details</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={onEdit}
              className="flex items-center gap-1"
            >
              <Pencil className="w-4 h-4" />
              <span className="hidden sm:inline">Bearbeiten</span>
            </Button>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="flex items-center gap-2 text-sm">
            <Mail className="w-4 h-4 text-muted-foreground" />
            <a href={`mailto:${tenant.email}`} className="hover:underline">
              {tenant.email}
            </a>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Phone className="w-4 h-4 text-muted-foreground" />
            <a href={`tel:${tenant.phone}`} className="hover:underline">
              {tenant.phone}
            </a>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <MapPin className="w-4 h-4 text-muted-foreground" />
            <span>{tenant.address}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
```

# frontend/src/components/Mieter/TenantDetail.tsx

```tsx
// src/components/Mieter/TenantDetail.tsx
import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Users, Mail, Phone, MapPin, Home, Calendar } from 'lucide-react';
import { Tenant } from '@/types/tenant';
import { useAsync } from '@/hooks/useAsync';
import { TenantService } from '@/services/TenantService';
import { LoadingState } from '@/components/ui/LoadingState';
import { ErrorState } from '@/components/ui/ErrorState';
import { formatDate } from '@/lib/formatters';

export default function TenantDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [tenant, setTenant] = useState<Tenant | null>(null);

  const { execute: fetchTenant, isLoading, error } = useAsync(
    () => TenantService.getById(Number(id)),
    {
      errorMessage: 'Fehler beim Laden des Mieters'
    }
  );

  useEffect(() => {
    if (id) {
      loadTenant();
    }
  }, [id]);

  const loadTenant = async () => {
    try {
      const data = await fetchTenant();
      setTenant(data);
    } catch (error) {
      console.error('Fehler beim Laden:', error);
    }
  };

  if (isLoading) {
    return <LoadingState />;
  }

  if (error || !tenant) {
    return (
      <ErrorState
        title="Fehler beim Laden"
        message={error?.message || 'Mieter nicht gefunden'}
        onRetry={loadTenant}
      />
    );
  }

  return (
    <div className="p-4 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <Button
          variant="ghost"
          onClick={() => navigate('/tenants')}
          className="mb-4"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Zurück zur Übersicht
        </Button>
        
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Users className="w-6 h-6" />
              {tenant.first_name} {tenant.last_name}
            </h1>
            {tenant.unit_id && (
              <p className="text-muted-foreground mt-1">
                Mieter seit {formatDate(tenant.rent_start_date)}
              </p>
            )}
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => navigate(`/tenants/${tenant.id}/documents`)}
            >
              Dokumente
            </Button>
            <Button
              onClick={() => navigate(`/tenants/edit/${tenant.id}`)}
            >
              Bearbeiten
            </Button>
          </div>
        </div>
      </div>

      {/* Inhalt */}
      <div className="grid gap-6">
        {/* Kontaktinformationen */}
        <Card>
          <CardHeader>
            <CardTitle>Kontaktinformationen</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="flex items-center gap-3">
              <Mail className="w-5 h-5 text-muted-foreground" />
              <div>
                <p className="font-medium">E-Mail</p>
                <a href={`mailto:${tenant.email}`} className="text-primary hover:underline">
                  {tenant.email}
                </a>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Phone className="w-5 h-5 text-muted-foreground" />
              <div>
                <p className="font-medium">Telefon</p>
                <a href={`tel:${tenant.phone}`} className="text-primary hover:underline">
                  {tenant.phone}
                </a>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <MapPin className="w-5 h-5 text-muted-foreground" />
              <div>
                <p className="font-medium">Adresse</p>
                <p>{tenant.address}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Mietverhältnis */}
        {tenant.unit_id && (
          <Card>
            <CardHeader>
              <CardTitle>Mietverhältnis</CardTitle>
            </CardHeader>
            <CardContent className="grid sm:grid-cols-3 gap-4">
              <div className="flex items-center gap-3">
                <Home className="w-5 h-5 text-muted-foreground" />
                <div>
                  <p className="font-medium">Wohneinheit</p>
                  <p className="text-muted-foreground">
                    {/* TODO: Unit-Details ergänzen */}
                    Wohneinheit {tenant.unit_id}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Calendar className="w-5 h-5 text-muted-foreground" />
                <div>
                  <p className="font-medium">Mietbeginn</p>
                  <p className="text-muted-foreground">
                    {formatDate(tenant.rent_start_date)}
                  </p>
                </div>
              </div>
              {tenant.rent_end_date && (
                <div className="flex items-center gap-3">
                  <Calendar className="w-5 h-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium">Mietende</p>
                    <p className="text-muted-foreground">
                      {formatDate(tenant.rent_end_date)}
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
```

# frontend/src/components/Mieter/TenantEditWrapper.tsx

```tsx
// src/components/Mieter/TenantEditWrapper.tsx
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import TenantForm from './TenantForm';
import { Tenant } from '@/types/tenant';
import { useAsync } from '@/hooks/useAsync';
import { TenantService } from '@/services/TenantService';
import { LoadingState } from '@/components/ui/LoadingState';
import { ErrorState } from '@/components/ui/ErrorState';

export default function TenantEditWrapper() {
  const { id } = useParams<{ id: string }>();
  const [tenant, setTenant] = useState<Tenant | null>(null);

  const { execute: fetchTenant, isLoading, error } = useAsync(
    () => TenantService.getById(Number(id)),
    {
      errorMessage: 'Fehler beim Laden des Mieters'
    }
  );

  useEffect(() => {
    if (id) {
      loadTenant();
    }
  }, [id]);

  const loadTenant = async () => {
    try {
      const data = await fetchTenant();
      setTenant(data);
    } catch (error) {
      console.error('Fehler beim Laden:', error);
    }
  };

  if (isLoading) {
    return <LoadingState />;
  }

  if (error || !tenant) {
    return (
      <ErrorState
        title="Fehler beim Laden"
        message={error?.message || 'Mieter nicht gefunden'}
        onRetry={loadTenant}
      />
    );
  }

  return <TenantForm initialData={tenant} />;
}
```

# frontend/src/components/Mieter/TenantForm.tsx

```tsx
// src/components/Mieter/TenantForm.tsx
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TenantService } from '@/services/TenantService';
import { PropertyService } from '@/services/PropertyService';
import { useAsync } from '@/hooks/useAsync';
import { useFormState } from '@/hooks/useFormState';
import { useConfirmation } from '@/hooks/useConfirmation';
import { Tenant, TenantFormData } from '@/types/tenant';
import { Property, Unit } from '@/types/property';
import { required, email, phone } from '@/lib/validators';

interface TenantFormProps {
  initialData?: Tenant;
}

// Erweiterte Unit-Schnittstelle mit property_address
interface UnitWithPropertyAddress extends Unit {
  property_address?: string;
}

const INITIAL_TENANT_DATA: TenantFormData = {
  first_name: '',
  last_name: '',
  email: '',
  phone: '',
  address: '',
  unit_id: null,
  rent_start_date: new Date().toISOString().split('T')[0],
  rent_end_date: null
};

export default function TenantForm({ initialData }: TenantFormProps) {
  const navigate = useNavigate();
  const [availableUnits, setAvailableUnits] = useState<UnitWithPropertyAddress[]>([]);
  
  const {
    formData,
    updateField,
    errors,
    setErrors,
    validateField
  } = useFormState<TenantFormData>(
    initialData || INITIAL_TENANT_DATA
  );

  // API calls
  const { execute: saveTenant, isLoading: isSaving } = useAsync(
    async (data: TenantFormData) => {
      if (initialData) {
        return TenantService.update(initialData.id, data);
      }
      return TenantService.create(data);
    },
    {
      successMessage: initialData 
        ? 'Mieter wurde erfolgreich aktualisiert'
        : 'Mieter wurde erfolgreich erstellt',
      errorMessage: 'Fehler beim Speichern des Mieters'
    }
  );

  const { execute: fetchAvailableUnits } = useAsync(
    () => PropertyService.getAll(),
    {
      errorMessage: 'Fehler beim Laden der verfügbaren Wohneinheiten'
    }
  );

  // Confirmation Dialog
  const confirmDiscardDialog = useConfirmation({
    title: 'Änderungen verwerfen?',
    message: 'Möchten Sie die Bearbeitung wirklich abbrechen? Alle nicht gespeicherten Änderungen gehen verloren.',
    confirmText: 'Verwerfen',
    cancelText: 'Weiter bearbeiten'
  });

  // Load available units on mount
  useEffect(() => {
    loadAvailableUnits();
  }, []);

  const loadAvailableUnits = async () => {
    try {
      const properties = await fetchAvailableUnits();
      const units = properties.flatMap(property => 
        property.units
          .filter(unit => unit.status === 'verfügbar' || unit.id === initialData?.unit_id)
          .map(unit => ({
            ...unit,
            property_address: property.address
          }))
      );
      setAvailableUnits(units);
    } catch (error) {
      console.error('Fehler beim Laden der Wohneinheiten:', error);
    }
  };

  // Form validation
  const validateForm = (): boolean => {
    let isValid = true;
    const newErrors: Partial<Record<keyof TenantFormData, string>> = {};

    // Required fields
    if (!required(formData.first_name)) {
      newErrors.first_name = 'Vorname ist erforderlich';
      isValid = false;
    }

    if (!required(formData.last_name)) {
      newErrors.last_name = 'Nachname ist erforderlich';
      isValid = false;
    }

    const emailError = email(formData.email);
    if (emailError) {
      newErrors.email = emailError;
      isValid = false;
    }

    const phoneError = phone(formData.phone);
    if (phoneError) {
      newErrors.phone = phoneError;
      isValid = false;
    }

    if (!required(formData.address)) {
      newErrors.address = 'Adresse ist erforderlich';
      isValid = false;
    }

    if (!required(formData.rent_start_date)) {
      newErrors.rent_start_date = 'Mietbeginn ist erforderlich';
      isValid = false;
    }

    setErrors(newErrors);
    return isValid;
  };

  // Form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    try {
      // Ensure proper format for form data
      const submissionData = {
        ...formData,
        // Convert string ID to number if present and not null
        unit_id: formData.unit_id ? Number(formData.unit_id) : null,
        active: true // Ensure active status is set
      };

      // Log submission data for debugging
      console.log('Submitting tenant data:', submissionData);
      
      const result = await saveTenant(submissionData);
      console.log('Tenant saved successfully:', result);
      navigate('/tenants');
    } catch (error) {
      console.error('Error during form submission:', error);
      // Error already handled by useAsync
    }
  };

  // Cancel handling
  const handleCancel = async () => {
    const hasChanges = JSON.stringify(initialData) !== JSON.stringify(formData);
    if (hasChanges) {
      const confirmed = await confirmDiscardDialog.confirm();
      if (!confirmed) return;
    }
    navigate('/tenants');
  };

  return (
    <div className="p-4 max-w-3xl mx-auto">
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Persönliche Informationen */}
        <Card>
          <CardHeader>
            <CardTitle>
              {initialData ? 'Mieter bearbeiten' : 'Neuer Mieter'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              {/* Vorname */}
              <div>
                <label className="text-sm font-medium">Vorname</label>
                <Input
                  value={formData.first_name}
                  onChange={e => updateField('first_name', e.target.value)}
                  className="mt-1"
                  disabled={isSaving}
                />
                {errors.first_name && (
                  <p className="text-sm text-destructive mt-1">{errors.first_name}</p>
                )}
              </div>

              {/* Nachname */}
              <div>
                <label className="text-sm font-medium">Nachname</label>
                <Input
                  value={formData.last_name}
                  onChange={e => updateField('last_name', e.target.value)}
                  className="mt-1"
                  disabled={isSaving}
                />
                {errors.last_name && (
                  <p className="text-sm text-destructive mt-1">{errors.last_name}</p>
                )}
              </div>

              {/* Email */}
              <div>
                <label className="text-sm font-medium">E-Mail</label>
                <Input
                  type="email"
                  value={formData.email}
                  onChange={e => updateField('email', e.target.value)}
                  className="mt-1"
                  disabled={isSaving}
                />
                {errors.email && (
                  <p className="text-sm text-destructive mt-1">{errors.email}</p>
                )}
              </div>

              {/* Telefon */}
              <div>
                <label className="text-sm font-medium">Telefon</label>
                <Input
                  type="tel"
                  value={formData.phone}
                  onChange={e => updateField('phone', e.target.value)}
                  className="mt-1"
                  disabled={isSaving}
                />
                {errors.phone && (
                  <p className="text-sm text-destructive mt-1">{errors.phone}</p>
                )}
              </div>

              {/* Adresse */}
              <div className="col-span-2">
                <label className="text-sm font-medium">Adresse</label>
                <Input
                  value={formData.address}
                  onChange={e => updateField('address', e.target.value)}
                  className="mt-1"
                  disabled={isSaving}
                />
                {errors.address && (
                  <p className="text-sm text-destructive mt-1">{errors.address}</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Mietverhältnis */}
        <Card>
          <CardHeader>
            <CardTitle>Mietverhältnis</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Wohneinheit */}
            <div>
              <label className="text-sm font-medium">Wohneinheit</label>
              <Select
                value={formData.unit_id?.toString() || ''}
                onValueChange={(value) => updateField('unit_id', value ? parseInt(value) : null)}
                disabled={isSaving}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Wohneinheit wählen" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Keine Wohneinheit</SelectItem>
                  {availableUnits.map((unit) => (
                    <SelectItem key={unit.id} value={unit.id.toString()}>
                      {unit.name} ({unit.property_address})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Mietbeginn */}
              <div>
                <label className="text-sm font-medium">Mietbeginn</label>
                <Input
                  type="date"
                  value={formData.rent_start_date}
                  onChange={e => updateField('rent_start_date', e.target.value)}
                  className="mt-1"
                  disabled={isSaving}
                />
                {errors.rent_start_date && (
                  <p className="text-sm text-destructive mt-1">{errors.rent_start_date}</p>
                )}
              </div>

              {/* Mietende */}
              <div>
                <label className="text-sm font-medium">Mietende (optional)</label>
                <Input
                  type="date"
                  value={formData.rent_end_date || ''}
                  onChange={e => updateField('rent_end_date', e.target.value || null)}
                  className="mt-1"
                  disabled={isSaving}
                />
                {errors.rent_end_date && (
                  <p className="text-sm text-destructive mt-1">{errors.rent_end_date}</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Form Buttons */}
        <div className="flex justify-end gap-4">
          <Button
            type="submit"
            disabled={isSaving}
          >
            {isSaving ? 'Wird gespeichert...' : 'Speichern'}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={handleCancel}
            disabled={isSaving}
          >
            Abbrechen
          </Button>
        </div>
      </form>
    </div>
  );
}
```

# frontend/src/components/Mieter/TenantList.tsx

```tsx
// src/components/Mieter/TenantList.tsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { UserPlus, Users, Search } from 'lucide-react';
import { Tenant } from '@/types/tenant';
import { useAsync } from '@/hooks/useAsync';
import { TenantService } from '@/services/TenantService';
import { TenantCard } from '@/components/Mieter/TenantCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingState } from '@/components/ui/LoadingState';
import { ErrorState } from '@/components/ui/ErrorState';
import { API } from '@/services/api';

export default function TenantList() {
  const navigate = useNavigate();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  const { execute: fetchTenants, isLoading, error } = useAsync<Tenant[]>(
    () => TenantService.getAll(),
    {
      errorMessage: 'Fehler beim Laden der Mieter',
      loadingTimeout: API.loadingStateTimeout
    }
  );

  useEffect(() => {
    loadTenants();
  }, []);

  const loadTenants = async () => {
    try {
      const data = await fetchTenants();
      setTenants(data);
    } catch (error) {
      console.error('Fehler beim Laden:', error);
    }
  };

  const filteredTenants = tenants.filter(tenant => 
    tenant.first_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    tenant.last_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    tenant.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (isLoading) {
    return <LoadingState />;
  }

  if (error) {
    return (
      <ErrorState
        title="Fehler beim Laden"
        message={error.message}
        onRetry={loadTenants}
      />
    );
  }

  return (
    <div className="p-4 max-w-5xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-2">
          <Users className="w-6 h-6" />
          <h1 className="text-2xl font-bold">Mieter</h1>
        </div>
        <Button
          onClick={() => navigate('/tenants/new')}
          className="flex items-center gap-2"
        >
          <UserPlus className="w-4 h-4" />
          Neuer Mieter
        </Button>
      </div>

      {/* Suchleiste */}
      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Mieter suchen..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {tenants.length === 0 ? (
        <EmptyState
          title="Keine Mieter vorhanden"
          description="Fügen Sie Ihren ersten Mieter hinzu"
          icon={<Users className="w-12 h-12 text-muted-foreground" />}
          action={{
            label: 'Ersten Mieter hinzufügen',
            onClick: () => navigate('/tenants/new')
          }}
        />
      ) : filteredTenants.length === 0 ? (
        <Card className="p-6 text-center">
          <p className="text-muted-foreground">
            Keine Mieter gefunden für "{searchTerm}"
          </p>
        </Card>
      ) : (
        <div className="grid gap-4">
          {filteredTenants.map(tenant => (
            <TenantCard
              key={tenant.id}
              tenant={tenant}
              onEdit={() => navigate(`/tenants/edit/${tenant.id}`)}
              onView={() => navigate(`/tenants/${tenant.id}`)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
```

# frontend/src/components/Mitarbeiter/WorkerCard.tsx

```tsx
// src/components/Mitarbeiter/WorkerCard.tsx
import { Worker } from '@/types/worker';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Eye, Pencil, Mail, Phone, Euro, Wrench } from 'lucide-react';
import { formatCurrency } from '@/lib/formatters';

interface WorkerCardProps {
  worker: Worker;
  onEdit: () => void;
  onView: () => void;
}

export function WorkerCard({ worker, onEdit, onView }: WorkerCardProps) {
  return (
    <Card className="hover:shadow-md transition-shadow duration-200">
      <CardContent className="p-4">
        <div className="flex justify-between items-start">
          <div>
            <h3 className="font-semibold text-lg">
              {worker.first_name} {worker.last_name}
            </h3>
            <div className="flex gap-2 mt-1">
              {worker.skills.map((skill, index) => (
                <span 
                  key={skill.id}
                  className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-secondary"
                >
                  {skill.name} ({skill.experience_years}J)
                </span>
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onView}
              className="flex items-center gap-1"
            >
              <Eye className="w-4 h-4" />
              <span className="hidden sm:inline">Details</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={onEdit}
              className="flex items-center gap-1"
            >
              <Pencil className="w-4 h-4" />
              <span className="hidden sm:inline">Bearbeiten</span>
            </Button>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="flex items-center gap-2 text-sm">
            <Mail className="w-4 h-4 text-muted-foreground" />
            <a href={`mailto:${worker.email}`} className="hover:underline">
              {worker.email}
            </a>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Phone className="w-4 h-4 text-muted-foreground" />
            <a href={`tel:${worker.phone}`} className="hover:underline">
              {worker.phone}
            </a>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Euro className="w-4 h-4 text-muted-foreground" />
            <span>{formatCurrency(worker.hourly_rate)}/Std.</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

```

# frontend/src/components/Mitarbeiter/WorkerDetail.tsx

```tsx
// src/components/Mitarbeiter/WorkerDetail.tsx
import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  ArrowLeft, 
  Wrench, 
  Mail, 
  Phone, 
  Euro, 
  Clock,
  Calendar,
  CheckCircle,
  XCircle
} from 'lucide-react';
import { Worker } from '@/types/worker';
import { useAsync } from '@/hooks/useAsync';
import { WorkerService } from '@/services/WorkerService';
import { LoadingState } from '@/components/ui/LoadingState';
import { ErrorState } from '@/components/ui/ErrorState';
import { formatCurrency } from '@/lib/formatters';

export default function WorkerDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [worker, setWorker] = useState<Worker | null>(null);

  const { execute: fetchWorker, isLoading, error } = useAsync(
    () => WorkerService.getById(Number(id)),
    {
      errorMessage: 'Fehler beim Laden des Handwerkers'
    }
  );

  useEffect(() => {
    if (id) {
      loadWorker();
    }
  }, [id]);

  const loadWorker = async () => {
    try {
      const data = await fetchWorker();
      setWorker(data);
    } catch (error) {
      console.error('Fehler beim Laden:', error);
    }
  };

  if (isLoading) {
    return <LoadingState />;
  }

  if (error || !worker) {
    return (
      <ErrorState
        title="Fehler beim Laden"
        message={error?.message || 'Handwerker nicht gefunden'}
        onRetry={loadWorker}
      />
    );
  }

  return (
    <div className="p-4 max-w-5xl mx-auto">
      {/* Header mit Navigation und Aktionen */}
      <div className="mb-6">
        <Button
          variant="ghost"
          onClick={() => navigate('/workers')}
          className="mb-4"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Zurück zur Übersicht
        </Button>
        
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Wrench className="w-6 h-6" />
              {worker.first_name} {worker.last_name}
            </h1>
            <div className="flex items-center gap-2 mt-1">
              <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-sm ${
                worker.active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
              }`}>
                {worker.active ? (
                  <CheckCircle className="w-4 h-4" />
                ) : (
                  <XCircle className="w-4 h-4" />
                )}
                {worker.active ? 'Aktiv' : 'Inaktiv'}
              </span>
              <span className="text-muted-foreground">
                Stundensatz: {formatCurrency(worker.hourly_rate)}/Std.
              </span>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => navigate(`/workers/${worker.id}/assignments`)}
            >
              Aufträge
            </Button>
            <Button
              onClick={() => navigate(`/workers/edit/${worker.id}`)}
            >
              Bearbeiten
            </Button>
          </div>
        </div>
      </div>

      {/* Hauptinhalt */}
      <div className="grid gap-6">
        {/* Kontaktinformationen */}
        <Card>
          <CardHeader>
            <CardTitle>Kontaktinformationen</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="flex items-center gap-3">
              <Mail className="w-5 h-5 text-muted-foreground" />
              <div>
                <p className="font-medium">E-Mail</p>
                <a 
                  href={`mailto:${worker.email}`} 
                  className="text-primary hover:underline"
                >
                  {worker.email}
                </a>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Phone className="w-5 h-5 text-muted-foreground" />
              <div>
                <p className="font-medium">Telefon</p>
                <a 
                  href={`tel:${worker.phone}`} 
                  className="text-primary hover:underline"
                >
                  {worker.phone}
                </a>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Euro className="w-5 h-5 text-muted-foreground" />
              <div>
                <p className="font-medium">Stundensatz</p>
                <p>{formatCurrency(worker.hourly_rate)}/Std.</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Fähigkeiten */}
        <Card>
          <CardHeader>
            <CardTitle>Fähigkeiten & Qualifikationen</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4">
              {worker.skills.map((skill) => (
                <div 
                  key={skill.id}
                  className="flex items-center justify-between p-4 bg-secondary/50 rounded-lg hover:bg-secondary transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <Wrench className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">{skill.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {skill.experience_years} Jahre Erfahrung
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-background">
                    <Clock className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm font-medium">
                      {skill.experience_years} Jahre
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Verfügbarkeit und Termine */}
        <Card>
          <CardHeader>
            <CardTitle>Verfügbarkeit & Termine</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4">
              {/* TODO: Kalenderintegration */}
              <p className="text-muted-foreground text-center py-4">
                Kalenderfunktion wird in Kürze verfügbar sein
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Dokumente */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Dokumente</CardTitle>
            <Button variant="outline" size="sm">
              Dokument hinzufügen
            </Button>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4">
              {/* TODO: Dokumentenliste */}
              <p className="text-muted-foreground text-center py-4">
                Noch keine Dokumente vorhanden
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
```

# frontend/src/components/Mitarbeiter/WorkerEditWrapper.tsx

```tsx
// src/components/Mitarbeiter/WorkerEditWrapper.tsx
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import WorkerForm from './WorkerForm';
import { Worker } from '@/types/worker';
import { useAsync } from '@/hooks/useAsync';
import { WorkerService } from '@/services/WorkerService';
import { LoadingState } from '@/components/ui/LoadingState';
import { ErrorState } from '@/components/ui/ErrorState';

export default function WorkerEditWrapper() {
  const { id } = useParams<{ id: string }>();
  const [worker, setWorker] = useState<Worker | null>(null);

  const { execute: fetchWorker, isLoading, error } = useAsync(
    () => WorkerService.getById(Number(id)),
    {
      errorMessage: 'Fehler beim Laden des Handwerkers'
    }
  );

  useEffect(() => {
    if (id) {
      loadWorker();
    }
  }, [id]);

  const loadWorker = async () => {
    try {
      const data = await fetchWorker();
      setWorker(data);
    } catch (error) {
      console.error('Fehler beim Laden:', error);
    }
  };

  if (isLoading) {
    return <LoadingState />;
  }

  if (error || !worker) {
    return (
      <ErrorState
        title="Fehler beim Laden"
        message={error?.message || 'Handwerker nicht gefunden'}
        onRetry={loadWorker}
      />
    );
  }

  return <WorkerForm initialData={worker} />;
}
```

# frontend/src/components/Mitarbeiter/WorkerForm.tsx

```tsx
// src/components/Mitarbeiter/WorkerForm.tsx
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, X } from 'lucide-react';
import { WorkerService } from '@/services/WorkerService';
import { useAsync } from '@/hooks/useAsync';
import { useFormState } from '@/hooks/useFormState';
import { useConfirmation } from '@/hooks/useConfirmation';
import { Worker, WorkerFormData, Skill, WorkerSkill } from '@/types/worker';
import { required, email, phone, number } from '@/lib/validators';

interface WorkerFormProps {
  initialData?: Worker;
}

const INITIAL_WORKER_DATA: WorkerFormData = {
  first_name: '',
  last_name: '',
  email: '',
  phone: '',
  hourly_rate: '',
  skills: [],
  active: true
};

const INITIAL_SKILL: WorkerSkill = {
  id: 0,
  name: '',
  experience_years: 0
};

export default function WorkerForm({ initialData }: WorkerFormProps) {
  const navigate = useNavigate();
  const [availableSkills, setAvailableSkills] = useState<Skill[]>([]);

  // Form state mit initialData oder default values
  const {
    formData,
    updateField,
    errors,
    setErrors,
    validateField,
    resetForm
  } = useFormState<WorkerFormData>(
    initialData || INITIAL_WORKER_DATA
  );

  // API calls mit useAsync
  const { execute: saveWorker, isLoading: isSaving } = useAsync(
    async (data: WorkerFormData) => {
      if (initialData) {
        return WorkerService.update(initialData.id, data);
      }
      return WorkerService.create(data);
    },
    {
      successMessage: initialData 
        ? 'Handwerker wurde erfolgreich aktualisiert'
        : 'Handwerker wurde erfolgreich erstellt',
      errorMessage: 'Fehler beim Speichern des Handwerkers'
    }
  );

  const { execute: fetchSkills } = useAsync(
    () => WorkerService.getSkills(),
    {
      errorMessage: 'Fehler beim Laden der verfügbaren Fähigkeiten'
    }
  );

  // Confirmation Dialog
  const confirmDiscardDialog = useConfirmation({
    title: 'Änderungen verwerfen?',
    message: 'Möchten Sie die Bearbeitung wirklich abbrechen? Alle nicht gespeicherten Änderungen gehen verloren.',
    confirmText: 'Verwerfen',
    cancelText: 'Weiter bearbeiten'
  });

  // Load skills on mount
  useEffect(() => {
    loadSkills();
  }, []);

  const loadSkills = async () => {
    try {
      const skills = await fetchSkills();
      setAvailableSkills(skills);
    } catch (error) {
      console.error('Fehler beim Laden der Fähigkeiten:', error);
    }
  };

  // Form validation
  const validateForm = (): boolean => {
    let isValid = true;
    const newErrors: Partial<Record<keyof WorkerFormData, string>> = {};

    // Required fields
    if (!required(formData.first_name)) {
      newErrors.first_name = 'Vorname ist erforderlich';
      isValid = false;
    }

    if (!required(formData.last_name)) {
      newErrors.last_name = 'Nachname ist erforderlich';
      isValid = false;
    }

    const emailError = email(formData.email);
    if (emailError) {
      newErrors.email = emailError;
      isValid = false;
    }

    const phoneError = phone(formData.phone);
    if (phoneError) {
      newErrors.phone = phoneError;
      isValid = false;
    }

    if (!number(String(formData.hourly_rate))) {
      newErrors.hourly_rate = 'Gültiger Stundensatz erforderlich';
      isValid = false;
    }

    // At least one skill required
    if (formData.skills.length === 0) {
      newErrors.skills = 'Mindestens eine Fähigkeit ist erforderlich';
      isValid = false;
    }

    setErrors(newErrors);
    return isValid;
  };

 // src/components/Mitarbeiter/WorkerForm.tsx (Form submission part)

// Replace the handleSubmit function in WorkerForm.tsx with this improved version:

const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  
  if (!validateForm()) {
    return;
  }

  try {
    // Format skills properly, ensuring each skill has proper numeric values
    const formattedSkills = formData.skills.map(skill => ({
      id: typeof skill.id === 'string' ? parseInt(skill.id) : Number(skill.id),
      experience_years: typeof skill.experience_years === 'string' 
        ? parseInt(skill.experience_years) 
        : Number(skill.experience_years)
    }));

    // Create a clean submission object with proper types
    const submissionData = {
      ...formData,
      hourly_rate: typeof formData.hourly_rate === 'string' 
        ? parseFloat(formData.hourly_rate) 
        : formData.hourly_rate,
      skills: formattedSkills,
      active: formData.active !== undefined ? formData.active : true
    };

    // Log submission data for debugging
    console.log('Submitting worker data:', submissionData);
    
    const result = await saveWorker(submissionData);
    console.log('Worker saved successfully:', result);
    navigate('/workers');
  } catch (error) {
    console.error('Error during form submission:', error);
    // Error already handled by useAsync
  }
};

  // Cancel handling
  const handleCancel = async () => {
    const hasChanges = JSON.stringify(initialData) !== JSON.stringify(formData);
    if (hasChanges) {
      const confirmed = await confirmDiscardDialog.confirm();
      if (!confirmed) return;
    }
    navigate('/workers');
  };

  // Skill management
  const addSkill = () => {
    updateField('skills', [...formData.skills, { ...INITIAL_SKILL }]);
  };

  const removeSkill = (index: number) => {
    const newSkills = formData.skills.filter((_, i) => i !== index);
    updateField('skills', newSkills);
  };

  const updateSkill = (index: number, field: keyof WorkerSkill, value: any) => {
    const newSkills = formData.skills.map((skill, i) => {
      if (i !== index) return skill;
      
      // Make sure we're handling skill IDs consistently
      if (field === 'id') {
        const skillId = typeof value === 'string' ? parseInt(value) : Number(value);
        
        // If we have a skill name in the available skills, include it
        const selectedSkill = availableSkills.find(s => s.id === skillId);
        if (selectedSkill) {
          return { 
            ...skill, 
            id: skillId,
            name: selectedSkill.name 
          };
        }
        
        return { ...skill, id: skillId };
      }
      
      return { ...skill, [field]: value };
    });
    
    updateField('skills', newSkills);
  };

  return (
    <div className="p-4 max-w-3xl mx-auto">
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Persönliche Informationen */}
        <Card>
          <CardHeader>
            <CardTitle>
              {initialData ? 'Handwerker bearbeiten' : 'Neuer Handwerker'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              {/* Vorname */}
              <div>
                <label className="text-sm font-medium">Vorname</label>
                <Input
                  value={formData.first_name}
                  onChange={e => updateField('first_name', e.target.value)}
                  className="mt-1"
                  disabled={isSaving}
                />
                {errors.first_name && (
                  <p className="text-sm text-destructive mt-1">{errors.first_name}</p>
                )}
              </div>

              {/* Nachname */}
              <div>
                <label className="text-sm font-medium">Nachname</label>
                <Input
                  value={formData.last_name}
                  onChange={e => updateField('last_name', e.target.value)}
                  className="mt-1"
                  disabled={isSaving}
                />
                {errors.last_name && (
                  <p className="text-sm text-destructive mt-1">{errors.last_name}</p>
                )}
              </div>

              {/* Email */}
              <div>
                <label className="text-sm font-medium">E-Mail</label>
                <Input
                  type="email"
                  value={formData.email}
                  onChange={e => updateField('email', e.target.value)}
                  className="mt-1"
                  disabled={isSaving}
                />
                {errors.email && (
                  <p className="text-sm text-destructive mt-1">{errors.email}</p>
                )}
              </div>

              {/* Telefon */}
              <div>
                <label className="text-sm font-medium">Telefon</label>
                <Input
                  type="tel"
                  value={formData.phone}
                  onChange={e => updateField('phone', e.target.value)}
                  className="mt-1"
                  disabled={isSaving}
                />
                {errors.phone && (
                  <p className="text-sm text-destructive mt-1">{errors.phone}</p>
                )}
              </div>

              {/* Stundensatz */}
              <div>
                <label className="text-sm font-medium">Stundensatz (€)</label>
                <Input
                  type="number"
                  value={formData.hourly_rate}
                  onChange={e => updateField('hourly_rate', parseFloat(e.target.value))}
                  className="mt-1"
                  min="0"
                  step="0.01"
                  disabled={isSaving}
                />
                {errors.hourly_rate && (
                  <p className="text-sm text-destructive mt-1">{errors.hourly_rate}</p>
                )}
              </div>

              {/* Status */}
              <div>
                <label className="text-sm font-medium">Status</label>
                <Select
                  value={formData.active ? 'active' : 'inactive'}
                  onValueChange={(value) => updateField('active', value === 'active')}
                  disabled={isSaving}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Status wählen" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Aktiv</SelectItem>
                    <SelectItem value="inactive">Inaktiv</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Fähigkeiten */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Fähigkeiten</CardTitle>
            <Button
              type="button"
              onClick={addSkill}
              disabled={isSaving}
              className="flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Fähigkeit hinzufügen
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {formData.skills.map((skill, index) => (
                <div 
                  key={index}
                  className="flex items-end gap-4 p-4 bg-secondary/50 rounded-lg"
                >
                  <div className="flex-1">
                    <label className="text-sm font-medium">Fähigkeit</label>
                    <Select
                      value={skill.id.toString()}
                      onValueChange={(value) => updateSkill(index, 'id', parseInt(value))}
                      disabled={isSaving}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Fähigkeit wählen" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableSkills.map((availableSkill) => (
                          <SelectItem 
                            key={availableSkill.id} 
                            value={availableSkill.id.toString()}
                          >
                            {availableSkill.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="w-32">
                    <label className="text-sm font-medium">Jahre Erfahrung</label>
                    <Input
                      type="number"
                      value={skill.experience_years}
                      onChange={(e) => updateSkill(index, 'experience_years', parseInt(e.target.value))}
                      className="mt-1"
                      min="0"
                      disabled={isSaving}
                    />
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => removeSkill(index)}
                    disabled={isSaving}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ))}

              {errors.skills && (
                <p className="text-sm text-destructive">{errors.skills}</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Form Buttons */}
        <div className="flex justify-end gap-4">
          <Button
            type="submit"
            disabled={isSaving}
          >
            {isSaving ? 'Wird gespeichert...' : 'Speichern'}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={handleCancel}
            disabled={isSaving}
          >
            Abbrechen
          </Button>
        </div>
      </form>
    </div>
  );
}
```

# frontend/src/components/Mitarbeiter/WorkerList.tsx

```tsx
// src/components/Mitarbeiter/WorkerList.tsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  UserPlus, 
  Users, 
  Search, 
  Wrench,
  Filter
} from 'lucide-react';
import { Worker } from '@/types/worker';
import { useAsync } from '@/hooks/useAsync';
import { WorkerService } from '@/services/WorkerService';
import { WorkerCard } from '@/components/Mitarbeiter/WorkerCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingState } from '@/components/ui/LoadingState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { API } from '@/services/api';

export default function WorkerList() {
  const navigate = useNavigate();
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSkill, setSelectedSkill] = useState<string>('all');
  const [availableSkills, setAvailableSkills] = useState<Array<{ id: number; name: string }>>([]);

  const { execute: fetchWorkers, isLoading, error } = useAsync<Worker[]>(
    () => WorkerService.getAll(),
    {
      errorMessage: 'Fehler beim Laden der Handwerker',
      loadingTimeout: API.loadingStateTimeout
    }
  );

  const { execute: fetchSkills } = useAsync(
    () => WorkerService.getSkills(),
    {
      errorMessage: 'Fehler beim Laden der Fähigkeiten',
      loadingTimeout: API.loadingStateTimeout
    }
  );

  useEffect(() => {
    loadWorkers();
    loadSkills();
  }, []);

  const loadWorkers = async () => {
    try {
      const data = await fetchWorkers();
      setWorkers(data);
    } catch (error) {
      console.error('Fehler beim Laden:', error);
    }
  };

  const loadSkills = async () => {
    try {
      const skills = await fetchSkills();
      setAvailableSkills(skills);
    } catch (error) {
      console.error('Fehler beim Laden der Fähigkeiten:', error);
    }
  };

  const filteredWorkers = workers.filter(worker => {
    const matchesSearch = (
      worker.first_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      worker.last_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      worker.email.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const matchesSkill = selectedSkill === 'all' || 
      worker.skills.some(skill => skill.id.toString() === selectedSkill);

    return matchesSearch && matchesSkill;
  });

  if (isLoading) {
    return <LoadingState />;
  }

  if (error) {
    return (
      <ErrorState
        title="Fehler beim Laden"
        message={error.message}
        onRetry={loadWorkers}
      />
    );
  }

  return (
    <div className="p-4 max-w-5xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-2">
          <Wrench className="w-6 h-6" />
          <h1 className="text-2xl font-bold">Handwerker</h1>
        </div>
        <Button
          onClick={() => navigate('/workers/new')}
          className="flex items-center gap-2"
        >
          <UserPlus className="w-4 h-4" />
          Neuer Handwerker
        </Button>
      </div>

      {/* Filter und Suche */}
      <div className="grid gap-4 mb-6 md:grid-cols-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Handwerker suchen..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="relative">
          <Select 
            value={selectedSkill}
            onValueChange={setSelectedSkill}
          >
            <SelectTrigger className="w-full">
              <Filter className="w-4 h-4 mr-2" />
              <SelectValue placeholder="Nach Fähigkeit filtern" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle Fähigkeiten</SelectItem>
              {availableSkills.map(skill => (
                <SelectItem key={skill.id} value={skill.id.toString()}>
                  {skill.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {workers.length === 0 ? (
        <EmptyState
          title="Keine Handwerker vorhanden"
          description="Fügen Sie Ihren ersten Handwerker hinzu"
          icon={<Wrench className="w-12 h-12 text-muted-foreground" />}
          action={{
            label: 'Ersten Handwerker hinzufügen',
            onClick: () => navigate('/workers/new')
          }}
        />
      ) : filteredWorkers.length === 0 ? (
        <Card className="p-6 text-center">
          <p className="text-muted-foreground">
            Keine Handwerker gefunden für Ihre Filterkriterien
          </p>
        </Card>
      ) : (
        <div className="grid gap-4">
          {filteredWorkers.map(worker => (
            <WorkerCard
              key={worker.id}
              worker={worker}
              onEdit={() => navigate(`/workers/edit/${worker.id}`)}
              onView={() => navigate(`/workers/${worker.id}`)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
```

# frontend/src/components/providers.tsx

```tsx
// src/components/providers.tsx
import * as React from "react"
import { Toaster } from "@/components/ui/Toaster"
import { TooltipProvider } from "@radix-ui/react-tooltip"

interface ProvidersProps {
  children: React.ReactNode
}

export function Providers({ children }: ProvidersProps) {
  return (
    <>
      <TooltipProvider>
        {children}
        <Toaster />
      </TooltipProvider>
    </>
  )
}
```

# frontend/src/components/Sidebar.tsx

```tsx
// src/components/Sidebar.tsx
import { useState } from 'react'
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Link, useLocation } from 'react-router-dom'
import { 
  ChevronRight, 
  HomeIcon, 
  Building2, 
  Settings, 
  Menu, 
  Users,
  FileText,
  Wrench  // Neues Icon für Handwerker
} from 'lucide-react';

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
      title: "Mieter",
      icon: <Users />,
      href: "/tenants"
    },
    {
      title: "Mitarbeiter",  // Neuer Menüpunkt
      icon: <Wrench />,
      href: "/workers"
    },
    {
      title: "Dokumente",
      icon: <FileText />, 
      href: "/documents"
    },
    {
      title: "Einstellungen",
      icon: <Settings />,
      href: "/settings"
    }
  ];

  return (
    <div className="flex min-h-screen">
      <div
        className={cn(
          "h-screen fixed top-0 left-0 bg-gray-900 text-white flex flex-col transition-all duration-300",
          collapsed ? "w-16" : "w-64"
        )}
      >
        <div className="flex items-center justify-between p-4 border-b border-gray-800">
          {!collapsed && <span className="text-xl font-bold">Manager 06</span>}
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

# frontend/src/components/ui/alert-dialog.tsx

```tsx
// src/components/ui/alert-dialog.tsx
import * as React from "react"
import * as AlertDialogPrimitive from "@radix-ui/react-alert-dialog"

import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"

const AlertDialog = AlertDialogPrimitive.Root

const AlertDialogTrigger = AlertDialogPrimitive.Trigger

const AlertDialogPortal = AlertDialogPrimitive.Portal

const AlertDialogOverlay = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <AlertDialogPrimitive.Overlay
    className={cn(
      "fixed inset-0 z-50 bg-black/80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className
    )}
    {...props}
    ref={ref}
  />
))
AlertDialogOverlay.displayName = AlertDialogPrimitive.Overlay.displayName

const AlertDialogContent = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Content>
>(({ className, ...props }, ref) => (
  <AlertDialogPortal>
    <AlertDialogOverlay />
    <AlertDialogPrimitive.Content
      ref={ref}
      className={cn(
        "fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] sm:rounded-lg",
        className
      )}
      {...props}
    />
  </AlertDialogPortal>
))
AlertDialogContent.displayName = AlertDialogPrimitive.Content.displayName

const AlertDialogHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col space-y-2 text-center sm:text-left",
      className
    )}
    {...props}
  />
)
AlertDialogHeader.displayName = "AlertDialogHeader"

const AlertDialogFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2",
      className
    )}
    {...props}
  />
)
AlertDialogFooter.displayName = "AlertDialogFooter"

const AlertDialogTitle = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <AlertDialogPrimitive.Title
    ref={ref}
    className={cn("text-lg font-semibold", className)}
    {...props}
  />
))
AlertDialogTitle.displayName = AlertDialogPrimitive.Title.displayName

const AlertDialogDescription = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <AlertDialogPrimitive.Description
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
))
AlertDialogDescription.displayName = AlertDialogPrimitive.Description.displayName

const AlertDialogAction = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Action>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Action>
>(({ className, ...props }, ref) => (
  <AlertDialogPrimitive.Action
    ref={ref}
    className={cn(buttonVariants(), className)}
    {...props}
  />
))
AlertDialogAction.displayName = AlertDialogPrimitive.Action.displayName

const AlertDialogCancel = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Cancel>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Cancel>
>(({ className, ...props }, ref) => (
  <AlertDialogPrimitive.Cancel
    ref={ref}
    className={cn(
      buttonVariants({ variant: "outline" }),
      "mt-2 sm:mt-0",
      className
    )}
    {...props}
  />
))
AlertDialogCancel.displayName = AlertDialogPrimitive.Cancel.displayName

export {
  AlertDialog,
  AlertDialogPortal,
  AlertDialogOverlay,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
}
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

# frontend/src/components/ui/EmptyState.tsx

```tsx
// src/components/ui/EmptyState.tsx
import { PlusCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";



interface EmptyStateProps {
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  icon?: React.ReactNode;
}

export function EmptyState({ title, description, action, icon }: EmptyStateProps) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center py-12">
        {icon && <div className="mb-4">{icon}</div>}
        <p className="text-lg font-medium mb-2">{title}</p>
        {description && (
          <p className="text-sm text-muted-foreground mb-4">{description}</p>
        )}
        {action && (
          <Button
            onClick={action.onClick}
            className="flex items-center gap-2"
          >
            <PlusCircle className="w-4 h-4" />
            {action.label}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
```

# frontend/src/components/ui/Error-Card.tsx

```tsx
import { AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"

interface ErrorStateProps {
  title?: string
  message?: string
  onRetry?: () => void
}

export function ErrorCard({ 
  title = "Ein Fehler ist aufgetreten",
  message = "Beim Laden der Daten ist ein Fehler aufgetreten. Bitte versuchen Sie es erneut.",
  onRetry 
}: ErrorStateProps) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex flex-col items-center text-center space-y-4">
          <AlertCircle className="h-12 w-12 text-destructive" />
          <div className="space-y-2">
            <h3 className="font-semibold text-xl">{title}</h3>
            <p className="text-muted-foreground">{message}</p>
          </div>
          {onRetry && (
            <Button onClick={onRetry} className="mt-4">
              Erneut versuchen
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
```

# frontend/src/components/ui/ErrorState.tsx

```tsx
// src/components/ui/ErrorState.tsx
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { XCircle } from 'lucide-react';

interface ErrorStateProps {
  title: string;
  message: string;
  onRetry?: () => void;
}

export function ErrorState({ title, message, onRetry }: ErrorStateProps) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center py-12">
        <XCircle className="w-12 h-12 text-destructive mb-4" />
        <h3 className="text-lg font-semibold mb-2">{title}</h3>
        <p className="text-muted-foreground mb-4">{message}</p>
        {onRetry && (
          <Button onClick={onRetry}>
            Erneut versuchen
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
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

# frontend/src/components/ui/LoadingState.tsx

```tsx
// src/components/ui/LoadingState.tsx
import { useEffect, useState } from 'react';

export function LoadingState() {
  const [showRetryMessage, setShowRetryMessage] = useState(false);
  
  useEffect(() => {
    // After 10 seconds, show a message suggesting reload if still loading
    const timeoutId = setTimeout(() => {
      setShowRetryMessage(true);
    }, 10000);
    
    return () => clearTimeout(timeoutId);
  }, []);
  
  return (
    <div className="w-full h-48 flex flex-col items-center justify-center gap-4">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      {showRetryMessage && (
        <p className="text-sm text-muted-foreground">
          Laden dauert länger als erwartet. Prüfen Sie Ihre Netzwerkverbindung oder laden Sie die Seite neu.
        </p>
      )}
    </div>
  );
}
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

# frontend/src/components/ui/Skeleton-Card.tsx

```tsx
import { Card, CardContent, CardHeader } from "@/components/ui/card"

export function SkeletonCard() {
  return (
    <Card>
      <CardHeader className="gap-2">
        <div className="w-1/4 h-5 bg-gray-200 rounded animate-pulse" />
      </CardHeader>
      <CardContent className="mt-2">
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-4">
            <div className="h-4 bg-gray-200 rounded animate-pulse" />
            <div className="h-4 bg-gray-200 rounded animate-pulse" />
          </div>
          <div className="h-4 bg-gray-200 rounded animate-pulse w-3/4" />
          <div className="h-4 bg-gray-200 rounded animate-pulse w-1/2" />
        </div>
      </CardContent>
    </Card>
  )
}
```

# frontend/src/components/ui/Toast.tsx

```tsx
import * as React from "react"
import * as ToastPrimitives from "@radix-ui/react-toast"
import { cva, type VariantProps } from "class-variance-authority"
import { X } from "lucide-react"

import { cn } from "@/lib/utils"

const ToastProvider = ToastPrimitives.Provider

const ToastViewport = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Viewport>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Viewport>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Viewport
    ref={ref}
    className={cn(
      "fixed top-0 z-[100] flex max-h-screen w-full flex-col-reverse p-4 sm:bottom-0 sm:right-0 sm:top-auto sm:flex-col md:max-w-[420px]",
      className
    )}
    {...props}
  />
))
ToastViewport.displayName = ToastPrimitives.Viewport.displayName

const toastVariants = cva(
  "group pointer-events-auto relative flex w-full items-center justify-between space-x-2 overflow-hidden rounded-md border p-4 pr-6 shadow-lg transition-all data-[swipe=cancel]:translate-x-0 data-[swipe=end]:translate-x-[var(--radix-toast-swipe-end-x)] data-[swipe=move]:translate-x-[var(--radix-toast-swipe-move-x)] data-[swipe=move]:transition-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[swipe=end]:animate-out data-[state=closed]:fade-out-80 data-[state=closed]:slide-out-to-right-full data-[state=open]:slide-in-from-top-full data-[state=open]:sm:slide-in-from-bottom-full",
  {
    variants: {
      variant: {
        default: "border bg-background text-foreground",
        destructive:
          "destructive group border-destructive bg-destructive text-destructive-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

const Toast = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Root>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Root> &
    VariantProps<typeof toastVariants>
>(({ className, variant, ...props }, ref) => {
  return (
    <ToastPrimitives.Root
      ref={ref}
      className={cn(toastVariants({ variant }), className)}
      {...props}
    />
  )
})
Toast.displayName = ToastPrimitives.Root.displayName

const ToastAction = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Action>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Action>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Action
    ref={ref}
    className={cn(
      "inline-flex h-8 shrink-0 items-center justify-center rounded-md border bg-transparent px-3 text-sm font-medium transition-colors hover:bg-secondary focus:outline-none focus:ring-1 focus:ring-ring disabled:pointer-events-none disabled:opacity-50 group-[.destructive]:border-muted/40 group-[.destructive]:hover:border-destructive/30 group-[.destructive]:hover:bg-destructive group-[.destructive]:hover:text-destructive-foreground group-[.destructive]:focus:ring-destructive",
      className
    )}
    {...props}
  />
))
ToastAction.displayName = ToastPrimitives.Action.displayName

const ToastClose = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Close>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Close>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Close
    ref={ref}
    className={cn(
      "absolute right-1 top-1 rounded-md p-1 text-foreground/50 opacity-0 transition-opacity hover:text-foreground focus:opacity-100 focus:outline-none focus:ring-1 group-hover:opacity-100 group-[.destructive]:text-red-300 group-[.destructive]:hover:text-red-50 group-[.destructive]:focus:ring-red-400 group-[.destructive]:focus:ring-offset-red-600",
      className
    )}
    toast-close=""
    {...props}
  >
    <X className="h-4 w-4" />
  </ToastPrimitives.Close>
))
ToastClose.displayName = ToastPrimitives.Close.displayName

const ToastTitle = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Title>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Title>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Title
    ref={ref}
    className={cn("text-sm font-semibold [&+div]:text-xs", className)}
    {...props}
  />
))
ToastTitle.displayName = ToastPrimitives.Title.displayName

const ToastDescription = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Description>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Description>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Description
    ref={ref}
    className={cn("text-sm opacity-90", className)}
    {...props}
  />
))
ToastDescription.displayName = ToastPrimitives.Description.displayName

type ToastProps = React.ComponentPropsWithoutRef<typeof Toast>

type ToastActionElement = React.ReactElement<typeof ToastAction>

export {
  type ToastProps,
  type ToastActionElement,
  ToastProvider,
  ToastViewport,
  Toast,
  ToastTitle,
  ToastDescription,
  ToastClose,
  ToastAction,
}

```

# frontend/src/components/ui/Toaster.tsx

```tsx
import { useToast } from "@/hooks/useToast"
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast"

export function Toaster() {
  const { toasts } = useToast()

  return (
    <ToastProvider>
      {toasts.map(function ({ id, title, description, action, ...props }) {
        return (
          <Toast key={id} {...props}>
            <div className="grid gap-1">
              {title && <ToastTitle>{title}</ToastTitle>}
              {description && (
                <ToastDescription>{description}</ToastDescription>
              )}
            </div>
            {action}
            <ToastClose />
          </Toast>
        )
      })}
      <ToastViewport />
    </ToastProvider>
  )
}

```

# frontend/src/constants/propertyTypes.ts

```ts
// src/constants/propertyTypes.ts

// Immobilientypen
export const propertyTypes = [
  'Einfamilienhaus',
  'Mehrfamilienhaus', 
  'Eigentumswohnung',
  'Doppelhaushälfte',
  'Reihenhaus',
  'Villa'
] as const;

// Typen für Einheiten (Wohnungen/Gewerbe)
export const UNIT_TYPES = [
  'Wohnung',
  'Gewerbe'
] as const;

// Status für Einheiten
export const UNIT_STATUS = [
  'verfügbar',
  'besetzt'
] as const;

// Status-Konfigurationen
export const STATUS_CONFIG = {
  verfügbar: {
    label: 'Verfügbar',
    color: 'green',
  },
  besetzt: {
    label: 'Besetzt',
    color: 'blue',
  }
} as const;

// Document Categories
export const DOCUMENT_CATEGORIES = [
  'Mietvertrag',
  'Nebenkostenabrechnung',
  'Wartungsvertrag',
  'Versicherung',
  'Sonstiges'
] as const;

// Document Types
export const DOCUMENT_TYPES = {
  pdf: {
    icon: 'FileText',
    color: 'red',
  },
  doc: {
    icon: 'FileText',
    color: 'blue',
  },
  image: {
    icon: 'Image',
    color: 'green',
  }
} as const;

// API Configuration
export const API_CONFIG = {
  baseUrl: 'http://localhost:3001',
  timeout: 15000,  // Increased from 5000ms to 15000ms
  retryAttempts: 3,
  loadingStateTimeout: 30000, // 30 seconds max for loading states
} as const;

// Table Configuration
export const TABLE_CONFIG = {
  defaultPageSize: 10,
  pageSizeOptions: [5, 10, 20, 50],
} as const;

// Form Configuration
export const FORM_CONFIG = {
  maxFileSize: 10 * 1024 * 1024, // 10MB
  allowedFileTypes: ['.pdf', '.doc', '.docx', '.jpg', '.jpeg', '.png'],
} as const;

// Validation Configuration
export const VALIDATION_CONFIG = {
  minPasswordLength: 8,
  maxNameLength: 100,
  phonePattern: /^[+]?[(]?[0-9]{3}[)]?[-\s.]?[0-9]{3}[-\s.]?[0-9]{4,6}$/,
  emailPattern: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
} as const;
```

# frontend/src/hooks/use-toast.ts

```ts
// src/hooks/useToast.ts
import * as React from "react"
import {
  ToastActionElement,
  ToastProps,
} from "@/components/ui/toast"

const TOAST_LIMIT = 1
const TOAST_REMOVE_DELAY = 3000

type ToasterToast = ToastProps & {
  id: string
  title?: React.ReactNode
  description?: React.ReactNode
  action?: ToastActionElement
}

const actionTypes = {
  ADD_TOAST: "ADD_TOAST",
  UPDATE_TOAST: "UPDATE_TOAST",
  DISMISS_TOAST: "DISMISS_TOAST",
  REMOVE_TOAST: "REMOVE_TOAST",
} as const

let count = 0

function genId() {
  count = (count + 1) % Number.MAX_VALUE
  return count.toString()
}

type ActionType = typeof actionTypes

type Action =
  | {
      type: ActionType["ADD_TOAST"]
      toast: ToasterToast
    }
  | {
      type: ActionType["UPDATE_TOAST"]
      toast: Partial<ToasterToast>
      id: string
    }
  | {
      type: ActionType["DISMISS_TOAST"]
      toastId?: string
    }
  | {
      type: ActionType["REMOVE_TOAST"]
      toastId?: string
    }

interface State {
  toasts: ToasterToast[]
}

const toastTimeouts = new Map<string, ReturnType<typeof setTimeout>>()

const addToRemoveQueue = (toastId: string) => {
  if (toastTimeouts.has(toastId)) {
    return
  }

  const timeout = setTimeout(() => {
    toastTimeouts.delete(toastId)
    dispatch({
      type: "REMOVE_TOAST",
      toastId: toastId,
    })
  }, TOAST_REMOVE_DELAY)

  toastTimeouts.set(toastId, timeout)
}

export const reducer = (state: State, action: Action): State => {
  switch (action.type) {
    case "ADD_TOAST":
      return {
        ...state,
        toasts: [action.toast, ...state.toasts].slice(0, TOAST_LIMIT),
      }

    case "UPDATE_TOAST":
      return {
        ...state,
        toasts: state.toasts.map((t) =>
          t.id === action.id ? { ...t, ...action.toast } : t
        ),
      }

    case "DISMISS_TOAST": {
      const { toastId } = action

      if (toastId) {
        addToRemoveQueue(toastId)
      } else {
        state.toasts.forEach((toast) => {
          addToRemoveQueue(toast.id)
        })
      }

      return {
        ...state,
        toasts: state.toasts.map((t) =>
          t.id === toastId || toastId === undefined
            ? {
                ...t,
                open: false,
              }
            : t
        ),
      }
    }
    case "REMOVE_TOAST":
      if (action.toastId === undefined) {
        return {
          ...state,
          toasts: [],
        }
      }
      return {
        ...state,
        toasts: state.toasts.filter((t) => t.id !== action.toastId),
      }
  }
}

const listeners: Array<(state: State) => void> = []

let memoryState: State = { toasts: [] }

function dispatch(action: Action) {
  memoryState = reducer(memoryState, action)
  listeners.forEach((listener) => {
    listener(memoryState)
  })
}

function toast({ ...props }: Partial<ToasterToast>) {
  const id = genId()

  const update = (props: ToasterToast) =>
    dispatch({
      type: "UPDATE_TOAST",
      id,
      toast: props,
    })

  const dismiss = () => dispatch({ type: "DISMISS_TOAST", toastId: id })

  dispatch({
    type: "ADD_TOAST",
    toast: {
      ...props,
      id,
      open: true,
      onOpenChange: (open) => {
        if (!open) dismiss()
      },
    },
  })

  return {
    id: id,
    dismiss,
    update,
  }
}

export function useToast() {
  const [state, setState] = React.useState<State>(memoryState)

  React.useEffect(() => {
    listeners.push(setState)
    return () => {
      const index = listeners.indexOf(setState)
      if (index > -1) {
        listeners.splice(index, 1)
      }
    }
  }, [state])

  const showSuccessToast = (title: string, description?: string) => {
    toast({
      title,
      description,
      duration: 2000,
    })
  }

  const showErrorToast = (title: string, description?: string) => {
    toast({
      title,
      description,
      variant: "destructive",
      duration: 4000,
    })
  }

  return {
    ...state,
    toast,
    showSuccessToast,
    showErrorToast,
    dismiss: (toastId?: string) => dispatch({ type: "DISMISS_TOAST", toastId }),
  }
}
```

# frontend/src/hooks/useAsync.ts

```ts
// src/hooks/useAsync.ts
import { useState, useCallback, useRef, useEffect } from 'react';
import { useToast } from './useToast';
import { ApiError } from '@/types/common';

interface UseAsyncOptions {
  successMessage?: string;
  errorMessage?: string;
  showSuccessToast?: boolean;
  showErrorToast?: boolean;
  retryCount?: number;
  autoExecute?: boolean;
  loadingTimeout?: number; // Timeout in ms after which loading state will be cleared
}

export function useAsync<T>(
  asyncFunction: (...args: any[]) => Promise<T>,
  options: UseAsyncOptions = {}
) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [data, setData] = useState<T | null>(null);
  const { toast } = useToast();
  
  // Keep track of auto-execute status
  const didAutoExecute = useRef(false);
  
  // Track component mount status to prevent state updates after unmount
  const isMounted = useRef(true);
  
  // Track current request to allow cancellation
  const activeRequest = useRef<AbortController | null>(null);
  const attemptCount = useRef(0);

  // Setup cleanup on component unmount
  useEffect(() => {
    console.log('useAsync hook initialized');
    isMounted.current = true;
    
    return () => {
      console.log('useAsync cleanup - component unmounting');
      isMounted.current = false;
      
      if (activeRequest.current) {
        console.log('Aborting active request on unmount');
        activeRequest.current.abort();
        activeRequest.current = null;
      }
    };
  }, []);

  const execute = useCallback(
    async (...args: any[]): Promise<T> => {
      // Safety check - don't start a new request if component is unmounted
      if (!isMounted.current) {
        console.log('Execute called but component is unmounted, skipping');
        return Promise.reject(new Error('Component unmounted'));
      }
      
      console.log('Execute called with loading state:', isLoading);
      
      // Cancel any in-progress requests
      if (activeRequest.current) {
        console.log('Aborting previous request');
        activeRequest.current.abort();
      }
      
      // Create new abort controller for this request
      const controller = new AbortController();
      activeRequest.current = controller;
      
      attemptCount.current += 1;
      console.log(`Executing async operation (attempt ${attemptCount.current})`);
      
      // Set up loading timeout to prevent infinite loading state
      let loadingTimeoutId: NodeJS.Timeout | null = null;
      if (options.loadingTimeout) {
        loadingTimeoutId = setTimeout(() => {
          // Only update state if component is still mounted
          if (isMounted.current && isLoading) {
            console.warn(`Loading timeout reached after ${options.loadingTimeout}ms`);
            setIsLoading(false);
          }
        }, options.loadingTimeout);
      }
      
      // Update loading state at the beginning
      setIsLoading(true);
      console.log('Setting isLoading to true');
      setError(null);
      
      try {
        const response = await asyncFunction(...args);
        
        // Only update state if this request wasn't aborted and component is mounted
        if (!controller.signal.aborted && isMounted.current) {
          console.log('Operation successful, setting data');
          setData(response);
          
          // Show success toast if configured
          if (options.showSuccessToast !== false && options.successMessage) {
            toast({
              title: 'Erfolg',
              description: options.successMessage,
              duration: 3000,
            });
          }
        } else {
          console.log('Request completed but was either aborted or component unmounted');
        }
        
        return response;
      } catch (err) {
        // Only update error state if request wasn't aborted and component is mounted
        if (!controller.signal.aborted && isMounted.current) {
          console.error('Fehler in useAsync:', err);
          
          const error = err instanceof Error ? err : new Error('Ein Fehler ist aufgetreten');
          setError(error);
          
          // Show error toast if configured
          if (options.showErrorToast !== false) {
            const errorMessage = err instanceof ApiError 
              ? err.message 
              : options.errorMessage || 'Ein unerwarteter Fehler ist aufgetreten';
            
            toast({
              title: 'Fehler',
              description: errorMessage,
              variant: 'destructive',
              duration: 5000,
            });
          }
          
          // Auto-retry if configured and attempts not exhausted
          const maxRetries = options.retryCount || 0;
          if (maxRetries > 0 && attemptCount.current <= maxRetries) {
            console.log(`Auto-retrying (${attemptCount.current}/${maxRetries})`);
            setTimeout(() => execute(...args), 1000); // 1 second delay
          }
        } else {
          console.log('Error occurred but request was aborted or component unmounted');
        }
        
        throw err;
      } finally {
        // Clean up timeout
        if (loadingTimeoutId) {
          clearTimeout(loadingTimeoutId);
        }
        
        // CRITICAL FIX: Always reset loading state if component is mounted
        if (isMounted.current) {
          console.log('Resetting loading state to false');
          setIsLoading(false);
          // Only clear activeRequest if this is the current request
          if (activeRequest.current === controller) {
            activeRequest.current = null;
          }
        } else {
          console.log('Component unmounted, not updating state');
        }
      }
    },
    [asyncFunction, options, toast, isLoading]
  );

  // Auto-execute if configured
  useEffect(() => {
    if (options.autoExecute && !didAutoExecute.current && !isLoading && !data && !error) {
      console.log('Auto-executing function');
      didAutoExecute.current = true;
      execute().catch(err => {
        if (err.message !== 'Component unmounted') {
          console.error('Auto-execute error:', err);
        }
      });
    }
  }, [options.autoExecute, isLoading, data, error, execute]);

  // Reset state
  const reset = useCallback(() => {
    if (isMounted.current) {
      setData(null);
      setError(null);
      setIsLoading(false);
      attemptCount.current = 0;
      console.log('State reset');
    }
  }, []);

  // Retry operation
  const retry = useCallback(async (...args: any[]) => {
    if (isLoading || !isMounted.current) return;
    console.log('Retrying operation');
    attemptCount.current = 0;
    return execute(...args);
  }, [execute, isLoading]);

  return {
    execute,
    isLoading,
    error,
    data,
    reset,
    retry
  };
}
```

# frontend/src/hooks/useConfirmation.ts

```ts
// src/hooks/useConfirmation.ts
import { useState, useCallback } from 'react';

interface UseConfirmationOptions {
  title?: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
}

export function useConfirmation(options: UseConfirmationOptions = {}) {
  const [isOpen, setIsOpen] = useState(false);
  const [resolveRef, setResolveRef] = useState<((value: boolean) => void) | null>(null);

  const confirm = useCallback(() => {
    return new Promise<boolean>((resolve) => {
      setIsOpen(true);
      setResolveRef(() => resolve);
    });
  }, []);

  const handleConfirm = useCallback(() => {
    if (resolveRef) {
      resolveRef(true);
      setIsOpen(false);
      setResolveRef(null);
    }
  }, [resolveRef]);

  const handleCancel = useCallback(() => {
    if (resolveRef) {
      resolveRef(false);
      setIsOpen(false);
      setResolveRef(null);
    }
  }, [resolveRef]);

  return {
    isOpen,
    confirm,
    handleConfirm,
    handleCancel,
    options,
  };
}
```

# frontend/src/hooks/useFormState.ts

```ts
// src/hooks/useFormState.ts
import { useState, useCallback } from 'react';

export function useFormState<T>(initialState: T) {
  const [formData, setFormData] = useState<T>(initialState);
  const [errors, setErrors] = useState<Partial<Record<keyof T, string>>>({});
  const [isDirty, setIsDirty] = useState(false);

  const updateField = useCallback(<K extends keyof T>(
    field: K,
    value: T[K]
  ) => {
    setFormData(prev => ({
      ...prev,
      [field]: value,
    }));
    setIsDirty(true);
    // Lösche Fehler wenn Feld aktualisiert wird
    setErrors(prev => ({
      ...prev,
      [field]: undefined,
    }));
  }, []);

  const validateField = useCallback((
    field: keyof T,
    validator: (value: T[typeof field]) => string | undefined
  ) => {
    const error = validator(formData[field]);
    setErrors(prev => ({
      ...prev,
      [field]: error,
    }));
    return !error;
  }, [formData]);

  const resetForm = useCallback(() => {
    setFormData(initialState);
    setErrors({});
    setIsDirty(false);
  }, [initialState]);

  return {
    formData,
    setFormData,
    errors,
    setErrors,
    isDirty,
    updateField,
    validateField,
    resetForm,
  };
}
```

# frontend/src/hooks/useToast.ts

```ts
// src/hooks/useToast.ts
import * as React from "react"
import {
  ToastActionElement,
  ToastProps,
} from "@/components/ui/toast"

const TOAST_LIMIT = 1
const TOAST_REMOVE_DELAY = 3000

type ToasterToast = ToastProps & {
  id: string
  title?: React.ReactNode
  description?: React.ReactNode
  action?: ToastActionElement
}

const actionTypes = {
  ADD_TOAST: "ADD_TOAST",
  UPDATE_TOAST: "UPDATE_TOAST",
  DISMISS_TOAST: "DISMISS_TOAST",
  REMOVE_TOAST: "REMOVE_TOAST",
} as const

let count = 0

function genId() {
  count = (count + 1) % Number.MAX_VALUE
  return count.toString()
}

type ActionType = typeof actionTypes

type Action =
  | {
      type: ActionType["ADD_TOAST"]
      toast: ToasterToast
    }
  | {
      type: ActionType["UPDATE_TOAST"]
      toast: Partial<ToasterToast>
      id: string
    }
  | {
      type: ActionType["DISMISS_TOAST"]
      toastId?: string
    }
  | {
      type: ActionType["REMOVE_TOAST"]
      toastId?: string
    }

interface State {
  toasts: ToasterToast[]
}

const toastTimeouts = new Map<string, ReturnType<typeof setTimeout>>()

const addToRemoveQueue = (toastId: string) => {
  if (toastTimeouts.has(toastId)) {
    return
  }

  const timeout = setTimeout(() => {
    toastTimeouts.delete(toastId)
    dispatch({
      type: "REMOVE_TOAST",
      toastId: toastId,
    })
  }, TOAST_REMOVE_DELAY)

  toastTimeouts.set(toastId, timeout)
}

export const reducer = (state: State, action: Action): State => {
  switch (action.type) {
    case "ADD_TOAST":
      return {
        ...state,
        toasts: [action.toast, ...state.toasts].slice(0, TOAST_LIMIT),
      }

    case "UPDATE_TOAST":
      return {
        ...state,
        toasts: state.toasts.map((t) =>
          t.id === action.id ? { ...t, ...action.toast } : t
        ),
      }

    case "DISMISS_TOAST": {
      const { toastId } = action

      if (toastId) {
        addToRemoveQueue(toastId)
      } else {
        state.toasts.forEach((toast) => {
          addToRemoveQueue(toast.id)
        })
      }

      return {
        ...state,
        toasts: state.toasts.map((t) =>
          t.id === toastId || toastId === undefined
            ? {
                ...t,
                open: false,
              }
            : t
        ),
      }
    }
    case "REMOVE_TOAST":
      if (action.toastId === undefined) {
        return {
          ...state,
          toasts: [],
        }
      }
      return {
        ...state,
        toasts: state.toasts.filter((t) => t.id !== action.toastId),
      }
  }
}

const listeners: Array<(state: State) => void> = []

let memoryState: State = { toasts: [] }

function dispatch(action: Action) {
  memoryState = reducer(memoryState, action)
  listeners.forEach((listener) => {
    listener(memoryState)
  })
}

function toast({ ...props }: Partial<ToasterToast>) {
  const id = genId()

  const update = (props: ToasterToast) =>
    dispatch({
      type: "UPDATE_TOAST",
      id,
      toast: props,
    })

  const dismiss = () => dispatch({ type: "DISMISS_TOAST", toastId: id })

  dispatch({
    type: "ADD_TOAST",
    toast: {
      ...props,
      id,
      open: true,
      onOpenChange: (open) => {
        if (!open) dismiss()
      },
    },
  })

  return {
    id: id,
    dismiss,
    update,
  }
}

export function useToast() {
  const [state, setState] = React.useState<State>(memoryState)

  React.useEffect(() => {
    listeners.push(setState)
    return () => {
      const index = listeners.indexOf(setState)
      if (index > -1) {
        listeners.splice(index, 1)
      }
    }
  }, [state])

  const showSuccessToast = (title: string, description?: string) => {
    toast({
      title,
      description,
      duration: 2000,
    })
  }

  const showErrorToast = (title: string, description?: string) => {
    toast({
      title,
      description,
      variant: "destructive",
      duration: 4000,
    })
  }

  return {
    ...state,
    toast,
    showSuccessToast,
    showErrorToast,
    dismiss: (toastId?: string) => dispatch({ type: "DISMISS_TOAST", toastId }),
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

# frontend/src/lib/downloads.ts

```ts
// src/lib/downloads.ts
export function downloadFile(blob: Blob, filename: string) {
  const url = window.URL.createObjectURL(blob);
  const link = window.document.createElement('a');
  link.href = url;
  link.download = filename;
  window.document.body.appendChild(link);
  link.click();
  window.document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
}
```

# frontend/src/lib/formatters.ts

```ts
// src/lib/formatters.ts
export const formatCurrency = (value: number): string => {
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value);
  };
  
  export const formatDate = (date: string | Date): string => {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    
    return new Intl.DateTimeFormat('de-DE', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(dateObj);
  };
  
  export const formatDateTime = (date: string | Date): string => {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    
    return new Intl.DateTimeFormat('de-DE', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    }).format(dateObj);
  };
  
  export const formatPhoneNumber = (phoneNumber: string): string => {
    // Entferne alle nicht-numerischen Zeichen
    const cleaned = phoneNumber.replace(/\D/g, '');
    
    // Formatiere je nach Länge
    if (cleaned.length === 10) {
      return cleaned.replace(/(\d{3})(\d{3})(\d{4})/, '($1) $2-$3');
    } else if (cleaned.length === 11) {
      return cleaned.replace(/(\d{1})(\d{3})(\d{3})(\d{4})/, '+$1 ($2) $3-$4');
    }
    
    // Fallback: Gib die originale Nummer zurück
    return phoneNumber;
  };
  
  export const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  };
  
  export const formatPercentage = (value: number): string => {
    return new Intl.NumberFormat('de-DE', {
      style: 'percent',
      minimumFractionDigits: 1,
      maximumFractionDigits: 1
    }).format(value / 100);
  };
  
  export const formatNumber = (value: number): string => {
    return new Intl.NumberFormat('de-DE').format(value);
  };
  
  export const formatAddress = (
    street: string,
    number: string,
    zip: string,
    city: string
  ): string => {
    return `${street} ${number}, ${zip} ${city}`;
  };
  
  export const formatName = (firstName: string, lastName: string): string => {
    return `${firstName} ${lastName}`;
  };
  
  export const formatDuration = (minutes: number): string => {
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    
    if (hours === 0) {
      return `${remainingMinutes} Min.`;
    }
    
    return `${hours} Std. ${remainingMinutes} Min.`;
  };
```

# frontend/src/lib/utils.ts

```ts
// src/lib/utils.ts
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

// Utility für Tailwind CSS Klassen-Kombinationen
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Generische Error Handler
export function isApiError(error: unknown): error is Error {
  return error instanceof Error;
}

// Allgemeine Dateiverarbeitung
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

// Debounce Funktion für Suchfelder etc.
export function debounce<T extends (...args: any[]) => void>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  
  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };

    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// Array Utilities
export function groupBy<T>(array: T[], key: keyof T): Record<string, T[]> {
  return array.reduce((groups, item) => {
    const value = item[key];
    const keyString = String(value);
    groups[keyString] = groups[keyString] ?? [];
    groups[keyString].push(item);
    return groups;
  }, {} as Record<string, T[]>);
}
```

# frontend/src/lib/validators.ts

```ts
// src/lib/validators.ts
import { VALIDATION_CONFIG } from '@/constants/propertyTypes';

export const required = (value: any): string | undefined => {
  if (value === undefined || value === null || value === '') {
    return 'Dieses Feld ist erforderlich';
  }
  return undefined;
};

export const email = (value: string): string | undefined => {
  if (!value) return undefined;
  
  if (!VALIDATION_CONFIG.emailPattern.test(value)) {
    return 'Bitte geben Sie eine gültige E-Mail-Adresse ein';
  }
  return undefined;
};

export const phone = (value: string): string | undefined => {
  if (!value) return undefined;

  if (!VALIDATION_CONFIG.phonePattern.test(value)) {
    return 'Bitte geben Sie eine gültige Telefonnummer ein';
  }
  return undefined;
};

export const minLength = (min: number) => (value: string): string | undefined => {
  if (!value) return undefined;

  if (value.length < min) {
    return `Mindestens ${min} Zeichen erforderlich`;
  }
  return undefined;
};

export const maxLength = (max: number) => (value: string): string | undefined => {
  if (!value) return undefined;

  if (value.length > max) {
    return `Maximal ${max} Zeichen erlaubt`;
  }
  return undefined;
};

export const number = (value: string): string | undefined => {
  if (!value) return undefined;

  if (isNaN(Number(value))) {
    return 'Bitte geben Sie eine gültige Zahl ein';
  }
  return undefined;
};

export const positiveNumber = (value: number): string | undefined => {
  if (value === undefined || value === null) return undefined;

  if (value <= 0) {
    return 'Der Wert muss größer als 0 sein';
  }
  return undefined;
};

export const dateNotInPast = (value: string): string | undefined => {
  if (!value) return undefined;

  const date = new Date(value);
  const now = new Date();
  
  if (date < now) {
    return 'Das Datum darf nicht in der Vergangenheit liegen';
  }
  return undefined;
};

export const dateNotInFuture = (value: string): string | undefined => {
  if (!value) return undefined;

  const date = new Date(value);
  const now = new Date();
  
  if (date > now) {
    return 'Das Datum darf nicht in der Zukunft liegen';
  }
  return undefined;
};

export const composeValidators = (...validators: ((value: any) => string | undefined)[]) => 
  (value: any): string | undefined => 
    validators.reduce(
      (error, validator) => error || validator(value),
      undefined as string | undefined
    );
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

# frontend/src/services/api.ts

```ts
// src/services/api.ts
import { API_CONFIG } from '@/constants/propertyTypes';
import { ApiError } from '@/types/common';

export class API {
  private static baseUrl = API_CONFIG.baseUrl;
  private static timeout = API_CONFIG.timeout;
  private static retryAttempts = API_CONFIG.retryAttempts || 0;
  public static loadingStateTimeout = API_CONFIG.loadingStateTimeout || 30000;

  private static async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      console.log(`API Request: ${options.method || 'GET'} ${url}`);
      
      const response = await fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          ...options.headers,
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // Log raw response for debugging
      console.log(`API Response Status: ${response.status}`);
      
      // Debug response content
      const responseText = await response.text();
      
      if (!response.ok) {
        let errorMessage = 'Ein Fehler ist aufgetreten';
        let errorData;
        
        try {
          errorData = responseText ? JSON.parse(responseText) : {};
          errorMessage = errorData.error || errorMessage;
        } catch (parseError) {
          console.error('Error parsing error response:', parseError);
          // Keep default error message
        }

        throw new ApiError(errorMessage, response.status, errorData);
      }

      // For endpoints that return no content
      if (response.status === 204 || !responseText) {
        return {} as T;
      }

      // Parse the response
      try {
        return JSON.parse(responseText) as T;
      } catch (parseError) {
        console.error('Error parsing success response:', parseError);
        console.error('Raw response:', responseText);
        throw new ApiError('Fehler beim Verarbeiten der Antwort', 500);
      }
    } catch (error) {
      clearTimeout(timeoutId);
      
      if (error instanceof ApiError) throw error;
      
      if (error instanceof Error) {
        console.error('API request error:', error);
        
        if (error.name === 'AbortError') {
          throw new ApiError('Die Anfrage wurde wegen Zeitüberschreitung abgebrochen', 408);
        }
        throw new ApiError(error.message);
      }
      
      throw new ApiError('Ein unerwarteter Fehler ist aufgetreten');
    }
  }

  static get<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint);
  }

  static post<T>(endpoint: string, data: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  static put<T>(endpoint: string, data: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  static delete(endpoint: string): Promise<void> {
    return this.request(endpoint, {
      method: 'DELETE',
    });
  }

  static async deleteWithConfirm(endpoint: string): Promise<boolean> {
    try {
      await this.delete(endpoint);
      return true;
    } catch (error) {
      console.error('Delete error:', error);
      return false;
    }
  }
}
```

# frontend/src/services/DocumentService.ts

```ts
// src/services/DocumentService.ts
import { API } from './api';
import { API_CONFIG } from '@/constants/propertyTypes';
import { Document, DocumentUploadData } from '@/types/document';
import { ApiError } from '@/types/common';

export class DocumentService {
  private static endpoint = '/documents';

  static async getAll(filters?: {
    tenantId?: number;
    categoryId?: number;
    isConfidential?: boolean;
    tags?: string[];
  }): Promise<Document[]> {
    const queryParams = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined) {
          queryParams.append(key, String(value));
        }
      });
    }
    const queryString = queryParams.toString();
    const url = queryString ? `${this.endpoint}?${queryString}` : this.endpoint;
    return API.get<Document[]>(url);
  }

  static async getById(id: number): Promise<Document> {
    return API.get<Document>(`${this.endpoint}/${id}`);
  }

  static async upload(data: DocumentUploadData): Promise<Document> {
    const formData = new FormData();
    Object.entries(data).forEach(([key, value]) => {
      if (value !== undefined) {
        if (key === 'tags' && Array.isArray(value)) {
          formData.append(key, JSON.stringify(value));
        } else {
          formData.append(key, value as string | Blob);
        }
      }
    });

    const response = await fetch(`${API_CONFIG.baseUrl}/documents`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Upload fehlgeschlagen' }));
      throw new ApiError(error.error || 'Upload fehlgeschlagen', response.status);
    }
    
    return response.json();
  }

  static async delete(id: number): Promise<void> {
    return API.delete(`${this.endpoint}/${id}`);
  }

  static getDownloadUrl(id: number): string {
    return `${API_CONFIG.baseUrl}${this.endpoint}/${id}/download`;
  }

  static async getPreview(id: number): Promise<Blob> {
    const response = await fetch(`${API_CONFIG.baseUrl}${this.endpoint}/${id}/preview`);
    if (!response.ok) {
      throw new ApiError('Vorschau konnte nicht geladen werden', response.status);
    }
    return await response.blob();
  }

  static async getCategories(): Promise<any[]> {
    return API.get<any[]>(`${this.endpoint}/categories`);
  }
}
```

# frontend/src/services/PropertyService.ts

```ts
// src/services/PropertyService.ts
import { API } from './api';
import { Property, PropertyFormData } from '@/types/property';

export class PropertyService {
  private static endpoint = '/properties';

  static async getAll(): Promise<Property[]> {
    return API.get<Property[]>(this.endpoint);
  }

  static async getById(id: number): Promise<Property> {
    return API.get<Property>(`${this.endpoint}/${id}`);
  }

  static async create(data: PropertyFormData): Promise<Property> {
    return API.post<Property>(this.endpoint, data);
  }

  static async update(id: number, data: PropertyFormData): Promise<Property> {
    return API.put<Property>(`${this.endpoint}/${id}`, data);
  }

  static async delete(id: number): Promise<void> {
    return API.delete(`${this.endpoint}/${id}`);
  }
  
  static async deleteWithConfirm(id: number): Promise<boolean> {
    return API.deleteWithConfirm(`${this.endpoint}/${id}`);
  }
}

```

# frontend/src/services/TenantService.ts

```ts
// src/services/TenantService.ts
import { API } from './api';
import { Tenant, TenantFormData } from '@/types/tenant';

export class TenantService {
  private static endpoint = '/tenants';

  static async getAll(): Promise<Tenant[]> {
    return API.get<Tenant[]>(this.endpoint);
  }

  static async getById(id: number): Promise<Tenant> {
    return API.get<Tenant>(`${this.endpoint}/${id}`);
  }

  static async create(data: TenantFormData): Promise<Tenant> {
    return API.post<Tenant>(this.endpoint, data);
  }

  static async update(id: number, data: TenantFormData): Promise<Tenant> {
    // Make sure we're sending the active status which might be needed by the backend
    const updatedData = {
      ...data,
      active: true, // Assume active for updates unless explicitly set otherwise
    };
    
    return API.put<Tenant>(`${this.endpoint}/${id}`, updatedData);
  }

  static async delete(id: number): Promise<void> {
    return API.delete(`${this.endpoint}/${id}`);
  }
}
```

# frontend/src/services/WorkerService.ts

```ts
// src/services/WorkerService.ts
import { API } from './api';
import { Worker, WorkerFormData, WorkerSkill } from '@/types/worker';

export class WorkerService {
  private static endpoint = '/workers';

  static async getAll(): Promise<Worker[]> {
    return API.get<Worker[]>(this.endpoint);
  }

  static async getById(id: number): Promise<Worker> {
    return API.get<Worker>(`${this.endpoint}/${id}`);
  }

  static async create(data: WorkerFormData): Promise<Worker> {
    // Ensure all skills have the required properties
    const formattedData = {
      ...data,
      hourly_rate: typeof data.hourly_rate === 'string' 
        ? parseFloat(data.hourly_rate) 
        : data.hourly_rate,
      skills: data.skills.map(skill => ({
        id: typeof skill.id === 'string' ? parseInt(skill.id) : skill.id,
        experience_years: skill.experience_years
      }))
    };
    
    return API.post<Worker>(this.endpoint, formattedData);
  }

  static async update(id: number, data: WorkerFormData): Promise<Worker> {
    // Ensure all skills have the required properties and proper types
    const formattedData = {
      ...data,
      hourly_rate: typeof data.hourly_rate === 'string' 
        ? parseFloat(data.hourly_rate) 
        : data.hourly_rate,
      skills: data.skills.map(skill => ({
        id: typeof skill.id === 'string' ? parseInt(skill.id) : skill.id,
        experience_years: skill.experience_years
      })),
      active: data.active !== undefined ? data.active : true, // Default to active if not specified
    };
    
    return API.put<Worker>(`${this.endpoint}/${id}`, formattedData);
  }

  static async delete(id: number): Promise<void> {
    return API.delete(`${this.endpoint}/${id}`);
  }

  static async getSkills(): Promise<any[]> {
    return API.get<any[]>(`${this.endpoint}/skills`);
  }
}
```

# frontend/src/types/common.ts

```ts
// src/types/common.ts

export class ApiError extends Error {
  status: number;
  data?: any;

  constructor(message: string, status: number = 500, data?: any) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
    
    // Damit instanceof auch mit transpiliertem Code funktioniert
    Object.setPrototypeOf(this, ApiError.prototype);
  }
}

export type PaginatedResponse<T> = {
  data: T[];
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
};

export type ApiResponse<T> = {
  data: T;
  message?: string;
  status: number;
};

export type ApiErrorType = {
  message: string;
  code?: string;
  details?: Record<string, any>;
  status?: number;
  field?: string;
};

export type BaseEntity = {
  id: number;
  created_at: string;
  updated_at: string;
};
```

# frontend/src/types/document.ts

```ts
// src/types/document.ts
import { BaseEntity } from './common';

export interface Document extends BaseEntity {
  filename: string;
  original_filename: string;
  mime_type: string;
  file_size: number;
  category_id: number;
  category_name: string;
  tenant_id?: number;
  tenant?: {
    id: number;
    first_name: string;
    last_name: string;
  };
  description?: string;
  is_confidential: boolean;
  tags: string[];
  upload_date: string;
  created_by: string;
  file_path?: string;
  content?: Uint8Array;
}

export interface DocumentUploadData {
  file: File;
  categoryId: number;
  tenantId?: number;
  description?: string;
  isConfidential: boolean;
  tags?: string[];
}
```

# frontend/src/types/property.ts

```ts
// src/types/property.ts
import { BaseEntity } from './common';

export interface Property extends BaseEntity {
  address: string;
  property_type: string;
  total_rent: number;
  units: Unit[];
}

export interface Unit extends BaseEntity {
  property_id: number;
  name: string;
  type: string;
  size: number;
  status: 'verfügbar' | 'besetzt';
  rent?: number;
}

export interface PropertyFormData {
  address: string;
  property_type: string;
  units: Omit<Unit, 'id' | 'property_id' | 'created_at' | 'updated_at'>[];
}
```

# frontend/src/types/tenant.ts

```ts
// src/types/tenant.ts
import { BaseEntity } from './common';

export interface Tenant extends BaseEntity {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  address: string;
  unit_id: number | null;
  rent_start_date: string;
  rent_end_date: string | null;
  active: boolean;
  
  // Include these fields that are returned from the API
  unit_name?: string;
  unit_type?: string;
  property_address?: string;
  property_type?: string;
}

export interface TenantFormData {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  address: string;
  unit_id: number | null | string; // Accept string for form select handling
  rent_start_date: string;
  rent_end_date: string | null;
  active?: boolean; // Allow undefined in form but add in service
}
```

# frontend/src/types/worker.ts

```ts
// src/types/worker.ts
import { BaseEntity } from './common';

export interface Worker extends BaseEntity {
  first_name: string;
  last_name: string;
  phone: string;
  email: string;
  hourly_rate: number;
  skills: WorkerSkill[];
  active: boolean;
}

export interface Skill {
  id: number;
  name: string;
  description?: string;
}

export interface WorkerSkill {
  id: number;
  name?: string;
  experience_years: number;
}

export interface WorkerFormData {
  first_name: string;
  last_name: string;
  phone: string;
  email: string;
  hourly_rate: number | string; // Accept both types for form handling flexibility
  skills: WorkerSkill[];
  active: boolean; // Make sure this is required
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
	  container: {
		center: true,
		padding: "2rem",
		screens: {
		  "2xl": "1400px",
		},
	  },
	  extend: {
		colors: {
		  border: "hsl(var(--border))",
		  input: "hsl(var(--input))",
		  ring: "hsl(var(--ring))",
		  background: "hsl(var(--background))",
		  foreground: "hsl(var(--foreground))",
		  primary: {
			DEFAULT: "hsl(var(--primary))",
			foreground: "hsl(var(--primary-foreground))",
		  },
		  secondary: {
			DEFAULT: "hsl(var(--secondary))",
			foreground: "hsl(var(--secondary-foreground))",
		  },
		  destructive: {
			DEFAULT: "hsl(var(--destructive))",
			foreground: "hsl(var(--destructive-foreground))",
		  },
		  muted: {
			DEFAULT: "hsl(var(--muted))",
			foreground: "hsl(var(--muted-foreground))",
		  },
		  accent: {
			DEFAULT: "hsl(var(--accent))",
			foreground: "hsl(var(--accent-foreground))",
		  },
		  popover: {
			DEFAULT: "hsl(var(--popover))",
			foreground: "hsl(var(--popover-foreground))",
		  },
		  card: {
			DEFAULT: "hsl(var(--card))",
			foreground: "hsl(var(--card-foreground))",
		  },
		},
		borderRadius: {
		  lg: "var(--radius)",
		  md: "calc(var(--radius) - 2px)",
		  sm: "calc(var(--radius) - 4px)",
		},
		keyframes: {
		  "accordion-down": {
			from: { height: "0" },
			to: { height: "var(--radix-accordion-content-height)" },
		  },
		  "accordion-up": {
			from: { height: "var(--radix-accordion-content-height)" },
			to: { height: "0" },
		  },
		  "collapsible-down": {
			from: { height: "0" },
			to: { height: "var(--radix-collapsible-content-height)" },
		  },
		  "collapsible-up": {
			from: { height: "var(--radix-collapsible-content-height)" },
			to: { height: "0" },
		  },
		},
		animation: {
		  "accordion-down": "accordion-down 0.2s ease-out",
		  "accordion-up": "accordion-up 0.2s ease-out",
		  "collapsible-down": "collapsible-down 0.2s ease-out",
		  "collapsible-up": "collapsible-up 0.2s ease-out",
		},
	  },
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


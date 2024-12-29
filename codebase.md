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
import { createWorkerRoutes } from './routes/workers'; // Neuer Import

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

// Routes registrieren
app.use('/properties', createPropertyRoutes(db));
app.use('/tenants', createTenantRoutes(db));
app.use('/documents', createDocumentRoutes(db));
app.use('/workers', createWorkerRoutes(db)); // Neue Route

// Dashboard Statistiken Endpunkt
app.get('/dashboard/stats', (_req, res) => {
  (async () => {
    try {
      // Gesamtanzahl Immobilien
      const propertiesCount = await db.query('SELECT COUNT(*) FROM properties');

      // Gesamtanzahl Wohneinheiten
      const unitsCount = await db.query('SELECT COUNT(*) FROM units');

      // Monatliche Gesamtmiete
      const totalRent = await db.query(
        'SELECT COALESCE(SUM(rent), 0) FROM units WHERE status = $1', 
        ['besetzt']
      );

      // Leerstehende Einheiten
      const vacantUnits = await db.query(`
        SELECT u.*, p.address as property_address
        FROM units u
        JOIN properties p ON u.property_id = p.id
        WHERE u.status = $1
      `, ['verfügbar']);

      // Aktive Handwerker (NEU)
      const workersCount = await db.query(
        'SELECT COUNT(*) FROM workers WHERE active = true'
      );

      res.json({
        total_properties: propertiesCount.rows[0].count,
        total_units: unitsCount.rows[0].count,
        monthly_rent: totalRent.rows[0].coalesce,
        vacant_units: vacantUnits.rows,
        active_workers: workersCount.rows[0].count // NEU
      });
    } catch (error) {
      console.error('Dashboard Statistiken Fehler:', error);
      res.status(500).json({ error: 'Fehler beim Laden der Dashboard-Daten' });
    }
  })();
});

// Server starten
const PORT = 3001;
app.listen(PORT, () => {
  console.log(`Server läuft auf Port ${PORT}`);
});
```

# backend/src/routes/documents.ts

```ts
import express, { Request, Response } from 'express';
import multer from 'multer';
import { Pool } from 'pg';
import { DocumentService } from '../services/DocumentService';

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
    "@radix-ui/react-toast": "^1.2.4",
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
// src/App.tsx
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
        <Sidebar>
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<Dashboard />} />
            
            {/* Property Routes */}
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
import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Building2, Home, Currency, AlertCircle } from 'lucide-react';

interface DashboardStats {
    total_properties: number;
    total_units: number;
    monthly_rent: number;
    top_properties: Array<{
        id: number;
        address: string;
        property_type: string;
        total_rent: number;
    }>;
    vacant_units: Array<{
        id: number;
        name: string;
        property_address: string;
        type: string;
        size: number;
    }>;
}

export default function Dashboard() {
    const [stats, setStats] = useState<DashboardStats | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchDashboardStats = async () => {
            try {
                const response = await fetch('http://localhost:3001/dashboard/stats');
                const data = await response.json();
                setStats(data);
            } catch (error) {
                console.error('Fehler beim Laden der Dashboard-Daten:', error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchDashboardStats();
    }, []);

    if (isLoading) return <div>Lade Dashboard...</div>;
    if (!stats) return <div>Keine Daten verfügbar</div>;

    return (
        <div className="p-4 space-y-6">
            {/* Übersichtskarten */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
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
                            {stats.monthly_rent.toLocaleString('de-DE')} €
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
            </div>



            {/* Leerstehende Einheiten */}
            <Card>
                <CardHeader>
                    <CardTitle>Leerstehende Einheiten</CardTitle>
                </CardHeader>
                <CardContent>
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
                </CardContent>
            </Card>
        </div>
    );
}
```

# frontend/src/components/Dokumente/DocumentDetail.tsx

```tsx
import { useState, useEffect } from 'react';
import { downloadFile } from '@/lib/downloads';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Download,
  Pencil,
  Trash2,
  Calendar,
  User,
  Tag,
  Lock,
  File,
  Eye,
  Clock
} from 'lucide-react';

interface Document {
  id: number;
  filename: string;
  original_filename: string;
  mime_type: string;
  file_size: number;
  upload_date: string;
  last_modified: string;
  category_name: string;
  description?: string;
  is_confidential: boolean;
  created_by: string;
  tenant?: {
    id: number;
    first_name: string;
    last_name: string;
  };
  tags: string[];
}

export default function DocumentDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [document, setDocument] = useState<Document | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showPreview, setShowPreview] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    loadDocument();
  }, [id]);

  const loadDocument = async () => {
    try {
      const response = await fetch(`http://localhost:3001/documents/${id}`);
      if (!response.ok) throw new Error('Laden fehlgeschlagen');
      const data = await response.json();
      setDocument(data);

      // Wenn es sich um ein PDF oder Bild handelt, generiere Preview URL
      if (data.mime_type.startsWith('image/') || data.mime_type === 'application/pdf') {
        const previewResponse = await fetch(`http://localhost:3001/documents/${id}/preview`);
        if (previewResponse.ok) {
          const blob = await previewResponse.blob();
          setPreviewUrl(URL.createObjectURL(blob));
        }
      }
    } catch (error) {
      console.error('Fehler beim Laden:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownload = async () => {
    try {
      const response = await fetch(`http://localhost:3001/documents/${id}/download`);
      const blob = await response.blob();
      downloadFile(blob, document?.original_filename || 'document');
    } catch (error) {
      console.error('Fehler beim Download:', error);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Möchten Sie dieses Dokument wirklich löschen?')) return;

    try {
      const response = await fetch(`http://localhost:3001/documents/${id}`, {
        method: 'DELETE'
      });
      
      if (!response.ok) throw new Error('Löschen fehlgeschlagen');
      
      navigate('/documents');
    } catch (error) {
      console.error('Fehler beim Löschen:', error);
    }
  };

  if (isLoading) return <div>Lade Dokument...</div>;
  if (!document) return <div>Dokument nicht gefunden</div>;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header mit Aktionen */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold">{document.original_filename}</h1>
          <p className="text-muted-foreground">{document.category_name}</p>
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
            onClick={() => navigate(`/documents/${id}/edit`)}
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
                  <p>{document.mime_type}</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Hochgeladen am</p>
                  <p>{new Date(document.upload_date).toLocaleDateString()}</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Zuletzt geändert</p>
                  <p>{new Date(document.last_modified).toLocaleDateString()}</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Erstellt von</p>
                  <p>{document.created_by}</p>
                </div>
              </div>

              {document.tenant && (
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Zugeordneter Mieter</p>
                    <p>
                      {document.tenant.first_name} {document.tenant.last_name}
                    </p>
                  </div>
                </div>
              )}

              {document.is_confidential && (
                <div className="flex items-center gap-2 text-red-600">
                  <Lock className="w-4 h-4" />
                  <p>Vertrauliches Dokument</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Tags */}
          {document.tags.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Tags</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {document.tags.map((tag, index) => (
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
          {document.description && (
            <Card>
              <CardHeader>
                <CardTitle>Beschreibung</CardTitle>
              </CardHeader>
              <CardContent>
                <p>{document.description}</p>
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
              {previewUrl ? (
                document.mime_type.startsWith('image/') ? (
                  <img
                    src={previewUrl}
                    alt={document.original_filename}
                    className="max-w-full h-auto rounded-lg"
                  />
                ) : document.mime_type === 'application/pdf' ? (
                  <iframe
                    src={previewUrl}
                    className="w-full h-[600px] rounded-lg"
                    title={document.original_filename}
                  />
                ) : null
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

# frontend/src/components/Dokumente/DocumentList.tsx

```tsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    FileText,
    Upload,
    Search,
    Filter,
    Tag,
    User,
    Calendar,
    Download,
    Trash2
} from 'lucide-react';

interface Document {
    id: number;
    filename: string;
    original_filename: string;
    category_name: string;
    upload_date: string;
    description?: string;
    tenant?: {
        id: number;
        first_name: string;
        last_name: string;
    };
    tags: string[];
    is_confidential: boolean;
    created_by: string;
}

interface Category {
    id: number;
    name: string;
}

export default function DocumentList() {
    const navigate = useNavigate();
    const [documents, setDocuments] = useState<Document[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategory, setSelectedCategory] = useState<string>("all");
    const [showConfidential, setShowConfidential] = useState<boolean | null>(null);

    useEffect(() => {
        loadDocuments();
        loadCategories();
    }, []);

    const loadDocuments = async () => {
        try {
            console.log('Fetching documents...');
            const response = await fetch('http://localhost:3001/documents');
            console.log('Response status:', response.status);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            console.log('Received documents:', data);
            
            if (!Array.isArray(data)) {
                throw new Error('Received invalid documents data');
            }
            
            setDocuments(data);
        } catch (error) {
            console.error('Fehler beim Laden der Dokumente:', error);
        } finally {
            setIsLoading(false);
        }
    };

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
        if (!confirm('Möchten Sie dieses Dokument wirklich löschen?')) return;

        try {
            const response = await fetch(`http://localhost:3001/documents/${id}`, {
                method: 'DELETE'
            });

            if (!response.ok) throw new Error('Löschen fehlgeschlagen');

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

        const matchesCategory = selectedCategory === "all" || 
            doc.category_name === selectedCategory;

        const matchesConfidential =
            showConfidential === null ||
            doc.is_confidential === showConfidential;

        return matchesSearch && matchesCategory && matchesConfidential;
    });

    if (isLoading) return <div>Lade Dokumente...</div>;

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold">Dokumentenverwaltung</h1>
                <Button
                    onClick={() => navigate('/documents/upload')}
                    className="flex items-center gap-2"
                >
                    <Upload className="w-4 h-4" />
                    Dokument hochladen
                </Button>
            </div>

            {/* Filter-Leiste */}
            <Card>
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
                                    {Array.isArray(categories) && categories.map((cat) => (
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
            <div className="grid gap-4">
                {filteredDocuments.length > 0 ? (
                    filteredDocuments.map(doc => (
                        <Card key={doc.id} className="hover:bg-gray-50 transition-colors">
                            <CardHeader className="pb-2">
                                <div className="flex justify-between">
                                    <div className="flex items-start gap-3">
                                        <FileText className="w-5 h-5 mt-1" />
                                        <div>
                                            <CardTitle className="text-lg">
                                                {doc.original_filename}
                                            </CardTitle>
                                            {doc.description && (
                                                <p className="text-sm text-muted-foreground mt-1">
                                                    {doc.description}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => handleDownload(doc.id, doc.original_filename)}
                                        >
                                            <Download className="w-4 h-4" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => handleDelete(doc.id)}
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </Button>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="flex flex-wrap gap-4 text-sm">
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
                                        {new Date(doc.upload_date).toLocaleDateString()}
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

                                    {doc.is_confidential && (
                                        <span className="px-2 py-0.5 bg-red-100 text-red-800 rounded-md text-xs">
                                            Vertraulich
                                        </span>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    ))
                ) : (
                    <Card>
                        <CardContent className="p-6 text-center text-muted-foreground">
                            Keine Dokumente gefunden
                        </CardContent>
                    </Card>
                )}
            </div>
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
// src/components/EditPropertyWrapper.tsx
import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import PropertyForm from './PropertyForm';

export default function EditPropertyWrapper() {
  const { id } = useParams();
  const [property, setProperty] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    const loadProperty = async () => {
      try {
        const response = await fetch(`http://localhost:3001/properties/${id}`);
        if (!response.ok) throw new Error('Laden fehlgeschlagen');
        const data = await response.json();
        setProperty(data);
      } catch (error) {
        console.error('Fehler beim Laden:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadProperty();
  }, [id]);

  if (isLoading) return <div>Lade...</div>;
  if (!property) return <div>Immobilie nicht gefunden</div>;
  
  return <PropertyForm initialData={property} />;
}
```

# frontend/src/components/Immobilien/PropertyForm.tsx

```tsx
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


```

# frontend/src/components/Immobilien/PropertyList.tsx

```tsx
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

```

# frontend/src/components/Mieter/TenantEditWrapper.tsx

```tsx
import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import TenantForm from './TenantForm';

export default function TenantEditWrapper() {
  const { id } = useParams();
  const [tenant, setTenant] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    const loadTenant = async () => {
      try {
        const response = await fetch(`http://localhost:3001/tenants/${id}`);
        if (!response.ok) throw new Error('Laden fehlgeschlagen');
        const data = await response.json();
        setTenant(data);
      } catch (error) {
        console.error('Fehler beim Laden:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadTenant();
  }, [id]);

  if (isLoading) return <div>Lade...</div>;
  if (!tenant) return <div>Mieter nicht gefunden</div>;
  
  return <TenantForm initialData={tenant} />;
}
```

# frontend/src/components/Mieter/TenantForm.tsx

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
} from "@/components/ui/select";

interface Unit {
  id: number;
  name: string;
  property_address: string;
  status: string;
}

interface Tenant {
  id?: number;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  address: string;
  unit_id?: number;
  rent_start_date?: string;
}

interface TenantFormProps {
  initialData?: Tenant;
}

export default function TenantForm({ initialData }: TenantFormProps) {
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [availableUnits, setAvailableUnits] = useState<Unit[]>([]);

  // Form State mit initialData oder Defaultwerten
  const [tenant, setTenant] = useState<Tenant>(() => ({
    first_name: initialData?.first_name || '',
    last_name: initialData?.last_name || '',
    email: initialData?.email || '',
    phone: initialData?.phone || '',
    address: initialData?.address || '',
    unit_id: initialData?.unit_id,
    rent_start_date: initialData?.rent_start_date || new Date().toISOString().split('T')[0]
  }));

  // Lade verfügbare Units
  useEffect(() => {
    const loadAvailableUnits = async () => {
      try {
        const response = await fetch('http://localhost:3001/properties');
        if (!response.ok) throw new Error('Laden fehlgeschlagen');
        const properties = await response.json();
        
        // Extrahiere alle verfügbaren Units aus den Properties
        const units = properties.flatMap((property: any) => 
          property.units
            .filter((unit: any) => 
              unit.status === 'verfügbar' || unit.id === initialData?.unit_id
            )
            .map((unit: any) => ({
              ...unit,
              property_address: property.address
            }))
        );
        
        setAvailableUnits(units);
      } catch (error) {
        console.error('Fehler beim Laden der Units:', error);
      }
    };

    loadAvailableUnits();
  }, [initialData?.unit_id]);

  // Form Submit Handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const url = initialData
        ? `http://localhost:3001/tenants/${initialData.id}`
        : 'http://localhost:3001/tenants';

      const response = await fetch(url, {
        method: initialData ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(tenant)
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Ein Fehler ist aufgetreten');
      }

      navigate('/tenants');
    } catch (error) {
      console.error('Fehler beim Speichern:', error);
      alert(error instanceof Error ? error.message : 'Ein Fehler ist aufgetreten');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="p-4 max-w-2xl mx-auto">
      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>
              {initialData ? 'Mieter bearbeiten' : 'Neuer Mieter'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Persönliche Daten */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Vorname</label>
                <Input
                  required
                  value={tenant.first_name}
                  onChange={e => setTenant({ ...tenant, first_name: e.target.value })}
                  className="mt-1"
                  disabled={isSubmitting}
                />
              </div>

              <div>
                <label className="text-sm font-medium">Nachname</label>
                <Input
                  required
                  value={tenant.last_name}
                  onChange={e => setTenant({ ...tenant, last_name: e.target.value })}
                  className="mt-1"
                  disabled={isSubmitting}
                />
              </div>

              <div>
                <label className="text-sm font-medium">E-Mail</label>
                <Input
                  type="email"
                  value={tenant.email}
                  onChange={e => setTenant({ ...tenant, email: e.target.value })}
                  className="mt-1"
                  disabled={isSubmitting}
                />
              </div>

              <div>
                <label className="text-sm font-medium">Telefon</label>
                <Input
                  type="tel"
                  value={tenant.phone}
                  onChange={e => setTenant({ ...tenant, phone: e.target.value })}
                  className="mt-1"
                  disabled={isSubmitting}
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium">Adresse</label>
              <Input
                value={tenant.address}
                onChange={e => setTenant({ ...tenant, address: e.target.value })}
                className="mt-1"
                disabled={isSubmitting}
              />
            </div>

            {/* Wohneinheit und Mietbeginn */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Wohneinheit</label>
                <Select
                  value={tenant.unit_id?.toString()}
                  onValueChange={(value) => 
                    setTenant({ ...tenant, unit_id: parseInt(value) })
                  }
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Wohneinheit auswählen" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableUnits.map((unit) => (
                      <SelectItem key={unit.id} value={unit.id.toString()}>
                        {unit.name} ({unit.property_address})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium">Mietbeginn</label>
                <Input
                  type="date"
                  value={tenant.rent_start_date}
                  onChange={e => setTenant({ ...tenant, rent_start_date: e.target.value })}
                  className="mt-1"
                  disabled={isSubmitting}
                />
              </div>
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
            onClick={() => navigate('/tenants')}
            disabled={isSubmitting}
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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PlusCircle, Pencil, Trash2, UserPlus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { SkeletonCard } from '@/components/ui/Skeleton-Card';
import { ErrorCard } from '@/components/ui/Error-Card';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/AlertDialog';

interface Tenant {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  address: string;
  unit_name?: string;
  unit_type?: string;
  property_address?: string;
}

export default function TenantList() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState<number | null>(null);
  const [tenantToDelete, setTenantToDelete] = useState<Tenant | null>(null);
  const navigate = useNavigate();
  const { showSuccessToast, showErrorToast } = useToast();

  const loadTenants = async () => {
    try {
      setError(null);
      const response = await fetch('http://localhost:3001/tenants');
      if (!response.ok) throw new Error('Laden fehlgeschlagen');
      const data = await response.json();
      setTenants(data);
    } catch (error) {
      console.error('Fehler beim Laden:', error);
      setError('Die Mieter konnten nicht geladen werden.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadTenants();
  }, []);

  const handleDelete = async (tenant: Tenant) => {
    setTenantToDelete(tenant);
  };

  const confirmDelete = async () => {
    if (!tenantToDelete) return;
    
    setIsDeleting(tenantToDelete.id);
    try {
      const response = await fetch(`http://localhost:3001/tenants/${tenantToDelete.id}`, {
        method: 'DELETE'
      });

      if (!response.ok) throw new Error('Löschen fehlgeschlagen');
      
      await loadTenants();
      showSuccessToast(
        'Mieter gelöscht',
        'Der Mieter wurde erfolgreich gelöscht.'
      );
    } catch (error) {
      console.error('Fehler beim Löschen:', error);
      showErrorToast(
        'Fehler beim Löschen',
        'Der Mieter konnte nicht gelöscht werden.'
      );
    } finally {
      setIsDeleting(null);
      setTenantToDelete(null);
    }
  };

  if (isLoading) {
    return (
      <div className="p-4 max-w-4xl mx-auto space-y-4">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">Mieterverwaltung</h1>
        </div>
        {[1, 2, 3].map((i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 max-w-4xl mx-auto">
        <ErrorCard
          title="Fehler beim Laden"
          message={error}
          onRetry={loadTenants}
        />
      </div>
    );
  }

  return (
    <div className="p-4 max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Mieterverwaltung</h1>
        <Button
          className="flex items-center gap-2"
          onClick={() => navigate('/tenants/new')}
        >
          <UserPlus className="w-4 h-4" />
          Neuer Mieter
        </Button>
      </div>

      {tenants.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="text-muted-foreground mb-4">Keine Mieter vorhanden</p>
            <Button
              onClick={() => navigate('/tenants/new')}
              className="flex items-center gap-2"
            >
              <PlusCircle className="w-4 h-4" />
              Ersten Mieter hinzufügen
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {tenants.map(tenant => (
            <Card 
              key={tenant.id}
              className="transition-all duration-200 hover:border-primary/50"
            >
              <CardHeader>
                <div className="flex justify-between items-start">
                  <CardTitle>
                    {tenant.first_name} {tenant.last_name}
                  </CardTitle>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => navigate(`/tenants/edit/${tenant.id}`)}
                      disabled={isDeleting === tenant.id}
                      className="transition-colors hover:border-primary"
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleDelete(tenant)}
                      disabled={isDeleting === tenant.id}
                      className="transition-colors hover:border-destructive hover:text-destructive"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-500">Kontakt</p>
                    <p>{tenant.email}</p>
                    <p>{tenant.phone}</p>
                    <p>{tenant.address}</p>
                  </div>
                  {tenant.unit_name && (
                    <div>
                      <p className="text-sm text-gray-500">Wohneinheit</p>
                      <p>{tenant.unit_name}</p>
                      <p>{tenant.property_address}</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <AlertDialog 
        open={tenantToDelete !== null}
        onOpenChange={(open) => !open && setTenantToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Mieter löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              Möchten Sie den Mieter {tenantToDelete?.first_name} {tenantToDelete?.last_name} wirklich löschen?
              Diese Aktion kann nicht rückgängig gemacht werden.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
```

# frontend/src/components/Mitarbeiter/WorkerEditWrapper.tsx

```tsx
// src/components/Handwerker/WorkerEditWrapper.tsx
import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import WorkerForm from './WorkerForm';
import { Worker } from '@/types/worker';

export default function WorkerEditWrapper() {
  const { id } = useParams();
  const [worker, setWorker] = useState<Worker | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    const loadWorker = async () => {
      try {
        const response = await fetch(`http://localhost:3001/workers/${id}`);
        if (!response.ok) throw new Error('Laden fehlgeschlagen');
        const data = await response.json();
        setWorker(data);
      } catch (error) {
        console.error('Fehler beim Laden:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadWorker();
  }, [id]);

  if (isLoading) return <div>Lade...</div>;
  if (!worker) return <div>Handwerker nicht gefunden</div>;
  
  return <WorkerForm initialData={worker} />;
}
```

# frontend/src/components/Mitarbeiter/WorkerForm.tsx

```tsx
// src/components/Handwerker/WorkerForm.tsx
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
import { Plus, X } from 'lucide-react';
import { Worker, Skill, WorkerSkill } from '@/types/worker';

interface WorkerFormProps {
  initialData?: Worker;
}

export default function WorkerForm({ initialData }: WorkerFormProps) {
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [availableSkills, setAvailableSkills] = useState<Skill[]>([]);
  
  // Formular-State mit initialData oder Defaultwerten
  const [worker, setWorker] = useState<Worker>(() => ({
    first_name: initialData?.first_name || '',
    last_name: initialData?.last_name || '',
    phone: initialData?.phone || '',
    email: initialData?.email || '',
    hourly_rate: initialData?.hourly_rate || '',
    skills: initialData?.skills || [],
    active: initialData?.active ?? true
  }));

  // Lade verfügbare Skills
  useEffect(() => {
    const loadSkills = async () => {
      try {
        const response = await fetch('http://localhost:3001/workers/skills');
        if (!response.ok) throw new Error('Laden fehlgeschlagen');
        const data = await response.json();
        setAvailableSkills(data);
      } catch (error) {
        console.error('Fehler beim Laden der Skills:', error);
      }
    };

    loadSkills();
  }, []);

  const handleAddSkill = () => {
    setWorker(prev => ({
      ...prev,
      skills: [...prev.skills, { id: 0, experience_years: 0 }]
    }));
  };

  const handleRemoveSkill = (index: number) => {
    setWorker(prev => ({
      ...prev,
      skills: prev.skills.filter((_, i) => i !== index)
    }));
  };

  const updateSkill = (index: number, field: keyof WorkerSkill, value: any) => {
    setWorker(prev => ({
      ...prev,
      skills: prev.skills.map((skill, i) => {
        if (i !== index) return skill;
        return { ...skill, [field]: field === 'id' ? parseInt(value) : value };
      })
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const url = initialData
        ? `http://localhost:3001/workers/${initialData.id}`
        : 'http://localhost:3001/workers';

      const response = await fetch(url, {
        method: initialData ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...worker,
          hourly_rate: worker.hourly_rate === '' ? null : Number(worker.hourly_rate)
        })
      });

      if (!response.ok) throw new Error('Speichern fehlgeschlagen');
      navigate('/workers');
    } catch (error) {
      console.error('Fehler beim Speichern:', error);
      alert('Fehler beim Speichern des Handwerkers');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="p-4 max-w-2xl mx-auto">
      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>
              {initialData ? 'Handwerker bearbeiten' : 'Neuer Handwerker'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Persönliche Daten */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Vorname</label>
                <Input
                  required
                  value={worker.first_name}
                  onChange={e => setWorker({ ...worker, first_name: e.target.value })}
                  className="mt-1"
                  disabled={isSubmitting}
                />
              </div>

              <div>
                <label className="text-sm font-medium">Nachname</label>
                <Input
                  required
                  value={worker.last_name}
                  onChange={e => setWorker({ ...worker, last_name: e.target.value })}
                  className="mt-1"
                  disabled={isSubmitting}
                />
              </div>

              <div>
                <label className="text-sm font-medium">Telefon</label>
                <Input
                  required
                  type="tel"
                  value={worker.phone}
                  onChange={e => setWorker({ ...worker, phone: e.target.value })}
                  className="mt-1"
                  disabled={isSubmitting}
                />
              </div>

              <div>
                <label className="text-sm font-medium">E-Mail</label>
                <Input
                  type="email"
                  value={worker.email}
                  onChange={e => setWorker({ ...worker, email: e.target.value })}
                  className="mt-1"
                  disabled={isSubmitting}
                />
              </div>

              <div>
                <label className="text-sm font-medium">Stundensatz (€)</label>
                <Input
                  type="number"
                  value={worker.hourly_rate}
                  onChange={e => setWorker({ ...worker, hourly_rate: e.target.value })}
                  className="mt-1"
                  disabled={isSubmitting}
                  min="0"
                  step="0.01"
                />
              </div>
            </div>

            {/* Fähigkeiten */}
            <div>
              <div className="flex justify-between items-center mb-4">
                <label className="text-sm font-medium">Fähigkeiten</label>
                <Button
                  type="button"
                  onClick={handleAddSkill}
                  disabled={isSubmitting}
                  className="flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Fähigkeit hinzufügen
                </Button>
              </div>

              <div className="space-y-4">
                {worker.skills.map((skill, index) => (
                  <Card key={index}>
                    <CardContent className="pt-4">
                      <div className="flex items-end gap-4">
                        <div className="flex-1">
                          <label className="text-sm font-medium">Fähigkeit</label>
                          <Select
                            value={skill.id.toString()}
                            onValueChange={(value) => updateSkill(index, 'id', value)}
                          >
                            <SelectTrigger className="mt-1">
                              <SelectValue placeholder="Fähigkeit auswählen" />
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

                        <div className="flex-1">
                          <label className="text-sm font-medium">Erfahrung (Jahre)</label>
                          <Input
                            type="number"
                            value={skill.experience_years}
                            onChange={(e) => updateSkill(index, 'experience_years', parseInt(e.target.value))}
                            className="mt-1"
                            min="0"
                            step="1"
                          />
                        </div>

                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          onClick={() => handleRemoveSkill(index)}
                          className="mb-1"
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Form Buttons */}
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
            onClick={() => navigate('/workers')}
            disabled={isSubmitting}
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
// src/components/Handwerker/WorkerList.tsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  UserPlus, 
  Pencil, 
  Trash2,
  Phone,
  Mail,
  Wrench
} from 'lucide-react';

interface Skill {
  id: number;
  name: string;
  experience_years: number;
}

interface Worker {
  id: number;
  first_name: string;
  last_name: string;
  phone: string;
  email: string;
  hourly_rate: number;
  skills: Skill[];
  active: boolean;
}

export default function WorkerList() {
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState<number | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    loadWorkers();
  }, []);

  const loadWorkers = async () => {
    try {
      const response = await fetch('http://localhost:3001/workers');
      if (!response.ok) throw new Error('Laden fehlgeschlagen');
      const data = await response.json();
      setWorkers(data);
    } catch (error) {
      console.error('Fehler beim Laden:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Möchten Sie diesen Handwerker wirklich deaktivieren?')) return;

    setIsDeleting(id);
    try {
      const response = await fetch(`http://localhost:3001/workers/${id}`, {
        method: 'DELETE'
      });

      if (!response.ok) throw new Error('Löschen fehlgeschlagen');
      await loadWorkers();
    } catch (error) {
      console.error('Fehler beim Deaktivieren:', error);
    } finally {
      setIsDeleting(null);
    }
  };

  if (isLoading) return <div>Lade Handwerker...</div>;

  return (
    <div className="p-4 max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Handwerkerverwaltung</h1>
        <Button
          className="flex items-center gap-2"
          onClick={() => navigate('/workers/new')}
        >
          <UserPlus className="w-4 h-4" />
          Neuer Handwerker
        </Button>
      </div>

      {workers.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="text-muted-foreground mb-4">Keine Handwerker vorhanden</p>
            <Button
              onClick={() => navigate('/workers/new')}
              className="flex items-center gap-2"
            >
              <UserPlus className="w-4 h-4" />
              Ersten Handwerker hinzufügen
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {workers.map(worker => (
            <Card key={worker.id}>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <CardTitle className="text-xl">
                    {worker.first_name} {worker.last_name}
                  </CardTitle>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => navigate(`/workers/edit/${worker.id}`)}
                      disabled={isDeleting === worker.id}
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleDelete(worker.id)}
                      disabled={isDeleting === worker.id}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  {/* Kontaktinformationen */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm">
                      <Phone className="w-4 h-4 text-muted-foreground" />
                      <span>{worker.phone}</span>
                    </div>
                    {worker.email && (
                      <div className="flex items-center gap-2 text-sm">
                        <Mail className="w-4 h-4 text-muted-foreground" />
                        <span>{worker.email}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2 text-sm">
                      <span className="font-medium">Stundensatz:</span>
                      <span>{worker.hourly_rate} €/h</span>
                    </div>
                  </div>

                  {/* Fähigkeiten */}
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Wrench className="w-4 h-4 text-muted-foreground" />
                      <span className="font-medium">Fähigkeiten:</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {worker.skills?.map((skill, index) => (
                        <span
                          key={index}
                          className="inline-flex items-center px-2 py-1 rounded-md bg-secondary text-secondary-foreground text-sm"
                        >
                          {skill.name} ({skill.experience_years} Jahre)
                        </span>
                      ))}
                    </div>
                  </div>
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

# frontend/src/components/providers.tsx

```tsx
// src/components/providers.tsx
import * as React from "react"
import { Toaster } from "@/components/ui/toaster"
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
// src/components/ui/toast.tsx
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
  "group pointer-events-auto relative flex w-full items-center justify-between space-x-4 overflow-hidden rounded-md border p-6 pr-8 shadow-lg transition-all data-[swipe=cancel]:translate-x-0 data-[swipe=end]:translate-x-[var(--radix-toast-swipe-end-x)] data-[swipe=move]:translate-x-[var(--radix-toast-swipe-move-x)] data-[swipe=move]:transition-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[swipe=end]:animate-out data-[state=closed]:fade-out-80 data-[state=closed]:slide-out-to-right-full data-[state=open]:slide-in-from-top-full data-[state=open]:sm:slide-in-from-bottom-full",
  {
    variants: {
      variant: {
        default: "border bg-background",
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
      "inline-flex h-8 shrink-0 items-center justify-center rounded-md border bg-transparent px-3 text-sm font-medium ring-offset-background transition-colors hover:bg-secondary focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 group-[.destructive]:border-muted/40 group-[.destructive]:hover:border-destructive/30 group-[.destructive]:hover:bg-destructive group-[.destructive]:hover:text-destructive-foreground group-[.destructive]:focus:ring-destructive",
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
      "absolute right-2 top-2 rounded-md p-1 text-foreground/50 opacity-0 transition-opacity hover:text-foreground focus:opacity-100 focus:outline-none focus:ring-2 group-hover:opacity-100 group-[.destructive]:text-red-300 group-[.destructive]:hover:text-red-50 group-[.destructive]:focus:ring-red-400 group-[.destructive]:focus:ring-offset-red-600",
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
    className={cn("text-sm font-semibold", className)}
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
// src/components/ui/toaster.tsx
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast"
import { useToast } from "@/hooks/use-toast"

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

// TypeScript Typ-Definitionen
export type PropertyType = typeof propertyTypes[number];
export type UnitType = typeof UNIT_TYPES[number];
export type UnitStatus = typeof UNIT_STATUS[number];

// Interface für Property
export interface Property {
  id?: number;
  address: string;
  property_type: PropertyType;
  total_rent: number; 
  units: Unit[];
}

// Interface für Unit
export interface Unit {
  id?: number;
  name: string;
  type: UnitType;
  size: number | '';
  status: UnitStatus;
  rent?: number | '';
}

// Interface für API-Antworten
export interface ApiResponse<T> {
  data?: T;
  error?: string;
}
```

# frontend/src/hooks/use-toast.ts

```ts
// src/hooks/use-toast.ts
import * as React from "react"

import type {
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

type Toast = Omit<ToasterToast, "id">

function toast({ ...props }: Toast) {
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

function useToast() {
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

export { useToast, toast }
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
// src/lib/utils/download.ts
export function downloadFile(blob: Blob, filename: string) {
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  }
```

# frontend/src/lib/utils.ts

```ts
// src/lib/utils.ts
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

# frontend/src/types/property.ts

```ts
// types/property.ts

export interface Property {
  id?: number;
  address: string;
  size: number;
  price: number;
  property_type: string;
  total_rent: number; 
  units: Unit[];
}

export interface Unit {
  id?: number;
  name: string;
  type: string;
  size: number;
  status: string;
  rent: number;
}

export interface PropertyFormData {
  address: string;
  size: number | string;
  price: number | string;
  status: string;
  property_type: string;
  units?: Unit[];
}

export interface ApiResponse<T> {
  data?: T;
  error?: string;
}
```

# frontend/src/types/worker.ts

```ts
// src/types/worker.ts

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

export interface Worker {
    id?: number;
    first_name: string;
    last_name: string;
    phone: string;
    email: string;
    hourly_rate: number | string;
    skills: WorkerSkill[];
    active?: boolean;
}

export interface WorkerFormData {
    first_name: string;
    last_name: string;
    phone: string;
    email: string;
    hourly_rate: number | string;
    skills: WorkerSkill[];
    active?: boolean;
}
```

# frontend/src/vite-env.d.ts

```ts
/// <reference types="vite/client" />

```

# frontend/tailwind.config.js

```js
// tailwind.config.js
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
	plugins: [require("tailwindcss-animate")]
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


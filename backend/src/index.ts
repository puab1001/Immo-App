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
    const { address, size, price, status, units } = req.body;

    await client.query('BEGIN');
    
    // Property erstellen
    const propertyResult = await client.query(
      `INSERT INTO properties (address, size, price, status)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [address, size, price, status]
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

    const { address, size, price, status, units } = req.body;
    
    // Update property
    const propertyResult = await client.query(
      `UPDATE properties 
       SET address = $1, size = $2, price = $3, status = $4
       WHERE id = $5 
       RETURNING *`,
      [address, size, price, status, id]
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
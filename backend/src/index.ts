import express, { Request, Response } from 'express';
import cors from 'cors';
import { Pool } from 'pg';
import { ParamsDictionary } from 'express-serve-static-core';



interface PropertyParams extends ParamsDictionary {
  id: string;
}


const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Datenbank-Verbindung
const db = new Pool({
  user: 'postgres',
  password: 'postgres',
  host: 'localhost',
  port: 5432,
  database: 'property_db'
});

// Typdefinitionen
interface Property {
  id: number;
  address: string;
  size: number;
  price: number;
  status: string;
}

// GET alle Properties
app.get('/properties', async (_req: Request, res: Response) => {
  try {
    const result = await db.query('SELECT * FROM properties');
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Datenbank-Fehler' });
  }
});

// POST neue Property
app.post('/properties', async (req: Request, res: Response) => {
  const { address, size, price, status } = req.body;
  try {
    const result = await db.query(
      'INSERT INTO properties (address, size, price, status) VALUES ($1, $2, $3, $4) RETURNING *',
      [address, size, price, status]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Fehler beim Erstellen' });
  }
});




// GET einzelne Property
app.get('/properties/:id', (req: Request, res: Response) => {
  (async () => {
    try {
      const result = await db.query('SELECT * FROM properties WHERE id = $1', [req.params.id]);
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Immobilie nicht gefunden' });
      }
      res.json(result.rows[0]);
    } catch (error) {
      res.status(500).json({ error: 'Datenbank-Fehler' });
    }
  })();
});

// PUT Property aktualisieren
app.put('/properties/:id', (req: Request, res: Response) => {
  (async () => {
    const { address, size, price, status } = req.body;
    try {
      const result = await db.query(
        'UPDATE properties SET address = $1, size = $2, price = $3, status = $4 WHERE id = $5 RETURNING *',
        [address, size, price, status, req.params.id]
      );
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Immobilie nicht gefunden' });
      }
      res.json(result.rows[0]);
    } catch (error) {
      res.status(500).json({ error: 'Fehler beim Aktualisieren' });
    }
  })();
});

// DELETE Property
app.delete('/properties/:id', (req: Request, res: Response) => {
  (async () => {
    try {
      const result = await db.query('DELETE FROM properties WHERE id = $1 RETURNING *', [req.params.id]);
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Immobilie nicht gefunden' });
      }
      res.json({ message: 'Immobilie erfolgreich gelöscht' });
    } catch (error) {
      res.status(500).json({ error: 'Fehler beim Löschen' });
    }
  })();
});

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`Server läuft auf Port ${PORT}`);
});
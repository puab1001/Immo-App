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
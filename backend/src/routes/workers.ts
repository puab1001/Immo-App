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
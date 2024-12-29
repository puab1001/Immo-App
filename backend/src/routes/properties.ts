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
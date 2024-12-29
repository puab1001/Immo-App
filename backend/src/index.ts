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
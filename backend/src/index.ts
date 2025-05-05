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
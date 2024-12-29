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
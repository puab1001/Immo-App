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
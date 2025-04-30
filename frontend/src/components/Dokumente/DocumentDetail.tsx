// src/components/Dokumente/DocumentDetail.tsx
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  FileText,
  Download,
  Pencil,
  Trash2,
  Calendar,
  User,
  Tag,
  Lock,
  File,
  Eye,
  Filter,
  ArrowLeft,
  XCircle
} from 'lucide-react';
import { Document } from '@/types/document';
import { useAsync } from '@/hooks/useAsync';
import { useConfirmation } from '@/hooks/useConfirmation';
import { DocumentService } from '@/services/DocumentService';
import { LoadingState } from '@/components/ui/LoadingState';
import { ErrorState } from '@/components/ui/ErrorState';
import { formatFileSize, formatDate } from '@/lib/formatters';
import { downloadFile } from '@/lib/downloads';

export default function DocumentDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [documentData, setDocumentData] = useState<Document | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const { execute: fetchDocument, isLoading, error } = useAsync(
    () => DocumentService.getById(Number(id)),
    {
      errorMessage: 'Fehler beim Laden des Dokuments'
    }
  );

  const confirmDelete = useConfirmation({
    title: 'Dokument löschen?',
    message: 'Möchten Sie dieses Dokument wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.',
    confirmText: 'Löschen',
    cancelText: 'Abbrechen'
  });

  useEffect(() => {
    if (id) {
      loadDocument();
    }
  }, [id]);

  // Aufräumen der URL beim Komponentenabbau
  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const { execute: fetchPreview, isLoading: isLoadingPreview, error: previewError } = useAsync(
    async (documentId: number) => {
      const blob = await DocumentService.getPreview(documentId);
      return URL.createObjectURL(blob);
    },
    {
      errorMessage: 'Fehler beim Laden der Vorschau',
      showErrorToast: true
    }
  );

  const loadDocument = async () => {
    try {
      const data = await fetchDocument();
      setDocumentData(data);
      if (data.id) {
        const previewUrl = await fetchPreview(data.id);
        setPreviewUrl(previewUrl);
      }
    } catch (error) {
      console.error('Fehler beim Laden:', error);
    }
  };

  const handleDownload = async () => {
    if (!documentData || !id) return;

    try {
      const response = await fetch(DocumentService.getDownloadUrl(Number(id)));
      
      if (!response.ok) {
        throw new Error('Download fehlgeschlagen');
      }
      
      const blob = await response.blob();
      const filename = documentData.original_filename;
      
      // Nutzen der Download-Hilfsfunktion statt direkter DOM-Manipulation
      downloadFile(blob, filename);
    } catch (error) {
      console.error('Fehler beim Download:', error);
    }
  };

  const handleDelete = async () => {
    if (!documentData) return;

    const confirmed = await confirmDelete.confirm();
    if (!confirmed) return;

    try {
      await DocumentService.delete(documentData.id);
      navigate('/documents');
    } catch (error) {
      console.error('Fehler beim Löschen:', error);
    }
  };

  if (isLoading) {
    return <LoadingState />;
  }

  if (error || !documentData) {
    return (
      <ErrorState
        title="Fehler beim Laden"
        message={error?.message || 'Dokument nicht gefunden'}
        onRetry={loadDocument}
      />
    );
  }

  return (
    <div className="p-4 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <Button
          variant="ghost"
          onClick={() => navigate('/documents')}
          className="mb-4"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Zurück zur Übersicht
        </Button>
        
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <FileText className="w-6 h-6" />
              {documentData.original_filename}
            </h1>
            <p className="text-muted-foreground mt-1">
              {documentData.category_name}
            </p>
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
              onClick={() => navigate(`/documents/${documentData.id}/edit`)}
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
                  <p>{documentData.mime_type}</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Hochgeladen am</p>
                  <p>{formatDate(documentData.upload_date)}</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Erstellt von</p>
                  <p>{documentData.created_by}</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Kategorie</p>
                  <p>{documentData.category_name}</p>
                </div>
              </div>

              {documentData.tenant && (
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Zugeordneter Mieter</p>
                    <p>
                      {documentData.tenant.first_name} {documentData.tenant.last_name}
                    </p>
                  </div>
                </div>
              )}

              {documentData.is_confidential && (
                <div className="flex items-center gap-2 text-red-600">
                  <Lock className="w-4 h-4" />
                  <p>Vertrauliches Dokument</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Tags */}
          {documentData.tags && documentData.tags.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Tags</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {documentData.tags.map((tag, index) => (
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
          {documentData.description && (
            <Card>
              <CardHeader>
                <CardTitle>Beschreibung</CardTitle>
              </CardHeader>
              <CardContent>
                <p>{documentData.description}</p>
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
              {isLoadingPreview ? (
                <div className="h-[400px] flex items-center justify-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                </div>
              ) : previewError ? (
                <div className="h-[400px] flex flex-col items-center justify-center text-destructive">
                  <XCircle className="w-8 h-8 mb-2" />
                  <p>Fehler beim Laden der Vorschau</p>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="mt-4"
                    onClick={() => documentData && fetchPreview(documentData.id)}
                  >
                    Erneut versuchen
                  </Button>
                </div>
              ) : previewUrl ? (
                documentData.mime_type.startsWith('image/') ? (
                  <img
                    src={previewUrl}
                    alt={documentData.original_filename}
                    className="max-w-full h-auto rounded-lg"
                  />
                ) : documentData.mime_type === 'application/pdf' ? (
                  <iframe
                    src={previewUrl}
                    className="w-full h-[600px] rounded-lg"
                    title={documentData.original_filename}
                  />
                ) : (
                  <div className="h-[400px] flex items-center justify-center text-muted-foreground">
                    Keine Vorschauunterstützung für diesen Dateityp
                  </div>
                )
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
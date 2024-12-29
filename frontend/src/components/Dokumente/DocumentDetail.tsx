import { useState, useEffect } from 'react';
import { downloadFile } from '@/lib/downloads';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Download,
  Pencil,
  Trash2,
  Calendar,
  User,
  Tag,
  Lock,
  File,
  Eye,
  Clock
} from 'lucide-react';

interface Document {
  id: number;
  filename: string;
  original_filename: string;
  mime_type: string;
  file_size: number;
  upload_date: string;
  last_modified: string;
  category_name: string;
  description?: string;
  is_confidential: boolean;
  created_by: string;
  tenant?: {
    id: number;
    first_name: string;
    last_name: string;
  };
  tags: string[];
}

export default function DocumentDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [document, setDocument] = useState<Document | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showPreview, setShowPreview] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    loadDocument();
  }, [id]);

  const loadDocument = async () => {
    try {
      const response = await fetch(`http://localhost:3001/documents/${id}`);
      if (!response.ok) throw new Error('Laden fehlgeschlagen');
      const data = await response.json();
      setDocument(data);

      // Wenn es sich um ein PDF oder Bild handelt, generiere Preview URL
      if (data.mime_type.startsWith('image/') || data.mime_type === 'application/pdf') {
        const previewResponse = await fetch(`http://localhost:3001/documents/${id}/preview`);
        if (previewResponse.ok) {
          const blob = await previewResponse.blob();
          setPreviewUrl(URL.createObjectURL(blob));
        }
      }
    } catch (error) {
      console.error('Fehler beim Laden:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownload = async () => {
    try {
      const response = await fetch(`http://localhost:3001/documents/${id}/download`);
      const blob = await response.blob();
      downloadFile(blob, document?.original_filename || 'document');
    } catch (error) {
      console.error('Fehler beim Download:', error);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Möchten Sie dieses Dokument wirklich löschen?')) return;

    try {
      const response = await fetch(`http://localhost:3001/documents/${id}`, {
        method: 'DELETE'
      });
      
      if (!response.ok) throw new Error('Löschen fehlgeschlagen');
      
      navigate('/documents');
    } catch (error) {
      console.error('Fehler beim Löschen:', error);
    }
  };

  if (isLoading) return <div>Lade Dokument...</div>;
  if (!document) return <div>Dokument nicht gefunden</div>;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header mit Aktionen */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold">{document.original_filename}</h1>
          <p className="text-muted-foreground">{document.category_name}</p>
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
            onClick={() => navigate(`/documents/${id}/edit`)}
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
                  <p>{document.mime_type}</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Hochgeladen am</p>
                  <p>{new Date(document.upload_date).toLocaleDateString()}</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Zuletzt geändert</p>
                  <p>{new Date(document.last_modified).toLocaleDateString()}</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Erstellt von</p>
                  <p>{document.created_by}</p>
                </div>
              </div>

              {document.tenant && (
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Zugeordneter Mieter</p>
                    <p>
                      {document.tenant.first_name} {document.tenant.last_name}
                    </p>
                  </div>
                </div>
              )}

              {document.is_confidential && (
                <div className="flex items-center gap-2 text-red-600">
                  <Lock className="w-4 h-4" />
                  <p>Vertrauliches Dokument</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Tags */}
          {document.tags.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Tags</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {document.tags.map((tag, index) => (
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
          {document.description && (
            <Card>
              <CardHeader>
                <CardTitle>Beschreibung</CardTitle>
              </CardHeader>
              <CardContent>
                <p>{document.description}</p>
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
              {previewUrl ? (
                document.mime_type.startsWith('image/') ? (
                  <img
                    src={previewUrl}
                    alt={document.original_filename}
                    className="max-w-full h-auto rounded-lg"
                  />
                ) : document.mime_type === 'application/pdf' ? (
                  <iframe
                    src={previewUrl}
                    className="w-full h-[600px] rounded-lg"
                    title={document.original_filename}
                  />
                ) : null
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
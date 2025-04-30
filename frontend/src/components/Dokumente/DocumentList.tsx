// src/components/Dokumente/DocumentList.tsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  FileText,
  Upload,
  Search,
  Filter,
  Tag,
  User,
  Calendar,
  Download,
  Eye,
  Lock,
} from 'lucide-react';
import { Document } from '@/types/document';
import { useAsync } from '@/hooks/useAsync';
import { useConfirmation } from '@/hooks/useConfirmation';
import { DocumentService } from '@/services/DocumentService';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingState } from '@/components/ui/LoadingState';
import { ErrorState } from '@/components/ui/ErrorState';
import { formatFileSize, formatDate } from '@/lib/formatters';

export default function DocumentList() {
  const navigate = useNavigate();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [showConfidential, setShowConfidential] = useState<boolean | null>(null);

  const { execute: fetchDocuments, isLoading, error } = useAsync<Document[]>(
    () => DocumentService.getAll(),
    {
      errorMessage: 'Fehler beim Laden der Dokumente'
    }
  );

  const { execute: fetchCategories } = useAsync(
    () => DocumentService.getCategories(),
    {
      errorMessage: 'Fehler beim Laden der Kategorien'
    }
  );

  const confirmDelete = useConfirmation({
    title: 'Dokument löschen?',
    message: 'Möchten Sie dieses Dokument wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.',
    confirmText: 'Löschen',
    cancelText: 'Abbrechen'
  });

  useEffect(() => {
    loadDocuments();
    loadCategories();
  }, []);

  const loadDocuments = async () => {
    try {
      const data = await fetchDocuments();
      setDocuments(data);
    } catch (error) {
      console.error('Fehler beim Laden:', error);
    }
  };

  const loadCategories = async () => {
    try {
      const data = await fetchCategories();
      setCategories(data);
    } catch (error) {
      console.error('Fehler beim Laden der Kategorien:', error);
    }
  };

  const handleDownload = async (id: number, filename: string) => {
    try {
      const response = await fetch(`http://localhost:3001/documents/${id}/download`);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Fehler beim Download:', error);
    }
  };

  const handleDelete = async (id: number) => {
    const confirmed = await confirmDelete.confirm();
    if (!confirmed) return;

    try {
      await DocumentService.delete(id);
      await loadDocuments();
    } catch (error) {
      console.error('Fehler beim Löschen:', error);
    }
  };

  const filteredDocuments = documents.filter(doc => {
    const matchesSearch = 
      doc.original_filename.toLowerCase().includes(searchTerm.toLowerCase()) ||
      doc.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      doc.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesCategory = selectedCategory === 'all' || 
      doc.category_id.toString() === selectedCategory;

    const matchesConfidential = 
      showConfidential === null || 
      doc.is_confidential === showConfidential;

    return matchesSearch && matchesCategory && matchesConfidential;
  });

  if (isLoading) {
    return <LoadingState />;
  }

  if (error) {
    return (
      <ErrorState
        title="Fehler beim Laden"
        message={error.message}
        onRetry={loadDocuments}
      />
    );
  }

  return (
    <div className="p-4 max-w-5xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-2">
          <FileText className="w-6 h-6" />
          <h1 className="text-2xl font-bold">Dokumente</h1>
        </div>
        <Button
          onClick={() => navigate('/documents/upload')}
          className="flex items-center gap-2"
        >
          <Upload className="w-4 h-4" />
          Dokument hochladen
        </Button>
      </div>

      {/* Filter-Leiste */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex gap-4 flex-wrap">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Suche nach Dokumenten..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>

            <div className="w-[200px]">
              <Select
                value={selectedCategory}
                onValueChange={setSelectedCategory}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Kategorie" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alle Kategorien</SelectItem>
                  {categories.map((cat) => (
                    <SelectItem 
                      key={cat.id} 
                      value={cat.id.toString()}
                    >
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="w-[200px]">
              <Select
                value={showConfidential?.toString() ?? 'null'}
                onValueChange={(value) =>
                  setShowConfidential(
                    value === 'null' ? null : value === 'true'
                  )
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Vertraulichkeit" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="null">Alle</SelectItem>
                  <SelectItem value="true">Vertraulich</SelectItem>
                  <SelectItem value="false">Nicht vertraulich</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Dokumentenliste */}
      {documents.length === 0 ? (
        <EmptyState
          title="Keine Dokumente vorhanden"
          description="Laden Sie Ihr erstes Dokument hoch"
          icon={<FileText className="w-12 h-12 text-muted-foreground" />}
          action={{
            label: 'Dokument hochladen',
            onClick: () => navigate('/documents/upload')
          }}
        />
      ) : filteredDocuments.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center">
            <p className="text-muted-foreground">
              Keine Dokumente gefunden für die ausgewählten Filter
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {filteredDocuments.map(doc => (
            <Card 
              key={doc.id}
              className="hover:shadow-md transition-all duration-200"
            >
              <CardContent className="p-4">
                <div className="flex justify-between items-start">
                  <div className="flex gap-3">
                    <FileText className="w-8 h-8 text-primary mt-1" />
                    <div>
                      <h3 className="font-medium">{doc.original_filename}</h3>
                      {doc.description && (
                        <p className="text-sm text-muted-foreground mt-1">
                          {doc.description}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {doc.is_confidential && (
                      <Lock className="w-4 h-4 text-red-500" />
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigate(`/documents/${doc.id}`)}
                      className="flex items-center gap-1"
                    >
                      <Eye className="w-4 h-4" />
                      <span className="hidden sm:inline">Anzeigen</span>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDownload(doc.id, doc.original_filename)}
                      className="flex items-center gap-1"
                    >
                      <Download className="w-4 h-4" />
                      <span className="hidden sm:inline">Download</span>
                    </Button>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <Filter className="w-4 h-4 text-muted-foreground" />
                    {doc.category_name}
                  </div>

                  {doc.tenant && (
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-muted-foreground" />
                      {doc.tenant.first_name} {doc.tenant.last_name}
                    </div>
                  )}

                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-muted-foreground" />
                    {formatDate(doc.upload_date)}
                  </div>

                  {doc.tags.length > 0 && (
                    <div className="flex items-center gap-2">
                      <Tag className="w-4 h-4 text-muted-foreground" />
                      <div className="flex gap-1">
                        {doc.tags.map((tag, i) => (
                          <span
                            key={i}
                            className="bg-secondary px-2 py-0.5 rounded-md text-xs"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
// src/components/Dokumente/DocumentForm.tsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, X, Upload, File } from 'lucide-react';
import { DocumentService } from '@/services/DocumentService';
import { TenantService } from '@/services/TenantService';
import { useAsync } from '@/hooks/useAsync';
import { useFormState } from '@/hooks/useFormState';
import { Document, DocumentUploadData } from '@/types/document';
import { Tenant } from '@/types/tenant';
import { formatFileSize } from '@/lib/formatters';

interface DocumentFormProps {
  initialData?: Document;
  tenantId?: string;
}

const ACCEPTED_FILE_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
];

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export default function DocumentForm({ initialData, tenantId }: DocumentFormProps) {
  const navigate = useNavigate();
  const [file, setFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [categories, setCategories] = useState<any[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  
  const {
    formData,
    updateField,
    errors,
    setErrors,
  } = useFormState({
    categoryId: '',
    tenantId: tenantId || '',
    description: '',
    isConfidential: false,
    tags: [] as string[],
    newTag: ''
  });

  // API calls
  const { execute: uploadDocument, isLoading: isUploading } = useAsync(
    async (data: DocumentUploadData) => {
      return DocumentService.upload(data);
    },
    {
      successMessage: 'Dokument wurde erfolgreich hochgeladen',
      errorMessage: 'Fehler beim Hochladen des Dokuments'
    }
  );

  const { execute: fetchCategories } = useAsync(
    () => DocumentService.getCategories(),
    {
      errorMessage: 'Fehler beim Laden der Kategorien'
    }
  );

  const { execute: fetchTenants } = useAsync(
    () => TenantService.getAll(),
    {
      errorMessage: 'Fehler beim Laden der Mieter'
    }
  );

  useEffect(() => {
    loadCategories();
    if (!tenantId) {
      loadTenants();
    }
  }, [tenantId]);

  const loadCategories = async () => {
    try {
      const data = await fetchCategories();
      setCategories(data);
    } catch (error) {
      console.error('Fehler beim Laden der Kategorien:', error);
    }
  };

  const loadTenants = async () => {
    try {
      const data = await fetchTenants();
      setTenants(data);
    } catch (error) {
      console.error('Fehler beim Laden der Mieter:', error);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const handleFile = (file: File) => {
    if (!ACCEPTED_FILE_TYPES.includes(file.type)) {
      setErrors({
        file: 'Dateityp nicht unterstützt'
      });
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      setErrors({
        file: 'Datei zu groß (max. 10MB)'
      });
      return;
    }

    setFile(file);
    setErrors({});
  };

  const addTag = () => {
    if (formData.newTag && !formData.tags.includes(formData.newTag)) {
      updateField('tags', [...formData.tags, formData.newTag]);
      updateField('newTag', '');
    }
  };

  const removeTag = (tagToRemove: string) => {
    updateField('tags', formData.tags.filter(tag => tag !== tagToRemove));
  };

  const validateForm = (): boolean => {
    const newErrors: any = {};

    if (!file) {
      newErrors.file = 'Bitte wählen Sie eine Datei aus';
    }

    if (!formData.categoryId) {
      newErrors.categoryId = 'Bitte wählen Sie eine Kategorie aus';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm() || !file) {
      return;
    }

    try {
      const uploadData: DocumentUploadData = {
        file,
        categoryId: parseInt(formData.categoryId),
        description: formData.description,
        isConfidential: formData.isConfidential,
        tags: formData.tags
      };

      if (formData.tenantId) {
        uploadData.tenantId = parseInt(formData.tenantId);
      }

      await uploadDocument(uploadData);
      navigate('/documents');
    } catch (error) {
      // Error wird bereits durch useAsync behandelt
    }
  };

  return (
    <div className="p-4 max-w-3xl mx-auto">
      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Dokument hochladen</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Drop Zone */}
            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors
                ${dragActive ? 'border-primary bg-primary/5' : 'border-gray-300'}`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
            >
              {file ? (
                <div className="flex items-center justify-center gap-4">
                  <File className="w-8 h-8 text-primary" />
                  <div>
                    <p className="font-medium">{file.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {formatFileSize(file.size)}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setFile(null)}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  <Upload className="w-12 h-12 mx-auto text-muted-foreground" />
                  <div>
                    <p className="text-lg font-medium">
                      Datei hierher ziehen oder klicken zum Auswählen
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Maximale Dateigröße: 10MB
                    </p>
                  </div>
                  <Input
                    type="file"
                    className="hidden"
                    onChange={handleFileSelect}
                    accept={ACCEPTED_FILE_TYPES.join(',')}
                    id="file-upload"
                  />
                  <Button
                    type="button"
                    onClick={() => document.getElementById('file-upload')?.click()}
                  >
                    Datei auswählen
                  </Button>
                </div>
              )}

              {errors.file && (
                <p className="text-sm text-destructive mt-2">{errors.file}</p>
              )}
            </div>

            {/* Formularfelder */}
            <div className="grid gap-4">
              {/* Kategorie */}
              <div>
                <label className="text-sm font-medium">Kategorie</label>
                <Select
                  value={formData.categoryId}
                  onValueChange={value => updateField('categoryId', value)}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Kategorie wählen" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((category) => (
                      <SelectItem 
                        key={category.id} 
                        value={category.id.toString()}
                      >
                        {category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.categoryId && (
                  <p className="text-sm text-destructive mt-1">{errors.categoryId}</p>
                )}
              </div>

              {/* Mieter (optional) */}
              {!tenantId && (
                <div>
                  <label className="text-sm font-medium">Mieter (optional)</label>
                  <Select
                    value={formData.tenantId}
                    onValueChange={value => updateField('tenantId', value)}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Mieter auswählen" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Kein Mieter</SelectItem>
                      {tenants.map((tenant) => (
                        <SelectItem key={tenant.id} value={tenant.id.toString()}>
                          {tenant.first_name} {tenant.last_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Beschreibung */}
              <div>
                <label className="text-sm font-medium">Beschreibung</label>
                <Input
                  value={formData.description}
                  onChange={e => updateField('description', e.target.value)}
                  className="mt-1"
                />
              </div>

              {/* Tags */}
              <div>
                <label className="text-sm font-medium">Tags</label>
                <div className="mt-2 space-y-2">
                  <div className="flex gap-2">
                    <Input
                      value={formData.newTag}
                      onChange={e => updateField('newTag', e.target.value)}
                      placeholder="Neuen Tag eingeben"
                    />
                    <Button
                      type="button"
                      onClick={addTag}
                      disabled={!formData.newTag}
                    >
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
                  
                  {formData.tags.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {formData.tags.map((tag, index) => (
                        <span
                          key={index}
                          className="inline-flex items-center gap-1 px-2 py-1 bg-secondary rounded-md text-sm"
                        >
                          {tag}
                          <button
                            type="button"
                            onClick={() => removeTag(tag)}
                            className="text-muted-foreground hover:text-foreground"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Vertraulichkeit */}
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="confidential"
                  checked={formData.isConfidential}
                  onChange={e => updateField('isConfidential', e.target.checked)}
                  className="rounded border-gray-300"
                />
                <label htmlFor="confidential" className="text-sm">
                  Als vertraulich markieren
                </label>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Submit Buttons */}
        <div className="flex justify-end gap-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate('/documents')}
            disabled={isUploading}
          >
            Abbrechen
          </Button>
          <Button 
            type="submit"
            disabled={!file || isUploading}
          >
            {isUploading ? 'Wird hochgeladen...' : 'Dokument hochladen'}
          </Button>
        </div>
      </form>
    </div>
  );
}
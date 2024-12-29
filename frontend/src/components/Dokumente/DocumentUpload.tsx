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
} from '@/components/ui/select';
import { Plus, Upload, X } from 'lucide-react';

interface DocumentUploadProps {
  tenantId?: string;
}

interface Category {
  id: number;
  name: string;
}

interface Tenant {
  id: number;
  first_name: string;
  last_name: string;
}

interface FormData {
  categoryId: string;
  tenantId: string;
  description: string;
  isConfidential: boolean;
  tags: string[];
  newTag: string;
}

export default function DocumentUpload({ tenantId }: DocumentUploadProps) {
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);

  const [formData, setFormData] = useState<FormData>({
    categoryId: 'select',
    tenantId: tenantId || 'none',
    description: '',
    isConfidential: false,
    tags: [],
    newTag: ''
  });

  useEffect(() => {
    loadCategories();
    if (!tenantId) {
      loadTenants();
    }
  }, [tenantId]);

  const loadCategories = async () => {
    try {
      console.log('Loading categories...');
      const response = await fetch('http://localhost:3001/documents/categories');
      console.log('Response status:', response.status);
      
      if (!response.ok) {
        console.error('Categories response not OK:', response.status);
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('Received categories data:', data); // Schauen was zurückkommt
      
      if (!Array.isArray(data) || data.length === 0) {
        console.error('No categories received or invalid data format');
        return;
      }
      
      setCategories(data);
    } catch (error) {
      console.error('Error loading categories:', error);
    }
  };
  const loadTenants = async () => {
    try {
      console.log('Loading tenants...');
      const response = await fetch('http://localhost:3001/tenants');
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      console.log('Tenants loaded:', data);
      setTenants(data);
    } catch (error) {
      console.error('Error loading tenants:', error);
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
      setSelectedFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleAddTag = () => {
    if (formData.newTag && !formData.tags.includes(formData.newTag)) {
      setFormData({
        ...formData,
        tags: [...formData.tags, formData.newTag],
        newTag: ''
      });
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setFormData({
      ...formData,
      tags: formData.tags.filter(tag => tag !== tagToRemove)
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      alert('Bitte wählen Sie eine Datei aus');
      return;
    }

    if (formData.categoryId === 'select') {
      alert('Bitte wählen Sie eine Kategorie aus');
      return;
    }

    setIsSubmitting(true);

    try {
      const formPayload = new FormData();
      formPayload.append('file', selectedFile);
      formPayload.append('categoryId', formData.categoryId);
      if (formData.tenantId !== 'none') {
        formPayload.append('tenantId', formData.tenantId);
      }
      formPayload.append('description', formData.description);
      formPayload.append('isConfidential', String(formData.isConfidential));
      formPayload.append('tags', JSON.stringify(formData.tags));

      const response = await fetch('http://localhost:3001/documents', {
        method: 'POST',
        body: formPayload
      });

      if (!response.ok) throw new Error('Upload fehlgeschlagen');

      navigate('/documents');
    } catch (error) {
      console.error('Fehler beim Upload:', error);
      alert('Fehler beim Upload des Dokuments');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Dokument hochladen</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Drop Zone */}
            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center 
                ${dragActive ? 'border-primary bg-primary/5' : 'border-gray-300'}`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
            >
              {selectedFile ? (
                <div className="flex items-center justify-center gap-4">
                  <div>
                    <p className="font-medium">{selectedFile.name}</p>
                    <p className="text-sm text-gray-500">
                      {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedFile(null)}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  <Upload className="w-12 h-12 mx-auto text-gray-400" />
                  <div>
                    <p className="text-lg font-medium">
                      Datei hierher ziehen oder klicken zum Auswählen
                    </p>
                    <p className="text-sm text-gray-500">
                      Maximale Dateigröße: 10MB
                    </p>
                  </div>
                  <Input
                    type="file"
                    className="hidden"
                    onChange={handleFileSelect}
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
            </div>

            {/* Formularfelder */}
            <div className="grid grid-cols-2 gap-4">
              {/* Kategorie */}
              <div>
                <label className="text-sm font-medium">Kategorie</label>
                <Select
                  value={formData.categoryId}
                  onValueChange={(value) => 
                    setFormData({ ...formData, categoryId: value })
                  }
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Kategorie wählen" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories && categories.length > 0 ? (
                      categories.map((cat) => (
                        <SelectItem key={cat.id} value={cat.id.toString()}>
                          {cat.name}
                        </SelectItem>
                      ))
                    ) : (
                      <SelectItem value="select">Lade Kategorien...</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>

              {/* Mieter (optional) */}
              {!tenantId && (
                <div>
                  <label className="text-sm font-medium">Mieter (optional)</label>
                  <Select
                    value={formData.tenantId}
                    onValueChange={(value) => 
                      setFormData({ ...formData, tenantId: value })
                    }
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Mieter auswählen" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Kein Mieter</SelectItem>
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
              <div className="col-span-2">
                <label className="text-sm font-medium">Beschreibung</label>
                <Input
                  value={formData.description}
                  onChange={(e) => 
                    setFormData({ ...formData, description: e.target.value })
                  }
                  className="mt-1"
                />
              </div>
            </div>

            {/* Tags */}
            <div>
              <label className="text-sm font-medium">Tags</label>
              <div className="mt-2 space-y-2">
                <div className="flex gap-2">
                  <Input
                    value={formData.newTag}
                    onChange={(e) => 
                      setFormData({ ...formData, newTag: e.target.value })
                    }
                    placeholder="Neuen Tag eingeben"
                  />
                  <Button
                    type="button"
                    onClick={handleAddTag}
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
                          onClick={() => handleRemoveTag(tag)}
                          className="text-gray-500 hover:text-gray-700"
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
                onChange={(e) => 
                  setFormData({ ...formData, isConfidential: e.target.checked })
                }
                className="rounded border-gray-300"
              />
              <label htmlFor="confidential" className="text-sm">
                Als vertraulich markieren
              </label>
            </div>
          </CardContent>
        </Card>

        {/* Submit Buttons */}
        <div className="flex justify-end gap-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate('/documents')}
            disabled={isSubmitting}
          >
            Abbrechen
          </Button>
          <Button 
            type="submit"
            disabled={!selectedFile || isSubmitting}
          >
            {isSubmitting ? 'Wird hochgeladen...' : 'Dokument hochladen'}
          </Button>
        </div>
      </form>
    </div>
  );
}
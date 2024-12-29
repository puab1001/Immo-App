import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    FileText,
    Upload,
    Search,
    Filter,
    Tag,
    User,
    Calendar,
    Download,
    Trash2
} from 'lucide-react';

interface Document {
    id: number;
    filename: string;
    original_filename: string;
    category_name: string;
    upload_date: string;
    description?: string;
    tenant?: {
        id: number;
        first_name: string;
        last_name: string;
    };
    tags: string[];
    is_confidential: boolean;
    created_by: string;
}

interface Category {
    id: number;
    name: string;
}

export default function DocumentList() {
    const navigate = useNavigate();
    const [documents, setDocuments] = useState<Document[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategory, setSelectedCategory] = useState<string>("all");
    const [showConfidential, setShowConfidential] = useState<boolean | null>(null);

    useEffect(() => {
        loadDocuments();
        loadCategories();
    }, []);

    const loadDocuments = async () => {
        try {
            console.log('Fetching documents...');
            const response = await fetch('http://localhost:3001/documents');
            console.log('Response status:', response.status);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            console.log('Received documents:', data);
            
            if (!Array.isArray(data)) {
                throw new Error('Received invalid documents data');
            }
            
            setDocuments(data);
        } catch (error) {
            console.error('Fehler beim Laden der Dokumente:', error);
        } finally {
            setIsLoading(false);
        }
    };

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
        if (!confirm('Möchten Sie dieses Dokument wirklich löschen?')) return;

        try {
            const response = await fetch(`http://localhost:3001/documents/${id}`, {
                method: 'DELETE'
            });

            if (!response.ok) throw new Error('Löschen fehlgeschlagen');

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

        const matchesCategory = selectedCategory === "all" || 
            doc.category_name === selectedCategory;

        const matchesConfidential =
            showConfidential === null ||
            doc.is_confidential === showConfidential;

        return matchesSearch && matchesCategory && matchesConfidential;
    });

    if (isLoading) return <div>Lade Dokumente...</div>;

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold">Dokumentenverwaltung</h1>
                <Button
                    onClick={() => navigate('/documents/upload')}
                    className="flex items-center gap-2"
                >
                    <Upload className="w-4 h-4" />
                    Dokument hochladen
                </Button>
            </div>

            {/* Filter-Leiste */}
            <Card>
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
                                    {Array.isArray(categories) && categories.map((cat) => (
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
            <div className="grid gap-4">
                {filteredDocuments.length > 0 ? (
                    filteredDocuments.map(doc => (
                        <Card key={doc.id} className="hover:bg-gray-50 transition-colors">
                            <CardHeader className="pb-2">
                                <div className="flex justify-between">
                                    <div className="flex items-start gap-3">
                                        <FileText className="w-5 h-5 mt-1" />
                                        <div>
                                            <CardTitle className="text-lg">
                                                {doc.original_filename}
                                            </CardTitle>
                                            {doc.description && (
                                                <p className="text-sm text-muted-foreground mt-1">
                                                    {doc.description}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => handleDownload(doc.id, doc.original_filename)}
                                        >
                                            <Download className="w-4 h-4" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => handleDelete(doc.id)}
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </Button>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="flex flex-wrap gap-4 text-sm">
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
                                        {new Date(doc.upload_date).toLocaleDateString()}
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

                                    {doc.is_confidential && (
                                        <span className="px-2 py-0.5 bg-red-100 text-red-800 rounded-md text-xs">
                                            Vertraulich
                                        </span>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    ))
                ) : (
                    <Card>
                        <CardContent className="p-6 text-center text-muted-foreground">
                            Keine Dokumente gefunden
                        </CardContent>
                    </Card>
                )}
            </div>
        </div>
    );
}
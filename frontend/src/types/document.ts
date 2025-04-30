// src/types/document.ts
import { BaseEntity } from './common';

export interface Document extends BaseEntity {
  filename: string;
  original_filename: string;
  mime_type: string;
  file_size: number;
  category_id: number;
  category_name: string;
  tenant_id?: number;
  tenant?: {
    id: number;
    first_name: string;
    last_name: string;
  };
  description?: string;
  is_confidential: boolean;
  tags: string[];
  upload_date: string;
  created_by: string;
  file_path?: string;
  content?: Uint8Array;
}

export interface DocumentUploadData {
  file: File;
  categoryId: number;
  tenantId?: number;
  description?: string;
  isConfidential: boolean;
  tags?: string[];
}
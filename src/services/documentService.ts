import { supabase } from '../lib/supabaseClient';
import { v4 as uuidv4 } from 'uuid';
import { PostgrestError } from '@supabase/supabase-js';
import { Document } from '@/types/document';

// Define the comprehensive processing status type based on recommendations
export type ProcessingStatus = 
  | 'uploaded'
  | 'text_extraction_pending'
  | 'text_extracted'
  | 'embedding_pending'
  | 'completed'
  | 'text_extraction_failed'
  | 'embedding_failed';

/**
 * Interface for document metadata reflecting schema recommendations
 */
export interface DocumentMetadata {
  id: string;
  filename: string;
  contentType: string;
  size: number; // Keep size, remove file_size
  uploadedAt: string;
  caseId?: string | null; // Allow null
  storagePath: string | null;
  processingStatus: ProcessingStatus;
  extractedText?: string | null; // Allow null
  editedContent?: string | null; // New field for user edits
  errorMessage?: string | null; // Existing field for errors
  lastAccessedAt?: string | null; // New metadata field
  version?: number; // New metadata field
  isDeleted: boolean; // Existing field
  ownerId: string; // Reflecting owner_id
  fileType?: string | null; // Existing field, allow null
  // is_fallback_content: boolean; // Add if confirmed needed by backend logic
}

/**
 * Helper function to standardize error handling
 */
const handleError = <T>(error: unknown, context: string): { data: T | null; error: Error } => {
  const message = error instanceof Error ? error.message : `Unknown error in ${context}`;
  console.error(`Error in ${context}:`, message);
  return { data: null, error: error instanceof Error ? error : new Error(message) };
};

/**
 * Ensures a storage bucket exists, handling RLS restrictions gracefully
 */
const ensureBucketExists = async (bucketName: string): Promise<boolean> => {
  try {
    // First check if we can list files in the bucket
    const { error } = await supabase.storage.from(bucketName).list('', { limit: 1 });
    
    // If we can list files, the bucket exists and we have access
    if (!error) {
      return true;
    }
    
    // Try to list buckets as a fallback
    const { data: buckets } = await supabase.storage.listBuckets();
    
    if (buckets && buckets.some(bucket => bucket.name === bucketName)) {
      // Bucket exists but we might not have proper access
      console.warn(`Bucket '${bucketName}' exists but might have restricted access`);
      return true;
    }
    
    console.error(`Cannot verify or access bucket '${bucketName}'. Please ensure it exists in the Supabase dashboard.`);
    return false;
    
  } catch (error) {
    console.error(`Error checking bucket '${bucketName}':`, error instanceof Error ? error.message : 'Unknown error');
    return false;
  }
};

/**
 * Uploads a document to Supabase storage and inserts a record in the documents table
 */
export const uploadDocument = async (
  file: File,
  userId: string,
  caseId?: string
): Promise<{ id: string; url: string }> => {
  console.log(`Beginning upload for ${file.name} (${file.size} bytes)`);
  
  try {
    // Check if the bucket exists and is accessible
    const bucketAccessible = await ensureBucketExists('documents');
    
    if (!bucketAccessible) {
      throw new Error(`Storage bucket 'documents' is not accessible. Please contact system administrator.`);
    }
    
    // Create a unique file path including user ID to comply with RLS
    const fileExt = file.name.split('.').pop();
    const fileName = `${uuidv4()}.${fileExt}`;
    const filePath = `${userId}/${fileName}`;
    
    // Maximum retry attempts
    const maxRetries = 3;
    let uploadError = null;
    
    // Attempt upload with retries
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      console.log(`Upload attempt ${attempt} for ${file.name}`);
      
      const { error: uploadErr } = await supabase.storage
        .from('documents')
        .upload(filePath, file);
        
      if (!uploadErr) {
        console.log(`Successfully uploaded ${file.name} on attempt ${attempt}`);
        
        // Get the URL for the uploaded file
        const { data: urlData } = await supabase.storage
          .from('documents')
          .getPublicUrl(filePath);
          
        const url = urlData?.publicUrl || '';
        
        // Insert a record in the documents table
        const { data: docData, error: insertError } = await supabase
          .from('documents')
          .insert({
            owner_id: userId,
            case_id: caseId || null,
            filename: file.name,
            storage_path: filePath,
            content_type: file.type,
            file_type: file.name.split('.').pop() || '',
            file_size: file.size,
            processing_status: 'uploaded' as ProcessingStatus, // Use the defined type
            is_deleted: false,
            uploaded_at: new Date().toISOString()
          })
          .select('id')
          .single();
          
        if (insertError) {
          console.error('Error inserting document record:', insertError);
          throw new Error(`Failed to save document metadata: ${insertError.message}`);
        }
        
        return { id: docData.id, url };
      }
      
      // Store the error for later if we need it
      uploadError = uploadErr;
      
      // If we've reached max retries, throw the error
      if (attempt === maxRetries) {
        console.error(`Upload failed after ${maxRetries} attempts:`, uploadError);
        throw new Error(`Failed to upload document after multiple attempts: ${uploadError.message}`);
      }
      
      // Wait before retrying (exponential backoff)
      await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
    }
    
    // This should never be reached due to the throw above, but TypeScript doesn't know that
    throw new Error('Failed to upload document');
    
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error during upload';
    console.error('Error uploading document:', message);
    throw error instanceof Error ? error : new Error(message);
  }
};

/**
 * Get all documents for the current user
 */
export const getUserDocuments = async (
  caseId?: string
): Promise<{ data: DocumentMetadata[] | null; error: Error | null }> => {
  try {
    // Get current user
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData?.user?.id;
    
    if (!userId) {
      throw new Error('Not authenticated');
    }
    
    // Create query filtering by owner_id
    let query = supabase
      .from('documents')
      .select('*')
      .eq('owner_id', userId)
      .eq('is_deleted', false)
      .order('uploaded_at', { ascending: false });

    // Filter by case if provided
    if (caseId) {
      query = query.eq('case_id', caseId);
    }

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    // Transform database response to the DocumentMetadata interface
    // Filter out documents with null storage_path or essential fields
    const documents: DocumentMetadata[] = (data || []) // Ensure data is not null
      .filter(doc => doc.storage_path !== null && doc.id && doc.filename && doc.owner_id) // Add checks for essential fields
      .map((doc) => ({
        id: doc.id,
        filename: doc.filename,
        contentType: doc.content_type || 'unknown', // Provide default
        size: doc.size || 0, // Provide default
        uploadedAt: doc.uploaded_at || new Date().toISOString(), // Provide default
        caseId: doc.case_id,
        storagePath: doc.storage_path as string, // Assert as string after filtering
        processingStatus: doc.processing_status as ProcessingStatus || 'uploaded', // Assert type and provide default
        extractedText: doc.extracted_text,
        // Add missing fields from DocumentMetadata with defaults or actual values
        editedContent: doc.edited_content, 
        errorMessage: doc.error_message,
        lastAccessedAt: doc.last_accessed_at,
        version: doc.version,
        isDeleted: doc.is_deleted ?? false, // Use ?? for nullish coalescing
        ownerId: doc.owner_id, // Already checked in filter
        fileType: doc.file_type,
      }));

    return { data: documents, error: null };
  } catch (error) {
    return handleError<DocumentMetadata[]>(error, 'getting user documents'); // Update return type in catch
  }
};

/**
 * Get a document by ID
 */
export const getDocumentById = async (
  documentId: string
): Promise<{ data: DocumentMetadata | null; error: Error | null }> => {
  try {
    // Assuming RLS is in place, we just need the ID
    const { data, error } = await supabase
      .from('documents')
      .select('*') // Fetch all columns
      .eq('id', documentId)
      .single(); // Expecting one result

    if (error) {
      if (error.code === 'PGRST116') { // Code for "Not found"
        return { data: null, error: new Error('Document not found.') };
      }
      throw error;
    }

    if (!data) {
        return { data: null, error: new Error('Document not found.') };
    }

    // Transform to DocumentMetadata interface
    const document: DocumentMetadata = {
      id: data.id,
      filename: data.filename,
      contentType: data.content_type,
      size: data.size,
      uploadedAt: data.uploaded_at,
      caseId: data.case_id,
      storagePath: data.storage_path,
      processingStatus: data.processing_status,
      extractedText: data.extracted_text,
      editedContent: data.edited_content,
      errorMessage: data.error_message,
      lastAccessedAt: data.last_accessed_at,
      version: data.version,
      isDeleted: data.is_deleted,
      ownerId: data.owner_id,
      fileType: data.file_type,
    };

    return { data: document, error: null };
  } catch (error) {
    return handleError<DocumentMetadata>(error, 'fetching document by ID');
  }
};

/**
 * Get a document download URL
 */
export const getDocumentUrl = async (
  storagePath: string
): Promise<{ data: string | null; error: Error | null }> => {
  try {
    const { data, error } = await supabase.storage
      .from('documents')
      .createSignedUrl(storagePath, 60); // 1 minute expiry

    if (error) {
      throw error;
    }

    return { data: data.signedUrl, error: null };
  } catch (error) {
    return handleError<string>(error, 'getting document URL');
  }
};

/**
 * Delete a document (soft delete)
 */
export const deleteDocument = async (
  documentId: string
): Promise<{ success: boolean; error: Error | null }> => {
  try {
    // Soft delete - just mark as deleted
    const { error } = await supabase
      .from('documents')
      .update({ is_deleted: true })
      .eq('id', documentId);

    if (error) {
      throw error;
    }

    return { success: true, error: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error deleting document';
    console.error('Error deleting document:', message);
    return { success: false, error: error instanceof Error ? error : new Error(message) };
  }
};

/**
 * Process a document for a specific analysis
 * Placeholder - actual analysis logic lives in backend functions
 */
export const processAndAnalyzeDocument = async (
  documentId: string,
  analysisType: 'summary' | 'entities' | 'clauses' | 'risks' | 'timeline'
  // Define a more specific return type for analysis results if possible, using Record<string, unknown> as placeholder
): Promise<{ success: boolean; data?: Record<string, unknown>; error: Error | null }> => {
  try {
    // First ensure the document has been processed
    const { data: document } = await getDocumentById(documentId);
    
    if (!document) {
      throw new Error('Document not found');
    }
    
    // Now we'd call our analysis service to perform the specific analysis
    // This is a placeholder for now and would be implemented with the 
    // documentAnalysisService in a real implementation
    const analysisResult = {
      documentId,
      analysisType,
      timestamp: new Date().toISOString(),
      result: `Sample ${analysisType} analysis for document ${documentId}`
    };
    
    return { success: true, data: analysisResult, error: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error processing and analyzing document';
    console.error('Error processing and analyzing document:', message);
    return { success: false, data: undefined, error: error instanceof Error ? error : new Error(message) };
  }
};

/**
 * Update a document record in the database.
 */
export const updateDocument = async (
  documentId: string,
  updates: Partial<Pick<DocumentMetadata, 'extractedText' | 'editedContent' | 'filename' | 'processingStatus' | 'errorMessage' | 'lastAccessedAt' | 'version'>>
): Promise<{ success: boolean; error: Error | null }> => {
  try {
    if (!updates || Object.keys(updates).length === 0) {
      console.warn('updateDocument called with no updates for id:', documentId);
      return { success: true, error: null };
    }

    // *** FIX: Define updateData type more strictly ***
    const updateData: { [key: string]: string | number | boolean | null | ProcessingStatus } = {};

    // Map known fields, potentially handling column name differences
    if (updates.filename !== undefined) updateData.filename = updates.filename;
    if (updates.extractedText !== undefined) updateData.extracted_text = updates.extractedText;
    if (updates.editedContent !== undefined) updateData.edited_content = updates.editedContent; // Use correct snake_case if DB differs
    if (updates.processingStatus !== undefined) updateData.processing_status = updates.processingStatus;
    if (updates.errorMessage !== undefined) updateData.error_message = updates.errorMessage; // Use correct snake_case if DB differs
    if (updates.lastAccessedAt !== undefined) updateData.last_accessed_at = updates.lastAccessedAt; // Use correct snake_case if DB differs
    if (updates.version !== undefined) updateData.version = updates.version;

    // Always update timestamp
    updateData.updated_at = new Date().toISOString();

    const { error } = await supabase
      .from('documents')
      .update(updateData)
      .eq('id', documentId);

    if (error) {
      console.error(`Error updating document ${documentId}:`, error);
      throw error;
    }

    console.log(`Document ${documentId} updated successfully.`);
    return { success: true, error: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error updating document';
    console.error('Error updating document:', message);
    return { success: false, error: error instanceof Error ? error : new Error(message) };
  }
};

/**
 * Uploads a file, creates the initial document record, and relies on backend
 * functions (triggered by DB webhooks) for text extraction and processing.
 */
export const uploadAndProcessDocument = async (
  file: File,
  caseId: string | null,
): Promise<{ data: Pick<DocumentMetadata, 'id' | 'filename'> | null; error: Error | null }> => {
  console.log(`Starting upload for ${file.name}...`);
  try {
    // Get userId first
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError) throw new Error(`Authentication Error: ${authError.message}`);
    if (!user) throw new Error('User not authenticated');

    // Step 1: Upload the document and create the initial record with 'uploaded' status
    const { id: documentId, url } = await uploadDocument(file, user.id, caseId || undefined);
    console.log(`Document uploaded successfully, ID: ${documentId}, URL: ${url}`);

    // Step 2: Backend function 'extract-text' is triggered by DB webhook.

    return {
      data: { id: documentId, filename: file.name },
      error: null
    };

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error during upload and process initiation';
    console.error('Error in uploadAndProcessDocument:', message);
    // Ensure the caught error is typed correctly
    const typedError = error instanceof PostgrestError ? error : error instanceof Error ? error : new Error(message);
    return { data: null, error: typedError };
  }
};

/**
 * Creates a new document record in the database, typically for manually created documents.
 */
export const createDocument = async (
  userId: string,
  caseId: string | null,
  initialData: {
    filename?: string;
    content?: string;
  }
): Promise<{ data: { id: string } | null; error: PostgrestError | Error | null }> => {
  try {
    if (!userId) {
      throw new Error('User ID is required to create a document.');
    }

    const finalFilename = initialData.filename || 'Untitled Document';

    // Infer file_type from filename
    const fileExtension = finalFilename.includes('.') ? finalFilename.split('.').pop()?.toLowerCase() : 'txt';
    const inferredFileType = fileExtension || 'txt'; // Default to txt if extension is missing

    // Insert record into documents table
    const { data, error: insertError } = await supabase
      .from('documents')
      .insert({
        owner_id: userId,
        case_id: caseId || null,
        filename: finalFilename,
        content_type: 'text/plain', // Content is provided directly
        file_type: inferredFileType, // ADDED: Infer file type from filename
        file_size: initialData.content?.length || 0, // CORRECTED: Use file_size
        extracted_text: initialData.content || '',
        edited_content: initialData.content || '', // Start with same content
        processing_status: 'completed' as ProcessingStatus,
        is_deleted: false,
        uploaded_at: new Date().toISOString(),
        // No storage path needed initially for text-based creation
        storage_path: 'ai-generated' // ADDED: Provide a placeholder for non-null constraint
      })
      .select('id')
      .single();

    if (insertError) {
      console.error('Error inserting new document record:', insertError);
      throw insertError;
    }

    return { data, error: null };
  } catch (error) {
    return handleError(error, 'createDocument');
  }
};

/**
 * Search documents by filename for the current user.
 */
export const searchDocumentsByName = async (
  query: string,
  caseId?: string | null,
  limit: number = 10
): Promise<{ data: DocumentMetadata[] | null; error: Error | null }> => {
  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      throw authError || new Error('User not authenticated');
    }

    let request = supabase
      .from('documents')
      .select('*') // Select all needed fields for DocumentMetadata
      .eq('owner_id', user.id)
      .eq('is_deleted', false)
      .ilike('filename', `%${query}%`)
      .limit(limit)
      .order('last_accessed_at', { ascending: false, nullsFirst: false }); // Or order by updated_at/uploaded_at

    if (caseId) {
        request = request.eq('case_id', caseId);
    }

    const { data, error } = await request;

    if (error) {
      console.error('Error searching documents:', error);
      throw error;
    }

    // Format data to match DocumentMetadata interface
    const formattedDocuments = (data || []).map(doc => ({
        id: doc.id,
        filename: doc.filename,
        contentType: doc.content_type,
        size: doc.size,
        uploadedAt: doc.uploaded_at,
        caseId: doc.case_id,
        storagePath: doc.storage_path,
        processingStatus: doc.processing_status as ProcessingStatus,
        extractedText: doc.extracted_text,
        editedContent: doc.edited_content,
        errorMessage: doc.error_message,
        lastAccessedAt: doc.last_accessed_at,
        version: doc.version,
        isDeleted: doc.is_deleted,
        ownerId: doc.owner_id,
        fileType: doc.file_type,
    } as DocumentMetadata));

    return { data: formattedDocuments, error: null };

  } catch (error) {
    console.error('Error in searchDocumentsByName:', error);
    return { data: null, error: error as Error };
  }
};
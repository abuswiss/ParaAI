import { supabase } from '@/lib/supabaseClient';
import { v4 as uuidv4 } from 'uuid';
import { PostgrestError } from '@supabase/supabase-js';
import { DocumentMetadata, ProcessingStatus } from '@/types/document';

/**
 * Interface for document metadata reflecting schema recommendations
 */
export interface DocumentMetadata {
  id: string;
  filename: string;
  title?: string | null;
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

// Helper function to convert HTML to plain text (client-side)
function htmlToPlainText(html: string | null | undefined): string {
  if (!html) return '';
  if (typeof DOMParser === 'undefined') {
    console.warn('DOMParser not available. Using regex for HTML to text conversion (basic).');
    return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  }
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    // Fallback to innerText if textContent is empty, then to empty string
    return (doc.body.textContent || doc.body.innerText || "").replace(/\s+/g, ' ').trim();
  } catch (e) {
    console.error("Error parsing HTML for text extraction with DOMParser:", e);
    return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(); // Fallback to regex
  }
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
    const { data: userData } = await supabase.auth.getUser();
    const userIdAuth = userData?.user?.id;
    
    if (!userIdAuth) {
      throw new Error('Not authenticated');
    }
    
    let query = supabase
      .from('documents')
      .select('*')
      .eq('owner_id', userIdAuth)
      .eq('is_deleted', false)
      .order('uploaded_at', { ascending: false });

    if (caseId) {
      query = query.eq('case_id', caseId);
    }

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    const documents: DocumentMetadata[] = (data || [])
      .filter(dbDoc => dbDoc.id && dbDoc.filename && dbDoc.owner_id) 
      .map((dbDoc): DocumentMetadata => ({
        id: dbDoc.id,
        filename: dbDoc.filename,
        title: dbDoc.title || undefined, // Assuming title might be a direct DB field
        caseId: dbDoc.case_id || null,
        userId: dbDoc.owner_id, // Map owner_id to userId
        uploadDate: dbDoc.uploaded_at || new Date().toISOString(), // Map uploaded_at to uploadDate
        fileType: dbDoc.file_type || null,
        fileSize: dbDoc.file_size || dbDoc.size || 0, // Map file_size or size to fileSize
        contentType: dbDoc.content_type || 'unknown',
        processingStatus: dbDoc.processing_status as ProcessingStatus || 'uploaded',
        extractedText: dbDoc.extracted_text || null,
        editedContent: dbDoc.edited_content || null,
        summary: dbDoc.summary || null, // Assuming summary might be a direct DB field
        tags: dbDoc.tags || [], // Assuming tags might be a direct DB field
        vectorId: dbDoc.vector_id || undefined, // Assuming vector_id might be a direct DB field
        storagePath: dbDoc.storage_path || null,
        errorMessage: dbDoc.error_message || null,
        lastAccessedAt: dbDoc.last_accessed_at || null,
        version: dbDoc.version || undefined,
        isDeleted: dbDoc.is_deleted ?? false,
      }));

    return { data: documents, error: null };
  } catch (error) {
    return handleError<DocumentMetadata[]>(error, 'getting user documents');
  }
};

/**
 * Get a document by ID
 */
export const getDocumentById = async (
  documentId: string
): Promise<{ data: DocumentMetadata | null; error: Error | null }> => {
  try {
    const { data: dbDoc, error } = await supabase
      .from('documents')
      .select('*') 
      .eq('id', documentId)
      .maybeSingle(); // Use maybeSingle to handle not found gracefully

    if (error && error.code !== 'PGRST116') { // PGRST116 is " dokładnie zero wierszy narusza ograniczenie" (zero rows) - ignore for maybeSingle if data is null
      throw error;
    }

    if (!dbDoc) {
        return { data: null, error: null }; // Not found or other error already handled
    }

    const document: DocumentMetadata = {
      id: dbDoc.id,
      filename: dbDoc.filename,
      title: dbDoc.title || undefined,
      caseId: dbDoc.case_id || null,
      userId: dbDoc.owner_id,
      uploadDate: dbDoc.uploaded_at || new Date().toISOString(),
      fileType: dbDoc.file_type || null,
      fileSize: dbDoc.file_size || dbDoc.size || 0,
      contentType: dbDoc.content_type || 'unknown',
      processingStatus: dbDoc.processing_status as ProcessingStatus || 'uploaded',
      extractedText: dbDoc.extracted_text || null,
      editedContent: dbDoc.edited_content || null,
      summary: dbDoc.summary || null,
      tags: dbDoc.tags || [],
      vectorId: dbDoc.vector_id || undefined,
      storagePath: dbDoc.storage_path || null,
      errorMessage: dbDoc.error_message || null,
      lastAccessedAt: dbDoc.last_accessed_at || null,
      version: dbDoc.version || undefined,
      isDeleted: dbDoc.is_deleted ?? false,
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
    // If using signed URLs (more secure):
    const { data: urlData, error: urlError } = await supabase.storage
      .from('documents')
      .createSignedUrl(storagePath, 60 * 60); // URL valid for 1 hour

    if (urlError) throw urlError;

    const url = urlData?.signedUrl;
    
    if (!url) {
        throw new Error("Could not retrieve document URL.");
    }

    return { data: url, error: null };
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
    const { error: invokeError } = await supabase.functions.invoke('analyze-document', {
      body: { documentId, analysisType },
    });

    if (invokeError) {
      console.error(`Error invoking analyze-document for type ${analysisType}:`, invokeError);
      return { success: false, error: new Error(invokeError.message) };
    }

    // The function call is successful, but the actual analysis result might be fetched
    // by another mechanism or the function updates the document record directly.
    // For this example, let's assume success means the function was invoked.
    // You might need to adjust this based on how your backend function behaves.
    // If the backend returns data directly, you'd capture and return it.
    // For now, returning undefined data but success.
    return { success: true, data: undefined, error: null };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error processing and analyzing document';
    console.error('Error in processAndAnalyzeDocument:', message);
    return { success: false, error: new Error(message) };
  }
};

/**
 * Update a document record in the database.
 */
export const updateDocument = async (
  documentId: string,
  updates: Partial<Pick<DocumentMetadata, 'extractedText' | 'editedContent' | 'filename' | 'processingStatus' | 'errorMessage' | 'lastAccessedAt' | 'version' | 'caseId'>>
): Promise<{ success: boolean; error: Error | null }> => {
  try {
    const updatePayload: Record<string, any> = { ...updates };

    // If editedContent is being updated, also update extractedText and processingStatus
    if (updates.editedContent !== undefined) { // Check specifically for editedContent updates
      const plainText = htmlToPlainText(updates.editedContent);
      updatePayload.extracted_text = plainText;
      // Only update status if it's not already in a final or failed state from backend processing
      // and if there's no storage_path that implies backend processing is pending/active.
      // This logic might need refinement based on how storagePath is used for non-uploaded docs.
      // For now, if editedContent is updated, we assume it's the source of truth for text.
      if (updates.processingStatus === undefined || 
          !['text_extracted', 'completed', 'embedding_pending', 'text_extraction_failed', 'embedding_failed'].includes(updates.processingStatus)) {
          // Further check: if we are certain this document type *never* goes to backend for extraction (e.g. no storage_path or specific type)
          // we can more confidently set it to 'text_extracted'.
          // Let's assume for now that if editedContent is updated, this is the primary text.
          updatePayload.processing_status = 'text_extracted';
      }
    }
    
    // Convert our camelCase keys to snake_case for Supabase, if not already handled by a general mapper
    // Example: lastAccessedAt -> last_accessed_at
    if (updatePayload.lastAccessedAt) {
        updatePayload.last_accessed_at = updatePayload.lastAccessedAt;
        delete updatePayload.lastAccessedAt;
    }
    if (updatePayload.processingStatus) {
        updatePayload.processing_status = updatePayload.processingStatus;
        delete updatePayload.processingStatus;
    }
    if (updatePayload.editedContent !== undefined) {
        updatePayload.edited_content = updatePayload.editedContent;
        delete updatePayload.editedContent;
    }
     if (updatePayload.extractedText !== undefined) { // This might be set directly by this function
        updatePayload.extracted_text = updatePayload.extractedText;
        delete updatePayload.extractedText; // remove camelCase if it was set
    }
    if (updatePayload.errorMessage) {
        updatePayload.error_message = updatePayload.errorMessage;
        delete updatePayload.errorMessage;
    }
     if (updatePayload.caseId !== undefined) { // Handle caseId
        updatePayload.case_id = updatePayload.caseId;
        delete updatePayload.caseId;
    }

    const { error } = await supabase
      .from('documents')
      .update(updatePayload)
      .eq('id', documentId);

    if (error) {
      throw error;
    }
    return { success: true, error: null };
  } catch (error) {
    return handleError<never>(error, `updating document ${documentId}`);
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
  docData: {
    userId: string;
    caseId: string | null;
    filename?: string;
    content?: string; // This is expected to be HTML for AI-generated content
    templateId?: string;
    storagePath?: string | null; // If provided, backend extraction is expected
    contentType?: string; // e.g., 'text/html' for AI content, or from file upload
    fileType?: string;
    fileSize?: number;
    initialProcessingStatus?: ProcessingStatus; // Allow overriding initial status
  }
): Promise<{ data: { id: string; filename: string } | null; error: PostgrestError | Error | null }> => {
  try {
    // Log received userId and current auth.uid() for comparison
    console.log(`documentService: createDocument - Received userId for owner_id: ${docData.userId}`);
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
    if (authError) {
      console.error("documentService: createDocument - Error fetching current auth user:", authError.message);
    } else {
      console.log(`documentService: createDocument - Current auth.uid() from supabase.auth.getUser(): ${authUser?.id}`);
    }
    if (docData.userId !== authUser?.id) {
      console.error(`CRITICAL RLS DEBUG: Potential userId mismatch! 
Passed to createDocument for owner_id: ${docData.userId} 
Current auth.uid() from supabase.auth.getUser(): ${authUser?.id}`);
    }

    const { 
      userId, 
      caseId, 
      filename: inputFilename, 
      content, // HTML content
      templateId, 
      storagePath, 
      contentType,
      fileType,
      fileSize,
      initialProcessingStatus
    } = docData;

    const effectiveFilename = inputFilename || (content ? 'AI Generated Document' : 'New Document');
    
    const documentRecord: Partial<DocumentMetadata> = {
      owner_id: userId,
      case_id: caseId,
      filename: effectiveFilename,
      template_id: templateId,
      // Default to an "empty" or placeholder storage path if not provided,
      // to differentiate from actual uploaded files if needed.
      storage_path: storagePath === undefined ? null : storagePath, 
      content_type: contentType || (content ? 'text/html' : 'application/octet-stream'),
      file_type: fileType || (inputFilename ? inputFilename.split('.').pop() : (content ? 'html' : undefined)),
      file_size: fileSize || (content ? content.length : 0),
      is_deleted: false,
      uploaded_at: new Date().toISOString(),
      // version: 1, // Initialize version if using this field
      // last_accessed_at: new Date().toISOString(), // Initialize if using
    };

    // If HTML content is provided directly AND there's no storagePath that implies backend file processing,
    // extract text and set processing status accordingly.
    if (content && !storagePath) {
      documentRecord.edited_content = content; // Store the HTML
      documentRecord.extracted_text = htmlToPlainText(content);
      documentRecord.processing_status = initialProcessingStatus || 'text_extracted';
    } else if (storagePath) {
      // If there's a storagePath, assume backend will handle extraction (e.g., via 'uploaded' status)
      documentRecord.processing_status = initialProcessingStatus || 'uploaded'; 
    } else {
      // Default for new empty documents without content or storage path
      documentRecord.processing_status = initialProcessingStatus || 'uploaded'; // Or perhaps a new status like 'draft'
      documentRecord.edited_content = content || ''; // Ensure edited_content is at least an empty string
      documentRecord.extracted_text = htmlToPlainText(content || '');
    }


    const { data, error } = await supabase
      .from('documents')
      .insert(documentRecord)
      .select('id, filename')
      .single();

    if (error) {
      console.error('Error creating document record:', error);
      throw error;
    }

    return { data: data ? { id: data.id, filename: data.filename } : null, error: null };
  } catch (error) {
     const typedError = error as PostgrestError | Error;
    console.error('Exception in createDocument:', typedError);
    return { data: null, error: typedError };
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
      .select('*')
      .eq('owner_id', user.id)
      .eq('is_deleted', false)
      .ilike('filename', `%${query}%`)
      .limit(limit)
      .order('uploaded_at', { ascending: false, nullsFirst: false });

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

// --- Semantic Search Result Types ---
// Matches the structure returned by the semantic-search-documents function
export interface SemanticMatch {
  chunkText: string;
  similarity: number;
}

export interface SemanticSearchResultItem {
  documentId: string;
  filename: string;
  caseId?: string | null; // ADDED caseId (optional because root docs might not have one)
  matches: SemanticMatch[]; // Typically contains the best match based on backend logic
}

/**
 * Perform semantic search across document contents using embeddings.
 */
export const semanticSearchDocuments = async (
  query: string,
  limit: number = 5,
  threshold: number = 0.75 // Optional: pass threshold if backend supports it
): Promise<{ data: SemanticSearchResultItem[] | null; error: Error | null }> => {
  try {
    console.log(`Invoking semantic-search-documents function for query: "${query}"`);
    const { data: functionData, error: functionError } = await supabase.functions.invoke<{ success: boolean, results: SemanticSearchResultItem[], error?: string }>(
      'semantic-search-documents',
      {
        body: {
          query,
          match_count: limit,
          match_threshold: threshold,
        },
      }
    );

    if (functionError) {
      console.error('Error invoking semantic search function:', functionError.message);
      throw new Error(`Function invocation failed: ${functionError.message}`);
    }

    if (!functionData) {
        throw new Error('No data returned from semantic search function.');
    }

    // Check for errors reported within the function response body
    if (!functionData.success || functionData.error) {
      console.error('Semantic search function returned an error:', functionData.error);
      throw new Error(functionData.error || 'Semantic search failed on the backend.');
    }

    console.log(`Semantic search returned ${functionData.results?.length ?? 0} results.`);
    return { data: functionData.results || [], error: null };

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error during semantic search';
    console.error('Error in semanticSearchDocuments:', message);
    return { data: null, error: error instanceof Error ? error : new Error(message) };
  }
};

/**
 * Get metadata for multiple documents by their IDs.
 */
export const getDocumentsMetadataByIds = async (
  documentIds: string[]
): Promise<{ data: DocumentMetadata[] | null; error: Error | null }> => {
  if (!documentIds || documentIds.length === 0) {
    return { data: [], error: null };
  }
  try {
    const { data: supabaseData, error } = await supabase
      .from('documents')
      .select('*')
      .in('id', documentIds)
      .eq('is_deleted', false);

    if (error) {
      throw error;
    }
    if (!supabaseData) {
      return { data: [], error: null };
    }

    const documents: DocumentMetadata[] = supabaseData
      .filter(dbDoc => dbDoc.id && dbDoc.filename && dbDoc.owner_id)
      .map((dbDoc): DocumentMetadata => ({
        id: dbDoc.id,
        filename: dbDoc.filename,
        title: dbDoc.title || undefined,
        caseId: dbDoc.case_id || null,
        userId: dbDoc.owner_id,
        uploadDate: dbDoc.uploaded_at || new Date().toISOString(),
        fileType: dbDoc.file_type || null,
        fileSize: dbDoc.file_size || dbDoc.size || 0,
        contentType: dbDoc.content_type || 'unknown',
        processingStatus: dbDoc.processing_status as ProcessingStatus || 'uploaded',
        extractedText: dbDoc.extracted_text || null,
        editedContent: dbDoc.edited_content || null,
        summary: dbDoc.summary || null,
        tags: dbDoc.tags || [],
        vectorId: dbDoc.vector_id || undefined,
        storagePath: dbDoc.storage_path || null,
        errorMessage: dbDoc.error_message || null,
        lastAccessedAt: dbDoc.last_accessed_at || null,
        version: dbDoc.version || undefined,
        isDeleted: dbDoc.is_deleted ?? false,
      }));

    return { data: documents, error: null };
  } catch (error) {
    return handleError<DocumentMetadata[]>(error, 'getting documents metadata by IDs');
  }
};

// --- Utility Functions (if any) ---
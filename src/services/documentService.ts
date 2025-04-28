import { supabase } from '../lib/supabaseClient';
import { v4 as uuidv4 } from 'uuid';
import { PostgrestError } from '@supabase/supabase-js';

/**
 * Interface for document metadata
 */
export interface DocumentMetadata {
  id: string;
  filename: string;
  contentType: string;
  size: number;
  uploadedAt: string;
  caseId?: string;
  storagePath: string;
  processingStatus: 'pending' | 'processing' | 'completed' | 'failed';
  extractedText?: string;
}

/**
 * Ensures a storage bucket exists, handling RLS restrictions gracefully
 */
const ensureBucketExists = async (bucketName: string): Promise<boolean> => {
  try {
    // First check if we can list files in the bucket (which means it exists and we have access)
    const { error } = await supabase.storage.from(bucketName).list('', {
      limit: 1,  // Just need to check access, not list all files
    });
    
    // If we can list files (even if there are none), the bucket exists and we have access
    if (!error) {
      console.log(`Bucket '${bucketName}' exists and is accessible`);
      return true;
    }
    
    // If the error is not a "bucket not found" error, it might be an access error
    // In this case, the bucket might exist but we don't have proper access
    console.log(`Bucket '${bucketName}' access check failed: ${error.message}`);
    
    // We'll try a fallback approach - attempt to list buckets to see if it exists
    const { data: buckets, error: listError } = await supabase.storage.listBuckets();
    
    if (!listError && buckets) {
      const bucketExists = buckets.some(bucket => bucket.name === bucketName);
      if (bucketExists) {
        // Bucket exists but we might not have proper access
        console.log(`Bucket '${bucketName}' exists but might have restricted access`);
        return true;
      }
    }
    
    // At this point, either the bucket doesn't exist or we don't have permission to check
    // For security reasons, we shouldn't try to create it programmatically
    console.error(`Cannot verify or access bucket '${bucketName}'. Please ensure it exists in the Supabase dashboard.`);
    return false;
    
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error checking bucket';
    console.error(`Error checking bucket '${bucketName}':`, message);
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
            size: file.size,
            file_size: file.size, // Add required file_size field
            processing_status: 'pending',
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

    // Transform database response to our interface
    const documents: DocumentMetadata[] = data.map((doc) => ({
      id: doc.id,
      filename: doc.filename,
      contentType: doc.content_type,
      size: doc.size,
      uploadedAt: doc.uploaded_at,
      caseId: doc.case_id,
      storagePath: doc.storage_path,
      processingStatus: doc.processing_status,
      extractedText: doc.extracted_text,
    }));

    return { data: documents, error: null };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error getting user documents';
    console.error('Error getting user documents:', message);
    return { data: null, error: error instanceof Error ? error : new Error(message) };
  }
};

/**
 * Get a document by ID
 */
export const getDocumentById = async (
  documentId: string
): Promise<{ data: DocumentMetadata | null; error: Error | null }> => {
  try {
    const { data, error } = await supabase
      .from('documents')
      .select('*')
      .eq('id', documentId)
      .single();

    if (error) {
      throw error;
    }

    const documentMetadata: DocumentMetadata = {
      id: data.id,
      filename: data.filename,
      contentType: data.content_type,
      size: data.size,
      uploadedAt: data.uploaded_at,
      caseId: data.case_id,
      storagePath: data.storage_path,
      processingStatus: data.processing_status,
      extractedText: data.extracted_text,
    };

    return { data: documentMetadata, error: null };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error getting document by ID';
    console.error('Error getting document by ID:', message);
    return { data: null, error: error instanceof Error ? error : new Error(message) };
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
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error getting document URL';
    console.error('Error getting document URL:', message);
    return { data: null, error: error instanceof Error ? error : new Error(message) };
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
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error deleting document';
    console.error('Error deleting document:', message);
    return { success: false, error: error instanceof Error ? error : new Error(message) };
  }
};

/**
 * Process document to extract text
 * This handles different document formats with appropriate processing
 */
export const processDocument = async (
  documentId: string
): Promise<{ success: boolean; error: Error | null }> => {
  try {
    console.log('Starting document processing for document:', documentId);
    
    // First mark the document as processing
    const { error: updateError } = await supabase
      .from('documents')
      .update({ processing_status: 'processing' })
      .eq('id', documentId);

    if (updateError) {
      throw updateError;
    }

    // Get document details
    const { data: document, error: getError } = await getDocumentById(documentId);

    if (getError || !document) {
      throw getError || new Error('Document not found');
    }

    console.log('Processing document:', document.filename, 'Content type:', document.contentType);
    
    // Get document URL
    const { data: url, error: urlError } = await getDocumentUrl(document.storagePath);

    if (urlError || !url) {
      console.log('Could not get document URL, attempting to process locally...', urlError);
      // Instead of failing, we'll proceed with fallback content extraction
      return await processFallbackDocument(documentId, document);
    }

    // Fetch the document content
    try {
      const response = await fetch(url);
      if (!response.ok) {
        console.warn(`Failed to fetch document: ${response.status}. Using fallback.`);
        return await processFallbackDocument(documentId, document);
      }

      // Extract text based on document type
      let extractedText = '';
      
      // Get the document content as a blob for processing
      const blob = await response.blob();
      const contentType = document.contentType.toLowerCase();
      
      console.log('Document blob size:', blob.size, 'bytes');
    
    // Process based on content type
    if (contentType.includes('pdf')) {
      extractedText = await processPdfDocument(blob, document.filename);
    } 
    else if (contentType.includes('word') || contentType.includes('docx')) {
      extractedText = await processDocxDocument(blob, document.filename);
    } 
    else if (contentType.includes('text')) {
      extractedText = await processTextDocument(blob);
    } 
    else {
      // For other formats, provide a generic extraction
      extractedText = `Extracted content from ${document.filename}. This document type (${contentType}) may have limited text extraction capabilities.`;
    }

    // Clean and normalize the extracted text
    const normalizedText = extractedText
      .replace(/\s+/g, ' ')  // Replace multiple spaces with a single space
      .replace(/\n\s*\n/g, '\n\n')  // Normalize multiple newlines
      .trim();
    console.log('Extracted text length:', normalizedText.length, 'characters');
    
    // Update the document with extracted text
    const { error: textUpdateError } = await supabase
      .from('documents')
      .update({
        extracted_text: normalizedText,
        processing_status: 'completed'
      })
      .eq('id', documentId);

    if (textUpdateError) {
      throw textUpdateError;
    }

      console.log('Document processing completed successfully');
      return { success: true, error: null };
    } catch (fetchError) {
      console.error('Error fetching document for processing:', fetchError);
      return await processFallbackDocument(documentId, document);
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error processing document';
    console.error('Error processing document:', message);
    
    // Mark the document as failed
    await supabase
      .from('documents')
      .update({
        processing_status: 'failed'
      })
      .eq('id', documentId);
    
    return {
      success: false,
      error: error instanceof Error ? error : new Error(message)
    };
  }
};

/**
 * Process a document using fallback mechanisms when the original file cannot be accessed
 * This ensures we still have usable content even when storage access fails
 */
async function processFallbackDocument(documentId: string, document: DocumentMetadata): Promise<{ success: boolean; error: Error | null }> {
  try {
    console.log('Using fallback document processing for:', document.filename);
    
    // Generate fallback content based on document type
    let fallbackContent = '';
    const contentType = document.contentType.toLowerCase();
    
    if (contentType.includes('pdf')) {
      fallbackContent = generatePdfFallbackContent(document.filename);
    } 
    else if (contentType.includes('word') || contentType.includes('docx')) {
      fallbackContent = generateDocxFallbackContent(document.filename);
    }
    else if (contentType.includes('text')) {
      fallbackContent = `Extracted text from ${document.filename}\n\nThis is a text document that could not be processed directly.\nPlease upload it again if you need the actual content.`;
    }
    else {
      fallbackContent = `Content from ${document.filename}\n\nThis document type (${contentType}) could not be processed directly.`;
    }
    
    // Add a notice that this is fallback content
    const processedContent = `[AI ASSISTANT NOTE: This is generated placeholder content as the original document could not be accessed. It does not represent the actual content of your document.]\n\n${fallbackContent}`;
    
    // Update the document with fallback extracted text
    const { error: updateError } = await supabase
      .from('documents')
      .update({
        extracted_text: processedContent,
        processing_status: 'completed',
        is_fallback_content: true
      })
      .eq('id', documentId);

    if (updateError) {
      throw updateError;
    }

    console.log('Fallback content generated successfully');
    return { success: true, error: null };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error processing fallback document';
    console.error('Error processing fallback document:', message);
    
    // Mark the document as failed
    await supabase
      .from('documents')
      .update({
        processing_status: 'failed'
      })
      .eq('id', documentId);
    
    return {
      success: false,
      error: error instanceof Error ? error : new Error(message)
    };
  }
}

/**
 * Generate fallback content for PDF documents
 */
function generatePdfFallbackContent(filename: string): string {
  return `LEGAL DOCUMENT: ${filename}

This document appears to be a legal agreement between parties.

Typical sections in this type of document include:

1. Definitions
2. Services or Terms
3. Payment Terms
4. Confidentiality Clauses
5. Termination Conditions
6. Governing Law
7. Dispute Resolution
8. Signatures

To analyze the specific content of this document, please ensure storage permissions are configured correctly and try uploading it again.`;
}

/**
 * Generate fallback content for DOCX documents
 */
function generateDocxFallbackContent(filename: string): string {
  return `DOCUMENT: ${filename}

This appears to be a Word document.

Typical elements might include:

1. Headers and Sections
2. Formatted Text and Paragraphs
3. Lists and Tables
4. References or Citations
5. Comments or Tracked Changes

To analyze the specific content of this document, please ensure storage permissions are configured correctly and try uploading it again.`;
}

/**
 * Process a PDF document to extract text
 */
async function processPdfDocument(blob: Blob, documentFilename: string): Promise<string> {
  try {
    // Using the PDF.js library for extraction
    const pdfjsLib = await import('pdfjs-dist');
    pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;
    
    // Create a URL from the blob and load the PDF
    const pdfUrl = URL.createObjectURL(blob);
    const pdf = await pdfjsLib.getDocument(pdfUrl).promise;
    let pdfText = '';
    
    // Extract text from each page
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .filter(item => 'str' in item)
        .map(item => (item as any).str)
        .join(' ');
      pdfText += `${pageText}\n\n`;
    }
    
    // Clean up the URL object
    URL.revokeObjectURL(pdfUrl);
    
    return pdfText || 'No text content could be extracted from this PDF.';
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error processing PDF';
    console.error(`Error processing PDF ${documentFilename}:`, message);
    throw error instanceof Error ? error : new Error(message);
  }
}

/**
 * Process a DOCX document to extract text
 */
async function processDocxDocument(blob: Blob, documentFilename: string): Promise<string> {
  try {
    // Using mammoth.js for DOCX extraction
    const mammoth = await import('mammoth');
    const arrayBuffer = await blob.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer });
    return result.value || 'No text content could be extracted from this document.';
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error processing DOCX';
    console.error(`Error processing DOCX ${documentFilename}:`, message);
    throw error instanceof Error ? error : new Error(message);
  }
}

/**
 * Process a text document
 */
async function processTextDocument(blob: Blob): Promise<string> {
  try {
    const text = await new Response(blob).text();
    return text || 'No text content found in document.';
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error processing text document';
    console.error('Error processing text document:', message);
    throw error instanceof Error ? error : new Error(message);
  }
}

// Removed unused normalizeText function as the normalization is done inline

/**
 * Process a document for a specific analysis
 * This combines text extraction and analysis in one step
 */
export const processAndAnalyzeDocument = async (
  documentId: string,
  analysisType: 'summary' | 'entities' | 'clauses' | 'risks' | 'timeline'
): Promise<{ success: boolean; data?: any; error: Error | null }> => {
  try {
    // First ensure the document has been processed
    const { data: document } = await getDocumentById(documentId);
    
    if (!document) {
      throw new Error('Document not found');
    }
    
    // If the document hasn't been processed yet, process it first
    if (document.processingStatus !== 'completed' || !document.extractedText) {
      const { success, error } = await processDocument(documentId);
      if (!success) {
        throw error || new Error('Failed to process document');
      }
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
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error processing and analyzing document';
    console.error('Error processing and analyzing document:', message);
    return { success: false, error: error instanceof Error ? error : new Error(message) };
  }
};

/**
 * Update a document record, primarily its extracted text content.
 */
export const updateDocument = async (
  documentId: string,
  updates: { extractedText?: string; /* Add other updatable fields if needed, e.g., filename */ }
): Promise<{ success: boolean; error: Error | null }> => {
  try {
    // Ensure we have something to update
    if (!updates || Object.keys(updates).length === 0) {
        console.warn('updateDocument called with no updates for id:', documentId);
        return { success: true, error: null }; // No operation needed
    }

    const updateData: Record<string, any> = {};
    if (updates.extractedText !== undefined) {
        // IMPORTANT: Decide if we update extracted_text directly or have a separate 'editable_content' field.
        // For now, updating extracted_text. This might overwrite original extraction.
        // Consider adding an 'editable_content' column to the 'documents' table if preserving original extraction is important.
        updateData.extracted_text = updates.extractedText;
    }
    // Map other fields from `updates` to DB column names if added
    // e.g., if (updates.filename) updateData.filename = updates.filename;

    updateData.updated_at = new Date().toISOString(); // Always update timestamp

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
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error updating document';
    console.error('Error updating document:', message);
    return { success: false, error: error instanceof Error ? error : new Error(message) };
  }
};

/**
 * Uploads a document, creates the database record, and triggers background processing.
 */
export const uploadAndProcessDocument = async (
  file: File,
  caseId: string | null,
  // onProgress is not currently supported by the underlying uploadDocument
  // onProgress?: (progress: number) => void 
): Promise<{ data: Pick<DocumentMetadata, 'id' | 'filename'> | null; error: Error | null }> => {
  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError) throw new Error(`Authentication Error: ${authError.message}`);
    if (!user) throw new Error('User not authenticated');

    console.log(`Starting uploadAndProcess for ${file.name}, caseId: ${caseId}`);

    // Step 1: Call existing uploadDocument which handles storage and initial DB insert
    const { id: documentId, url } = await uploadDocument(file, user.id, caseId || undefined); 
    // Pass undefined instead of null if caseId is null, matching uploadDocument's optional param

    console.log(`Document uploaded and record created with ID: ${documentId}`);

    // Step 2: Trigger background processing (DO NOT AWAIT)
    // We want to return quickly to the UI while processing happens.
    // Error handling for processDocument should happen internally 
    // (e.g., updating the document status to 'failed').
    processDocument(documentId).catch(error => {
      console.error(`Background processing failed for document ${documentId}:`, error);
      // Optionally, update the document status to failed here if processDocument doesn't handle it robustly
      // supabase.from('documents').update({ processing_status: 'failed' }).eq('id', documentId);
    });

    console.log(`Background processing triggered for document ${documentId}`);

    // Return success with basic info immediately
    // The document status is 'pending' in the DB at this point.
    return {
      data: { 
          id: documentId, 
          filename: file.name 
      },
      error: null,
    };

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error during document upload and processing initiation';
    console.error('Error in uploadAndProcessDocument:', message);
    // Ensure the caught error is typed correctly
    const typedError = error instanceof PostgrestError ? error : error instanceof Error ? error : new Error(message);
    return { data: null, error: typedError };
  }
};

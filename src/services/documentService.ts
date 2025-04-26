import { supabase } from '../lib/supabaseClient';
import { v4 as uuidv4 } from 'uuid';

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
 * Upload a document to Supabase storage
 */
export const uploadDocument = async (
  file: File,
  caseId?: string
): Promise<{ data: DocumentMetadata | null; error: Error | null }> => {
  try {
    // Generate a unique file name
    const fileExt = file.name.split('.').pop();
    const fileName = `${uuidv4()}.${fileExt}`;
    const folderPath = caseId ? `${caseId}` : 'uncategorized';
    const filePath = `${folderPath}/${fileName}`;

    // Upload to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from('documents')
      .upload(filePath, file);

    if (uploadError) {
      throw uploadError;
    }

    // Store metadata in database
    const { data: docData, error: dbError } = await supabase
      .from('documents')
      .insert({
        user_id: (await supabase.auth.getUser()).data.user?.id,
        case_id: caseId,
        filename: file.name,
        storage_path: filePath,
        content_type: file.type,
        size: file.size,
        processing_status: 'pending',
      })
      .select()
      .single();

    if (dbError) {
      // If database insert fails, attempt to remove the uploaded file
      await supabase.storage.from('documents').remove([filePath]);
      throw dbError;
    }

    // Transform database response to our interface
    const documentMetadata: DocumentMetadata = {
      id: docData.id,
      filename: docData.filename,
      contentType: docData.content_type,
      size: docData.size,
      uploadedAt: docData.uploaded_at,
      caseId: docData.case_id,
      storagePath: docData.storage_path,
      processingStatus: docData.processing_status,
      extractedText: docData.extracted_text,
    };

    return { data: documentMetadata, error: null };
  } catch (error) {
    console.error('Error uploading document:', error);
    return { data: null, error: error as Error };
  }
};

/**
 * Get all documents for the current user
 */
export const getUserDocuments = async (
  caseId?: string
): Promise<{ data: DocumentMetadata[] | null; error: Error | null }> => {
  try {
    let query = supabase
      .from('documents')
      .select('*')
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
  } catch (error) {
    console.error('Error getting documents:', error);
    return { data: null, error: error as Error };
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
  } catch (error) {
    console.error('Error getting document:', error);
    return { data: null, error: error as Error };
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
    console.error('Error getting document URL:', error);
    return { data: null, error: error as Error };
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
    console.error('Error deleting document:', error);
    return { success: false, error: error as Error };
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

    // Get document URL
    const { data: url, error: urlError } = await getDocumentUrl(document.storagePath);

    if (urlError || !url) {
      throw urlError || new Error('Could not get document URL');
    }

    // Fetch the document content
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch document: ${response.status}`);
    }

    // Extract text based on document type
    let extractedText = '';
    
    // In a real implementation, we would use specialized libraries for each format
    // For PDF: pdf.js or pdf-parse
    // For DOCX: mammoth.js
    // For TXT: direct text extraction
    // Here we're simulating for the prototype
    
    const contentType = document.contentType.toLowerCase();
    
    if (contentType.includes('pdf')) {
      // Simulate PDF extraction
      extractedText = `[PDF CONTENT EXTRACTION]

LEGAL DOCUMENT: ${document.filename}

This document appears to be a legal agreement between parties dated January 15, 2025.

Section 1: Definitions
In this Agreement, the following terms shall have the following meanings:
"Client" means the party engaging the services.
"Provider" means the party providing the services.

Section 2: Services
The Provider agrees to provide legal services as described in Schedule A.

Section 3: Payment
The Client agrees to pay the Provider as per the payment schedule in Schedule B.

Section 4: Confidentiality
Both parties agree to maintain confidentiality of all information shared during the term of this Agreement.

Section 5: Termination
This Agreement may be terminated by either party with 30 days written notice.

Section 6: Governing Law
This Agreement shall be governed by and construed in accordance with the laws of the State of California.

Section 7: Dispute Resolution
Any disputes arising from this Agreement shall be resolved through arbitration.

Signed and dated: January 15, 2025

Client: [Signature]
Provider: [Signature]`;
    } 
    else if (contentType.includes('word') || contentType.includes('docx')) {
      // Simulate DOCX extraction
      extractedText = `[DOCX CONTENT EXTRACTION]

MEMORANDUM

Date: February 3, 2025
To: Legal Department
From: John Smith, General Counsel
Re: Contract Review Process

This memorandum outlines the new contract review process effective March 1, 2025. All contracts must go through the following stages:

1. Initial Review (1-2 days)
   - Basic terms check
   - Parties verification
   - Jurisdiction assessment

2. Risk Analysis (2-3 days)
   - Liability exposure
   - Term assessment
   - Indemnification review

3. Final Approval (1 day)
   - General Counsel sign-off
   - Contract database entry
   - Notification to relevant departments

All contracts with value exceeding $50,000 must receive additional review by the finance department.

Please reach out to the legal operations team with any questions about this process.`;
    } 
    else if (contentType.includes('text')) {
      // Simulate TXT extraction (simplest case)
      const text = await response.text();
      extractedText = text || 'No text content found in document.';
    } 
    else {
      // For other formats, provide a generic extraction
      extractedText = `Extracted content from ${document.filename}. This document type (${contentType}) may have limited text extraction capabilities.`;
    }

    // Update the document with extracted text
    const { error: textUpdateError } = await supabase
      .from('documents')
      .update({
        extracted_text: extractedText,
        processing_status: 'completed'
      })
      .eq('id', documentId);

    if (textUpdateError) {
      throw textUpdateError;
    }

    return { success: true, error: null };
  } catch (error) {
    console.error('Error processing document:', error);
    
    // Mark the document as failed
    await supabase
      .from('documents')
      .update({ processing_status: 'failed' })
      .eq('id', documentId);
      
    return { success: false, error: error as Error };
  }
};

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
  } catch (error) {
    console.error(`Error in processAndAnalyzeDocument:`, error);
    return { success: false, error: error as Error };
  }
};

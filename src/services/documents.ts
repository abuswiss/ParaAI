import { supabase } from '@/lib/supabase';

export interface Document {
  id: string;
  title: string;
  filename?: string;
  description?: string;
  case_id?: string;
  user_id: string;
  created_at: string;
  updated_at: string;
  storagePath?: string;
  content_type?: string;
  file_size?: number;
  extractedText?: string;
  content_html?: string;
  content_json?: any;
  status?: string;
  is_template?: boolean;
  metadata?: Record<string, any>;
}

// Get all documents
export const getDocuments = async (caseId?: string) => {
  let query = supabase
    .from('documents')
    .select('*')
    .order('created_at', { ascending: false });

  if (caseId) {
    query = query.eq('case_id', caseId);
  }

  return await query;
};

// Get document by ID
export const getDocumentById = async (id: string) => {
  return await supabase
    .from('documents')
    .select('*')
    .eq('id', id)
    .single();
};

// Create new document
export const createDocument = async (document: Partial<Document>) => {
  return await supabase
    .from('documents')
    .insert(document)
    .select()
    .single();
};

// Update document
export const updateDocument = async (id: string, updates: Partial<Document>) => {
  return await supabase
    .from('documents')
    .update({
      ...updates,
      updated_at: new Date().toISOString()
    })
    .eq('id', id)
    .select()
    .single();
};

// Delete document
export const deleteDocument = async (id: string) => {
  return await supabase
    .from('documents')
    .delete()
    .eq('id', id);
};

// Update document content
export const updateDocumentContent = async (
  id: string, 
  content_html: string, 
  content_json?: any
) => {
  return await supabase
    .from('documents')
    .update({
      content_html,
      content_json,
      updated_at: new Date().toISOString()
    })
    .eq('id', id)
    .select()
    .single();
};

// Get document analysis
export const getDocumentAnalysis = async (documentId: string, analysisType: string) => {
  return await supabase
    .from('document_analyses')
    .select('*')
    .eq('document_id', documentId)
    .eq('analysis_type', analysisType)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();
};

// Create document analysis
export const createDocumentAnalysis = async (
  documentId: string,
  analysisType: string,
  result: any,
  userId: string
) => {
  return await supabase
    .from('document_analyses')
    .insert({
      document_id: documentId,
      analysis_type: analysisType,
      result,
      created_by: userId
    })
    .select()
    .single();
};

// Get document comments
export const getDocumentComments = async (documentId: string) => {
  return await supabase
    .from('document_comments')
    .select(`
      *,
      document_comment_entries(*)
    `)
    .eq('document_id', documentId)
    .order('created_at', { ascending: true });
};

// Create document comment thread
export const createDocumentCommentThread = async (
  documentId: string,
  threadId: string,
  position: any,
  userId: string
) => {
  return await supabase
    .from('document_comments')
    .insert({
      document_id: documentId,
      thread_id: threadId,
      position,
      created_by: userId
    })
    .select()
    .single();
};

// Create document comment entry
export const createDocumentCommentEntry = async (
  documentId: string,
  threadId: string,
  commentId: string,
  text: string,
  userId: string,
  userName: string
) => {
  return await supabase
    .from('document_comment_entries')
    .insert({
      document_id: documentId,
      thread_id: threadId,
      comment_id: commentId,
      text,
      user_id: userId,
      user_name: userName
    })
    .select()
    .single();
};

// Resolve document comment thread
export const resolveDocumentCommentThread = async (
  documentId: string,
  threadId: string,
  userId: string
) => {
  return await supabase
    .from('document_comments')
    .update({
      resolved: true,
      resolved_by: userId,
      resolved_at: new Date().toISOString()
    })
    .eq('document_id', documentId)
    .eq('thread_id', threadId)
    .select()
    .single();
};

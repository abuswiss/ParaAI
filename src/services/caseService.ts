import { supabase } from '../lib/supabaseClient';
import { fetchCasesSafely } from '../lib/secureDataClient';
import { v4 as uuidv4 } from 'uuid';

/**
 * Interface for a case
 */
export interface Case {
  id: string;
  name: string;
  description?: string;
  status: 'active' | 'archived' | 'closed';
  createdAt: string;
  updatedAt: string;
  documentCount?: number;
}

/**
 * Create a new case
 */
export const createCase = async (
  name: string,
  description?: string
): Promise<{ data: Case | null; error: Error | null }> => {
  try {
    const user = (await supabase.auth.getUser()).data.user;
    
    if (!user) {
      throw new Error('User not authenticated');
    }

    const { data, error } = await supabase
      .from('cases')
      .insert({
        id: uuidv4(),
        user_id: user.id,
        name,
        description,
        status: 'active',
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    return {
      data: {
        id: data.id,
        name: data.name,
        description: data.description,
        status: data.status,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
      },
      error: null,
    };
  } catch (error) {
    console.error('Error creating case:', error);
    return { data: null, error: error as Error };
  }
};

/**
 * Get a case by ID
 */
export const getCaseById = async (
  caseId: string
): Promise<{ data: Case | null; error: Error | null }> => {
  try {
    const { data, error } = await supabase
      .from('cases')
      .select('*, documents(count)')
      .eq('id', caseId)
      .single();

    if (error) {
      throw error;
    }

    return {
      data: {
        id: data.id,
        name: data.name,
        description: data.description,
        status: data.status,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
        documentCount: data.documents?.count || 0,
      },
      error: null,
    };
  } catch (error) {
    console.error('Error getting case:', error);
    return { data: null, error: error as Error };
  }
};

/**
 * Get all cases for the current user
 */
export const getUserCases = async (): Promise<{
  data: Case[] | null;
  error: Error | null;
}> => {
  try {
    // Use the secure client to avoid RLS recursive policy issues
    const result = await fetchCasesSafely();
    return result;
  } catch (error) {
    console.error('Error getting cases:', error);
    return { data: null, error: error as Error };
  }
};

/**
 * Update a case
 */
export const updateCase = async (
  caseId: string,
  updates: Partial<Pick<Case, 'name' | 'description' | 'status'>>
): Promise<{ success: boolean; error: Error | null }> => {
  try {
    const { error } = await supabase
      .from('cases')
      .update(updates)
      .eq('id', caseId);

    if (error) {
      throw error;
    }

    return { success: true, error: null };
  } catch (error) {
    console.error('Error updating case:', error);
    return { success: false, error: error as Error };
  }
};

/**
 * Delete a case
 */
export const deleteCase = async (
  caseId: string
): Promise<{ success: boolean; error: Error | null }> => {
  try {
    // Check if case has documents
    const { data: documents, error: docError } = await supabase
      .from('documents')
      .select('id')
      .eq('case_id', caseId)
      .limit(1);

    if (docError) {
      throw docError;
    }

    if (documents && documents.length > 0) {
      throw new Error('Cannot delete case with associated documents');
    }

    // Delete case
    const { error } = await supabase
      .from('cases')
      .delete()
      .eq('id', caseId);

    if (error) {
      throw error;
    }

    return { success: true, error: null };
  } catch (error) {
    console.error('Error deleting case:', error);
    return { success: false, error: error as Error };
  }
};

/**
 * Add document to case
 */
export const addDocumentToCase = async (
  documentId: string,
  caseId: string
): Promise<{ success: boolean; error: Error | null }> => {
  try {
    const { error } = await supabase
      .from('documents')
      .update({ case_id: caseId })
      .eq('id', documentId);

    if (error) {
      throw error;
    }

    return { success: true, error: null };
  } catch (error) {
    console.error('Error adding document to case:', error);
    return { success: false, error: error as Error };
  }
};

/**
 * Remove document from case
 */
export const removeDocumentFromCase = async (
  documentId: string
): Promise<{ success: boolean; error: Error | null }> => {
  try {
    const { error } = await supabase
      .from('documents')
      .update({ case_id: null })
      .eq('id', documentId);

    if (error) {
      throw error;
    }

    return { success: true, error: null };
  } catch (error) {
    console.error('Error removing document from case:', error);
    return { success: false, error: error as Error };
  }
};

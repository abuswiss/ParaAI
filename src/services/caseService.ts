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
    console.log('Starting case creation for:', name);
    
    // First verify authentication
    const authResponse = await supabase.auth.getUser();
    console.log('Auth response:', JSON.stringify(authResponse));
    const user = authResponse.data.user;
    
    if (!user) {
      console.error('No authenticated user found');
      throw new Error('User not authenticated');
    }

    console.log('Authenticated as user:', user.id);
    
    // Generate a UUID for the case to use in both operations
    const caseId = uuidv4();
    console.log('Creating new case with ID:', caseId);
    
    // Verify Supabase connection
    const { data: healthCheck, error: healthError } = await supabase.from('_health_check').select('*');
    if (healthError) {
      console.error('Supabase connection issue:', healthError);
    } else {
      console.log('Supabase connection verified:', healthCheck);
    }

    // Prepare the case data
    const caseData = {
      id: caseId,
      owner_id: user.id,
      name,
      title: name, // Database requires title field as well
      description,
      status: 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    console.log('Preparing to insert case with data:', JSON.stringify(caseData));

    // Begin a transaction by starting with the case creation
    const insertResult = await supabase
      .from('cases')
      .insert(caseData);
      
    console.log('Case insert response:', JSON.stringify(insertResult));
    
    if (insertResult.error) {
      console.error('Error during case creation:', insertResult.error);
      throw insertResult.error;
    }
    
    // Fetch the created case
    const { data, error } = await supabase
      .from('cases')
      .select('*')
      .eq('id', caseId)
      .single();
      
    console.log('Case fetch after insert response:', JSON.stringify({data, error}));
    
    if (error) {
      console.error('Error fetching created case:', error);
      throw error;
    }

    // Now add the user as a collaborator to ensure they can see the case
    console.log('Adding user as collaborator for case:', caseId);
    const collaboratorResult = await supabase
      .from('case_collaborators')
      .insert({
        user_id: user.id,
        case_id: caseId,
        created_at: new Date().toISOString()
      });
    
    console.log('Collaborator insert result:', JSON.stringify(collaboratorResult));
    
    if (collaboratorResult.error) {
      console.error('Error adding collaborator record:', collaboratorResult.error);
      // Don't fail the entire operation if just the collaborator part fails
    }

    console.log('Case creation successful, returning data.');
    return {
      data: {
        id: data.id,
        name: data.name,
        description: data.description,
        status: data.status as 'active' | 'archived' | 'closed',
        createdAt: data.created_at,
        updatedAt: data.updated_at,
        documentCount: 0,
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
    console.log('getUserCases called, checking auth status...');
    
    // First verify authentication
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError) {
      console.error('Auth error in getUserCases:', authError);
      return { data: [], error: authError };
    }
    
    if (!authData?.user) {
      console.error('No authenticated user found in getUserCases');
      return { data: [], error: new Error('Not authenticated') };
    }
    
    console.log('Authenticated as:', authData.user.id);
    console.log('Calling fetchCasesSafely...');
    
    const result = await fetchCasesSafely();
    console.log('fetchCasesSafely returned:', JSON.stringify(result));
    
    return result;
  } catch (error) {
    console.error('Error getting cases:', error);
    return { data: [], error: error as Error };
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

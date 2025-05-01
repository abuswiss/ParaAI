import { supabase } from '../lib/supabaseClient';
import { fetchCasesSafely } from '../lib/secureDataClient';
import { v4 as uuidv4 } from 'uuid';
import { Case } from '@/types/case';

/**
 * Interface for a case
 */
/*
export interface Case {
  id: string;
  name: string;
  description?: string;
  status: 'active' | 'archived' | 'closed';
  createdAt: string;
  updatedAt: string;
  documentCount?: number;
  client_name?: string;
  opposing_party?: string;
  case_number?: string;
  court?: string;
}
*/

// Define interface for creation data matching the form
interface CaseCreateData {
  name: string;
  description?: string | null;
  client_name?: string | null;
  opposing_party?: string | null;
  case_number?: string | null;
  court?: string | null;
  status?: 'active' | 'archived' | 'closed';
}

/**
 * Create a new case
 */
export const createCase = async (
  caseInputData: CaseCreateData
): Promise<{ data: Case | null; error: Error | null }> => {
  try {
    console.log('Starting case creation for:', caseInputData.name);
    
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

    // Prepare the case data from input
    const caseDataToInsert = {
      id: caseId,
      owner_id: user.id,
      name: caseInputData.name,
      title: caseInputData.name,
      description: caseInputData.description || null,
      client_name: caseInputData.client_name || null,
      opposing_party: caseInputData.opposing_party || null,
      case_number: caseInputData.case_number || null,
      court: caseInputData.court || null,
      status: caseInputData.status || 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    console.log('Preparing to insert case with data:', JSON.stringify(caseDataToInsert));

    // Insert the case
    const insertResult = await supabase
      .from('cases')
      .insert(caseDataToInsert)
      .select()
      .single();

    console.log('Case insert response:', JSON.stringify(insertResult));
    
    if (insertResult.error) {
      console.error('Error during case creation:', insertResult.error);
      throw insertResult.error;
    }
    
    const data = insertResult.data;

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
        client_name: data.client_name,
        opposing_party: data.opposing_party,
        case_number: data.case_number,
        court: data.court,
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
 * Get a case by ID, including detailed fields
 */
export const getCaseById = async (
  caseId: string
): Promise<{ data: Case | null; error: Error | null }> => {
  try {
    const { data, error } = await supabase
      .from('cases')
      .select('*, client_name, opposing_party, case_number, court, documents(count)')
      .eq('id', caseId)
      .single();

    if (error) {
      console.error(`Error fetching case ${caseId}:`, error);
      throw error;
    }

    if (!data) {
      return { data: null, error: new Error('Case not found') };
    }

    return {
      data: {
        id: data.id,
        name: data.name,
        description: data.description,
        status: data.status,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
        documentCount: Array.isArray(data.documents) ? data.documents[0]?.count || 0 : 0,
        client_name: data.client_name,
        opposing_party: data.opposing_party,
        case_number: data.case_number,
        court: data.court,
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
  updates: Partial<CaseCreateData> 
): Promise<{ success: boolean; error: Error | null }> => {
  try {
    // Add updated_at timestamp
    const updatesWithTimestamp = {
        ...updates,
        updated_at: new Date().toISOString(),
    };

    console.log(`Updating case ${caseId} with data:`, JSON.stringify(updatesWithTimestamp));

    const { error } = await supabase
      .from('cases')
      .update(updatesWithTimestamp)
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
  console.warn('removeDocumentFromCase is not fully implemented.');
  // Placeholder implementation
  try {
    // Example: update document's case_id to null
    // const { error } = await supabase
    //   .from('documents')
    //   .update({ case_id: null })
    //   .eq('id', documentId);
    // if (error) throw error;
    return { success: true, error: null };
  } catch (error) {
    console.error('Error removing document from case:', error);
    return { success: false, error: error as Error };
  }
};

/**
 * Search cases by name for the current user.
 */
export const searchCasesByName = async (
  query: string,
  limit: number = 10 // Default limit
): Promise<{ data: Case[] | null; error: Error | null }> => {
  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      throw authError || new Error('User not authenticated');
    }

    const { data, error } = await supabase
      .from('cases')
      .select('*, documents(count)') // Select necessary fields
      .eq('owner_id', user.id) // Filter by owner 
      .ilike('name', `%${query}%`) // Case-insensitive search on name
      .limit(limit) // Apply limit
      .order('updated_at', { ascending: false }); // Optional: order by relevance or date

    if (error) {
      console.error('Error searching cases:', error);
      throw error;
    }

    const formattedCases = (data || []).map(c => ({
        id: c.id,
        name: c.name,
        description: c.description,
        status: c.status as 'active' | 'archived' | 'closed',
        createdAt: c.created_at,
        updatedAt: c.updated_at,
        documentCount: Array.isArray(c.documents) ? c.documents[0]?.count || 0 : 0,
        client_name: c.client_name,
        opposing_party: c.opposing_party,
        case_number: c.case_number,
        court: c.court,
    }));

    return { data: formattedCases, error: null };

  } catch (error) {
    console.error('Error in searchCasesByName:', error);
    return { data: null, error: error as Error };
  }
};

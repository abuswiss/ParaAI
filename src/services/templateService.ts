import { supabase } from '../lib/supabaseClient'; // Import supabase
import { openai } from '../lib/openaiClient';
import { v4 as uuidv4 } from 'uuid';
import { PostgrestError } from '@supabase/supabase-js';

/**
 * Interface for document template
 */
export interface DocumentTemplate {
  id: string;
  name: string;
  description: string;
  category: 'contract' | 'letter' | 'pleading' | 'memorandum' | 'agreement' | 'other';
  content: string;
  variables: string[];
  tags: string[]; // Added for basic filtering
  createdAt: string;
  updatedAt: string;
  isPublic: boolean;
  isFavorite?: boolean; // Optional flag for user favorites
  useCount?: number; // Number of times template has been used
  lastUsed?: string | null; // When the template was last used (allow null)
}

/**
 * Interface for draft document
 */
export interface DocumentDraft {
  id: string;
  name: string;
  templateId?: string; // undefined if not from template
  content: string;
  caseId?: string; // undefined if not associated
  createdAt: string;
  updatedAt: string;
  metadata?: Record<string, unknown>; // Use unknown instead of any
}

// Add interface for the raw data returned by Supabase for document_drafts
interface RawDocumentDraft {
    id: string;
    name: string;
    template_id: string | null;
    content: string;
    case_id: string | null;
    created_at: string;
    updated_at: string;
    user_id: string;
    metadata: Record<string, unknown> | null; // Match type and allow null
}

// Interface for raw template data from DB
interface RawDocumentTemplate {
    id: string;
    name: string;
    description: string | null;
    category: 'contract' | 'letter' | 'pleading' | 'memorandum' | 'agreement' | 'other';
    content: string;
    variables: string[] | null;
    tags: string[] | null;
    created_at: string;
    updated_at: string;
    is_public: boolean;
    is_favorite?: boolean | null; // From potential join
    use_count?: number | null;    // From potential join
    last_used?: string | null;     // From potential join
    user_id: string; // Standardized to user_id
}

// Interface for template usage history data
interface TemplateUsageHistory {
    user_id: string; // Added user_id based on usage in recordTemplateUsage
    template_id: string;
    used_at: string;
}

/**
 * Get all available templates for the current user
 */
export const getAvailableTemplates = async (
  category?: string
): Promise<{ data: DocumentTemplate[] | null; error: PostgrestError | Error | null }> => {
  try {
    const user = (await supabase.auth.getUser()).data.user;
    if (!user) throw new Error('User not authenticated');

    let query = supabase
      .from('document_templates')
      .select<string, RawDocumentTemplate>('*') // Specify Raw type
      .or(`is_public.eq.true,user_id.eq.${user.id}`);

    if (category) {
      // Explicitly cast the category string to the ENUM type
      query = query.eq('category', category as any); // Cast needed for Supabase client 
                                                   // The actual SQL will use the value directly
                                                   // Supabase should handle the cast if the type matches, 
                                                   // but let's re-evaluate if this doesn't work.
                                                   // A more explicit raw query might be needed if Supabase fails.
      // Alternative using raw filter if Supabase client struggles:
      // query = query.filter('category', 'eq', `${category}::template_category_enum`);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching templates:', error);
      return { data: null, error }; // Return PostgrestError
    }

    if (!data) {
        return { data: [], error: null }; // Handle no data case
    }

    // Transform the data to match our interface
    const templates: DocumentTemplate[] = data.map(transformTemplateData);

    return { data: templates, error: null };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error getting templates';
    console.error('Error getting templates:', message);
    const typedError = error instanceof PostgrestError ? error : error instanceof Error ? error : new Error(message);
    return { data: null, error: typedError };
  }
};

/**
 * Transform database template object to our interface
 */
const transformTemplateData = (data: RawDocumentTemplate): DocumentTemplate => {
  return {
    id: data.id,
    name: data.name,
    description: data.description || '', // Provide default
    category: data.category,
    content: data.content,
    variables: data.variables || [],
    tags: data.tags || [], 
    createdAt: data.created_at,
    updatedAt: data.updated_at,
    isPublic: data.is_public,
    isFavorite: data.is_favorite || false,
    useCount: data.use_count || 0,
    lastUsed: data.last_used || null // Keep null if db returns null
  };
};

/**
 * Get a template by ID
 */
export const getTemplateById = async (
  templateId: string
): Promise<{ data: DocumentTemplate | null; error: PostgrestError | Error | null }> => {
  try {
    const { data, error } = await supabase
      .from('document_templates')
      .select<string, RawDocumentTemplate>('*') // Specify Raw type
      .eq('id', templateId)
      .single();

    if (error) {
        console.error(`Error fetching template ${templateId}:`, error);
        return { data: null, error }; // Return PostgrestError
    }
    if (!data) {
        return { data: null, error: new Error('Template not found') };
    }

    return { data: transformTemplateData(data), error: null };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error getting template by ID';
    console.error('Error getting template:', message);
    const typedError = error instanceof PostgrestError ? error : error instanceof Error ? error : new Error(message);
    return { data: null, error: typedError };
  }
};

/**
 * Create a new template
 */
export const createTemplate = async (
  templateData: Omit<DocumentTemplate, 'id' | 'createdAt' | 'updatedAt'>
): Promise<{ data: DocumentTemplate | null; error: PostgrestError | Error | null }> => {
  try {
    const user = (await supabase.auth.getUser()).data.user;
    if (!user) {
      throw new Error('User not authenticated');
    }

    const templateId = uuidv4();
    const now = new Date().toISOString();

    // Prepare data for insertion matching RawDocumentTemplate structure where possible
    const dataToInsert = {
        id: templateId,
        name: templateData.name,
        description: templateData.description,
        category: templateData.category,
        content: templateData.content,
        variables: templateData.variables || [],
        tags: templateData.tags || [],
        created_at: now,
        updated_at: now,
        is_public: templateData.isPublic,
        user_id: user.id
      };

    const { data, error } = await supabase
      .from('document_templates')
      .insert(dataToInsert)
      .select<string, RawDocumentTemplate>('*') // Specify Raw type
      .single();

    if (error) {
      console.error('Error creating template:', error);
      return { data: null, error }; // Return PostgrestError
    }
    if (!data) {
        throw new Error("Failed to retrieve created template data.");
    }

    const template: DocumentTemplate = transformTemplateData(data);

    return { data: template, error: null };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error creating template';
    console.error('Error creating template:', message);
    const typedError = error instanceof PostgrestError ? error : error instanceof Error ? error : new Error(message);
    return { data: null, error: typedError };
  }
};

/**
 * Get recently used templates for the current user
 */
export const getRecentlyUsedTemplates = async (
  limit = 5
): Promise<{ data: DocumentTemplate[] | null; error: PostgrestError | Error | null }> => {
  try {
    const user = (await supabase.auth.getUser()).data.user;
    if (!user) {
      throw new Error('User not authenticated');
    }

    // Get recently used templates from usage history
    const { data: history, error: historyError } = await supabase
      .from('template_usage_history')
      .select<string, TemplateUsageHistory>('template_id, used_at') // Specify type
      .eq('user_id', user.id)
      .order('used_at', { ascending: false })
      .limit(limit);
    
    if (historyError) {
        console.error('Error fetching template usage history:', historyError);
        return { data: null, error: historyError }; // Return PostgrestError
    }
    
    if (!history || history.length === 0) return { data: [], error: null };
    
    // Get the actual templates
    const templateIds = history.map((h: TemplateUsageHistory) => h.template_id); // Add type for h
    const { data, error } = await supabase
      .from('document_templates')
      .select<string, RawDocumentTemplate>('*') // Specify Raw type
      .in('id', templateIds);
      
    if (error) {
        console.error('Error fetching recent templates:', error);
        return { data: null, error }; // Return PostgrestError
    }
    if (!data) {
        return { data: [], error: null }; // Handle no data
    }
    
    const templates: DocumentTemplate[] = data.map(transformTemplateData);
    
    // Sort templates based on recent usage history order
    templates.sort((a, b) => {
        const indexA = history.findIndex((h: TemplateUsageHistory) => h.template_id === a.id); // Add type for h
        const indexB = history.findIndex((h: TemplateUsageHistory) => h.template_id === b.id); // Add type for h
        return indexA - indexB;
    });

    return { data: templates, error: null };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error getting recent templates';
    console.error('Error getting recent templates:', message);
    const typedError = error instanceof PostgrestError ? error : error instanceof Error ? error : new Error(message);
    return { data: null, error: typedError };
  }
};

/**
 * Record template usage to track recently used templates
 */
export const recordTemplateUsage = async (
  templateId: string,
  caseId?: string
): Promise<{ success: boolean; error: PostgrestError | Error | null }> => {
  try {
    const user = (await supabase.auth.getUser()).data.user;
    if (!user) throw new Error('User not authenticated');

    const { error } = await supabase
      .from('template_usage_history')
      .insert({
        user_id: user.id,
        template_id: templateId,
        case_id: caseId || null,
        used_at: new Date().toISOString()
      });

    if (error) {
      console.error(`Error recording usage for template ${templateId}:`, error);
      return { success: false, error };
    }

    // Also increment use_count on the template itself (best effort)
    await supabase.rpc('increment_template_use_count', { template_id_param: templateId });

    return { success: true, error: null };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error recording template usage';
    console.error('Error recording template usage:', message);
    const typedError = error instanceof PostgrestError ? error : error instanceof Error ? error : new Error(message);
    return { success: false, error: typedError };
  }
};

/**
 * Import a template from JSON
 */
export const importTemplate = async (
  templateJson: string
): Promise<{ data: DocumentTemplate | null; error: Error | null }> => {
  try {
    const templateData = JSON.parse(templateJson) as Omit<DocumentTemplate, 'id' | 'createdAt' | 'updatedAt'>;
    // Basic validation could be added here
    if (!templateData.name || !templateData.content || !templateData.category) {
        throw new Error("Invalid template JSON structure.");
    }
    // Call createTemplate to handle insertion and user association
    return await createTemplate(templateData);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error importing template';
    console.error('Error importing template:', message);
    return { data: null, error: error instanceof Error ? error : new Error(message) };
  }
};

/**
 * Export a template to JSON
 */
export const exportTemplate = async (
  templateId: string
): Promise<{ data: string | null; error: PostgrestError | Error | null }> => {
  try {
    const { data, error } = await getTemplateById(templateId);
    if (error) throw error;
    if (!data) throw new Error('Template not found');

    // Omit fields not needed for export/import
    const exportData: Partial<DocumentTemplate> = { ...data };
    delete exportData.id;
    delete exportData.createdAt;
    delete exportData.updatedAt;
    delete exportData.isFavorite;
    delete exportData.useCount;
    delete exportData.lastUsed;

    return { data: JSON.stringify(exportData, null, 2), error: null };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error exporting template';
    console.error('Error exporting template:', message);
    const typedError = error instanceof PostgrestError ? error : error instanceof Error ? error : new Error(message);
    return { data: null, error: typedError };
  }
};

/**
 * Set a template as favorite for the current user
 */
export const setTemplateFavorite = async (
  templateId: string,
  isFavorite: boolean
): Promise<{ success: boolean; error: PostgrestError | Error | null }> => {
  try {
    const user = (await supabase.auth.getUser()).data.user;
    if (!user) throw new Error('User not authenticated');

    if (isFavorite) {
      // Use upsert to add to favorites - ignores if already exists
      const { error } = await supabase
        .from('user_favorite_templates')
        // Ensure the object matches the table structure
        .upsert({ user_id: user.id, template_id: templateId }); 
      if (error) {
        console.error("Error upserting favorite:", error);
        return { success: false, error };
      } 
    } else {
      // Remove from favorites
      const { error } = await supabase
        .from('user_favorite_templates')
        .delete()
        .match({ user_id: user.id, template_id: templateId });
      if (error) {
          // Don't treat "No rows found" as an error for delete
          if (error.code === 'PGRST116') { 
            console.warn("Tried to unfavorite a template that wasn't favorited.");
          } else {
            console.error("Error deleting favorite:", error);
            return { success: false, error };
          }
      }
    }
    return { success: true, error: null };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error setting favorite status';
    console.error('Error setting favorite status:', message);
    const typedError = error instanceof PostgrestError ? error : error instanceof Error ? error : new Error(message);
    return { success: false, error: typedError };
  }
};

interface CaseVariable {
    variable_name: string;
    variable_value: string;
}

export const getCaseVariables = async (
  caseId: string
): Promise<{ data: Record<string, string> | null; error: PostgrestError | Error | null }> => {
  try {
    const { data, error } = await supabase
      .from('template_case_variables')
      .select<string, CaseVariable>('variable_name, variable_value') // Specify type
      .eq('case_id', caseId);
    
    if (error) {
        console.error(`Error fetching case variables for ${caseId}:`, error);
        return { data: null, error }; // Return PostgrestError
    }
    if (!data) {
        return { data: {}, error: null }; // Return empty object if no vars
    }
    
    const variables = data.reduce((acc: Record<string, string>, v: CaseVariable) => { // Add types for acc and v
      acc[v.variable_name] = v.variable_value;
      return acc;
    }, {}); // Remove unnecessary type assertion
    
    return { data: variables, error: null };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error getting case variables';
    console.error('Error getting case variables:', message);
    const typedError = error instanceof PostgrestError ? error : error instanceof Error ? error : new Error(message);
    return { data: null, error: typedError };
  }
};

interface RawCaseDetails {
    id: string;
    name: string | null;
    description: string | null;
    case_number: string | null;
    case_type: string | null;
    status: 'active' | 'archived' | 'closed' | null;
    created_at: string;
    updated_at: string;
    court: string | null;
    jurisdiction: string | null;
    client_name: string | null;
    opposing_party: string | null;
    attorney_name: string | null;
}

export const getCaseFields = async (
  caseId: string
): Promise<{ data: Record<string, string> | null; error: PostgrestError | Error | null }> => {
  try {
    // Fetch case data from the cases table
    const { data: caseData, error: caseError } = await supabase
      .from('cases')
      .select<string, RawCaseDetails>('*') // Specify Raw type
      .eq('id', caseId)
      .single();
    
    if (caseError) {
        console.error(`Error fetching case details for ${caseId}:`, caseError);
        return { data: null, error: caseError }; // Return PostgrestError
    }
    if (!caseData) throw new Error('Case not found');
    
    // Format date fields for better readability
    const createdDate = new Date(caseData.created_at).toLocaleDateString();
    const updatedDate = new Date(caseData.updated_at).toLocaleDateString();
    
    // Create a standard set of case fields for templates
    const caseFields: Record<string, string> = {
      case_name: caseData.name || '',
      case_number: caseData.case_number || '',
      case_type: caseData.case_type || '',
      case_status: caseData.status || '',
      case_created_date: createdDate,
      case_updated_date: updatedDate,
      case_description: caseData.description || '',
      case_court: caseData.court || '',
      case_jurisdiction: caseData.jurisdiction || '',
      client_name: caseData.client_name || '',
      opposing_party: caseData.opposing_party || '',
      attorney_name: caseData.attorney_name || ''
    };
    
    // Also fetch any custom variables stored for this case
    const { data: customVars, error: varsError } = await getCaseVariables(caseId);
    if (varsError) {
      console.warn(`Could not fetch custom variables for case ${caseId}:`, varsError);
    }
    
    // Combine standard fields with custom variables (custom vars take precedence)
    const combinedFields = {
      ...caseFields,
      ...(customVars || {})
    };
    
    return { data: combinedFields, error: null };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error getting case fields';
    console.error('Error getting case fields:', message);
    const typedError = error instanceof PostgrestError ? error : error instanceof Error ? error : new Error(message);
    return { data: null, error: typedError };
  }
};

/**
 * Create a draft from a template
 */
export const createDraftFromTemplate = async (
  templateId: string,
  name: string,
  variableValues: Record<string, string>,
  caseId?: string
): Promise<{ data: DocumentDraft | null; error: Error | null }> => {
  try {
    // Get the template
    const { data: template, error: templateError } = await getTemplateById(templateId);

    if (templateError || !template) {
      throw templateError || new Error('Template not found');
    }

    // Replace variables in the template content
    let content = template.content;
    
    for (const variable of template.variables) {
      const value = variableValues[variable] || `[${variable}]`;
      content = content.replace(new RegExp(`\\{\\{${variable}\\}\\}`, 'g'), value);
    }

    // Create the draft
    const user = (await supabase.auth.getUser()).data.user;
    
    if (!user) {
      throw new Error('User not authenticated');
    }

    const draftId = uuidv4();
    const now = new Date().toISOString();

    const { data, error } = await supabase
      .from('document_drafts')
      .insert({
        id: draftId,
        name,
        template_id: templateId,
        content,
        case_id: caseId,
        created_at: now,
        updated_at: now,
        user_id: user.id
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    const draft: DocumentDraft = {
      id: data.id,
      name: data.name,
      templateId: data.template_id,
      content: data.content,
      caseId: data.case_id,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
      metadata: data.metadata
    };

    return { data: draft, error: null };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error creating draft from template';
    console.error('Error creating draft from template:', message);
    return { data: null, error: error instanceof Error ? error : new Error(message) };
  }
};

/**
 * Get all drafts for the current user
 */
export const getUserDrafts = async (
  caseId?: string
): Promise<{ data: DocumentDraft[] | null; error: Error | null }> => {
  try {
    const user = (await supabase.auth.getUser()).data.user;
    
    if (!user) {
      throw new Error('User not authenticated');
    }

    let query = supabase
      .from('document_drafts')
      .select('*')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false });

    if (caseId) {
      query = query.eq('case_id', caseId);
    }

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    // Transform the data to match our interface
    const drafts: DocumentDraft[] = data.map((item: RawDocumentDraft) => ({ // Add type for item
      id: item.id,
      name: item.name,
      templateId: item.template_id ?? undefined,
      content: item.content,
      caseId: item.case_id ?? undefined,
      createdAt: item.created_at,
      updatedAt: item.updated_at,
      metadata: item.metadata ?? undefined
    }));

    return { data: drafts, error: null };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error getting user drafts';
    console.error('Error getting user drafts:', message);
    return { data: null, error: error instanceof Error ? error : new Error(message) };
  }
};

/**
 * Get a draft by ID
 */
export const getDraftById = async (
  draftId: string
): Promise<{ data: DocumentDraft | null; error: Error | null }> => {
  try {
    const { data, error } = await supabase
      .from('document_drafts')
      .select('*')
      .eq('id', draftId)
      .single();

    if (error) {
      throw error;
    }

    const draft: DocumentDraft = {
      id: data.id,
      name: data.name,
      templateId: data.template_id,
      content: data.content,
      caseId: data.case_id,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
      metadata: data.metadata
    };

    return { data: draft, error: null };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error getting draft by ID';
    console.error('Error getting draft:', message);
    return { data: null, error: error instanceof Error ? error : new Error(message) };
  }
};

/**
 * Update a draft
 */
export const updateDraft = async (
  draftId: string,
  updates: Partial<Omit<DocumentDraft, 'id' | 'createdAt' | 'updatedAt' | 'templateId'>> 
): Promise<{ success: boolean; error: PostgrestError | Error | null }> => {
  try {
    const dbUpdates: Partial<RawDocumentDraft> = {
        name: updates.name,
        content: updates.content,
        case_id: updates.caseId,
        metadata: updates.metadata,
        updated_at: new Date().toISOString(),
    };
    Object.keys(dbUpdates).forEach(key => dbUpdates[key as keyof typeof dbUpdates] === undefined && delete dbUpdates[key as keyof typeof dbUpdates]);

    const { error } = await supabase
      .from('document_drafts')
      .update(dbUpdates)
      .eq('id', draftId);

    if (error) {
      console.error(`Error updating draft ${draftId}:`, error);
      return { success: false, error };
    }

    return { success: true, error: null };
  } catch (error: unknown) { // Fix any type here
    const message = error instanceof Error ? error.message : 'Unknown error updating draft';
    console.error('Error updating draft:', message);
    const typedError = error instanceof PostgrestError ? error : error instanceof Error ? error : new Error(message);
    return { success: false, error: typedError };
  }
};

/**
 * Delete a draft
 */
export const deleteDraft = async (
  draftId: string
): Promise<{ success: boolean; error: Error | null }> => {
  try {
    const { error } = await supabase
      .from('document_drafts')
      .delete()
      .eq('id', draftId);

    if (error) {
      throw error;
    }

    return { success: true, error: null };
  } catch (error) {
    console.error('Error deleting draft:', error);
    return { success: false, error: error as Error };
  }
};

/**
 * Create a new AI-generated draft (not from a template)
 */
export const createAIDraft = async (
  name: string,
  content: string,
  caseId?: string,
  metadata?: Record<string, unknown>
): Promise<{ data: DocumentDraft | null; error: PostgrestError | Error | null }> => {
  try {
    const user = (await supabase.auth.getUser()).data.user;
    if (!user) {
      throw new Error('User not authenticated');
    }
    const draftId = uuidv4();
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from('document_drafts')
      .insert({
        id: draftId,
        name,
        content,
        case_id: caseId || null,
        created_at: now,
        updated_at: now,
        user_id: user.id,
        metadata: metadata || null,
        template_id: null
      })
      .select<string, RawDocumentDraft>('*')
      .single();

    if (error) {
      console.error('Error creating AI draft:', error);
      return { data: null, error };
    }
    if (!data) {
        throw new Error('Failed to retrieve created AI draft data.');
    }
    const draft: DocumentDraft = {
      id: data.id,
      name: data.name,
      content: data.content,
      caseId: data.case_id ?? undefined,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
      templateId: data.template_id ?? undefined,
      metadata: data.metadata ?? undefined
    };
    return { data: draft, error: null };
  } catch (error: unknown) { // Fix any type here
    console.error('Error creating AI draft:', error);
    const typedError = error instanceof PostgrestError ? error : error instanceof Error ? error : new Error('Unknown error creating AI draft');
    return { data: null, error: typedError };
  }
};

/**
 * Create an empty draft document (not from a template)
 */
export const createBlankDraft = async (
  caseId?: string | null // Optional case ID to associate with
): Promise<{ data: DocumentDraft | null; error: PostgrestError | Error | null }> => { // Use specific error type
  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser(); // Destructure user and error
    if (authError) {
        console.error('Auth error in createBlankDraft:', authError);
        return { data: null, error: new Error('Authentication failed') };
    }
    if (!user) {
      // Use return instead of throw for consistent error handling
      return { data: null, error: new Error('User not authenticated') };
    }

    const draftId = uuidv4();
    const now = new Date().toISOString();
    const defaultName = "Untitled Draft";
    const defaultContent = "<p></p>"; // Tiptap requires a paragraph tag

    console.log(`Creating blank draft with ID: ${draftId}, associated with case: ${caseId || 'None'}`);

    // Use RawDocumentDraft for the select type parameter
    const { data, error } = await supabase
      .from('document_drafts')
      .insert({
        id: draftId,
        name: defaultName,
        template_id: null, 
        content: defaultContent,
        case_id: caseId || null,
        created_at: now,
        updated_at: now,
        user_id: user.id,
        metadata: { createdAs: 'blank' } // Re-added metadata field
      })
      .select<string, RawDocumentDraft>('*') // Specify select type
      .single();

    if (error) {
      console.error("Error inserting blank draft (Supabase client error):", error); // Log Supabase client error specifically
      return { data: null, error }; 
    }
    
    if (!data) { 
        console.error("Failed to retrieve created blank draft data after insert.");
        return { data: null, error: new Error("Failed to retrieve created blank draft data.") };
    }

    // Map Supabase result to DocumentDraft interface, handling nulls
    const draft: DocumentDraft = {
      id: data.id,
      name: data.name,
      templateId: data.template_id ?? undefined, // Map null to undefined
      content: data.content,
      caseId: data.case_id ?? undefined, // Map null to undefined
      createdAt: data.created_at,
      updatedAt: data.updated_at,
      metadata: data.metadata ?? undefined // Map null to undefined
    };

    console.log("Blank draft created successfully:", draft);
    return { data: draft, error: null };

  } catch (err) {
    // Log the entire error object for detailed debugging
    console.error('Detailed error in createBlankDraft catch block:', err); 
    // Optionally, stringify if the object might be complex or not log well directly
    try {
        console.error('Stringified error:', JSON.stringify(err, null, 2));
    } catch (stringifyError) {
        // Log the stringify error itself
        console.error('Could not stringify error object:', stringifyError);
    }
    
    // Maintain existing error handling structure
    const error = err instanceof PostgrestError ? err : err instanceof Error ? err : new Error('Unknown error creating blank draft');
    return { data: null, error };
  }
};

/**
 * Delete a template by ID
 */
export const deleteTemplate = async (
  templateId: string
): Promise<{ success: boolean; error: PostgrestError | Error | null }> => {
  try {
    const user = (await supabase.auth.getUser()).data.user;
    if (!user) {
      throw new Error('User not authenticated');
    }

    // Add authorization check: Only creator or maybe admin should delete?
    // For now, we allow deletion if the user is authenticated.

    const { error } = await supabase
      .from('document_templates')
      .delete()
      .eq('id', templateId);
      // Optional: Add .eq('creator_id', user.id) to restrict deletion to the creator

    if (error) {
      // Handle specific errors like 'template not found' if needed
      console.error(`Error deleting template ${templateId}:`, error);
      return { success: false, error };
    }

    // Optionally, clean up related data like favorites or usage history

    console.log(`Template ${templateId} deleted successfully.`);
    return { success: true, error: null };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error deleting template';
    console.error('Error deleting template:', message);
    const typedError = error instanceof PostgrestError ? error : error instanceof Error ? error : new Error(message);
    return { success: false, error: typedError };
  }
};

/**
 * Duplicate a template by ID
 */
export const duplicateTemplate = async (
  templateId: string
): Promise<{ data: DocumentTemplate | null; error: PostgrestError | Error | null }> => {
  try {
    const { data: originalTemplate, error: fetchError } = await getTemplateById(templateId);

    if (fetchError || !originalTemplate) {
      console.error(`Error fetching template ${templateId} for duplication:`, fetchError);
      return { data: null, error: fetchError || new Error('Original template not found') };
    }

    // Prepare data for the new template
    const newTemplateData: Omit<DocumentTemplate, 'id' | 'createdAt' | 'updatedAt'> = {
      ...originalTemplate,
      name: `${originalTemplate.name} (Copy)`, // Append (Copy) to the name
      isPublic: false, // Duplicates should probably default to private
      // Reset usage stats if needed
      isFavorite: false,
      useCount: 0,
      lastUsed: null,
    };

    // Use the createTemplate function to insert the new duplicate
    const { data: newTemplate, error: createError } = await createTemplate(newTemplateData);

    if (createError) {
      console.error('Error creating duplicate template:', createError);
      return { data: null, error: createError };
    }

    console.log(`Template ${templateId} duplicated successfully as ${newTemplate?.id}`);
    return { data: newTemplate, error: null };

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error duplicating template';
    console.error('Error duplicating template:', message);
    const typedError = error instanceof PostgrestError ? error : error instanceof Error ? error : new Error(message);
    return { data: null, error: typedError };
  }
};

/**
 * Update an existing template
 */
export const updateTemplate = async (
  templateId: string,
  // Use Partial<Omit<...>> for flexibility, allowing update of only some fields
  templateData: Partial<Omit<DocumentTemplate, 'id' | 'createdAt' | 'updatedAt'>> 
): Promise<{ data: DocumentTemplate | null; error: PostgrestError | Error | null }> => {
  try {
    const user = (await supabase.auth.getUser()).data.user;
    if (!user) {
      throw new Error('User not authenticated');
    }

    const now = new Date().toISOString();

    // Prepare data for update, matching DB column names
    // Use a more specific type based on RawDocumentTemplate + updated_at
    const dataToUpdate: Partial<Omit<RawDocumentTemplate, 'id' | 'created_at' | 'user_id'> & { updated_at: string }> = {
      name: templateData.name,
      description: templateData.description,
      category: templateData.category,
      content: templateData.content,
      variables: templateData.variables,
      tags: templateData.tags,
      is_public: templateData.isPublic,
      updated_at: now,
    };

    // Remove undefined keys to avoid overwriting existing values with null
    // Type assertion needed here due to the way keys are iterated
    Object.keys(dataToUpdate).forEach(key => dataToUpdate[key as keyof typeof dataToUpdate] === undefined && delete dataToUpdate[key as keyof typeof dataToUpdate]);

    // Add authorization check: Ensure user is the creator?
    // For now, we allow updates if authenticated.
    const { data, error } = await supabase
      .from('document_templates')
      .update(dataToUpdate)
      .eq('id', templateId)
      // Optional: .eq('creator_id', user.id) // Uncomment to restrict updates to creator
      .select<string, RawDocumentTemplate>('*') // Reselect the updated data
      .single();

    if (error) {
      console.error(`Error updating template ${templateId}:`, error);
      return { data: null, error };
    }
    if (!data) {
        throw new Error("Failed to retrieve updated template data.");
    }

    const updatedTemplate = transformTemplateData(data);
    console.log(`Template ${templateId} updated successfully.`);
    return { data: updatedTemplate, error: null };

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error updating template';
    console.error('Error updating template:', message);
    const typedError = error instanceof PostgrestError ? error : error instanceof Error ? error : new Error(message);
    return { data: null, error: typedError };
  }
};

/**
 * Invokes the Supabase edge function to generate a template from AI instructions,
 * which also saves it to the database.
 * @param instructions User's instructions for the template.
 * @param category Category for the new template.
 * @param name (Optional) User-suggested name for the template.
 * @param description (Optional) User-suggested description.
 * @returns The ID of the newly created template.
 */
export const generateAndSaveAITemplate = async (
  instructions: string,
  category: DocumentTemplate['category'],
  name?: string, // Optional: Can be passed to edge function or used for update later
  description?: string // Optional
): Promise<{ data: { id: string; name: string } | null; error: Error | null }> => {
  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      console.error('User not authenticated for AI template generation:', authError?.message);
      throw new Error('User not authenticated.'); 
    }

    console.log(`Invoking 'create-template-from-ai' edge function...`);
    const { data: functionData, error: functionError } = await supabase.functions.invoke(
      'create-template-from-ai',
      {
        body: { 
          instructions,
          category,
          userId: user.id,
          suggestedName: name, // Pass optional name
          suggestedDescription: description // Pass optional description
        },
      }
    );

    if (functionError) {
      console.error('Error invoking create-template-from-ai function:', functionError.message);
      throw new Error(`AI template creation failed: ${functionError.message}`);
    }

    if (!functionData || !functionData.success || !functionData.templateId) {
      console.error('Invalid response from AI template creation function:', functionData);
      throw new Error(functionData?.error || 'AI template creation returned invalid data or failed.');
    }
    
    // The edge function now also returns the templateName it decided on/saved.
    const templateName = functionData.templateName || 'AI Generated Template';

    console.log(`AI Template created and saved with ID: ${functionData.templateId}, Name: ${templateName}`);
    return { data: { id: functionData.templateId, name: templateName }, error: null };

  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error during AI template creation';
    console.error('Error in generateAndSaveAITemplate:', message);
    return { data: null, error: error instanceof Error ? error : new Error(message) };
  }
};

/**
 * Search templates by name or description for the current user.
 */
export const searchTemplatesByName = async (
  query: string,
  limit: number = 10
): Promise<{ data: DocumentTemplate[] | null; error: PostgrestError | Error | null }> => {
  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      throw authError || new Error('User not authenticated');
    }

    const searchPattern = `%${query}%`;

    const { data, error } = await supabase
      .from('document_templates')
      .select<string, RawDocumentTemplate>('*')
      .or(`is_public.eq.true,user_id.eq.${user.id}`) // User can see public or their own
      // Search in name OR description
      .or(`name.ilike.${searchPattern},description.ilike.${searchPattern}`)
      .limit(limit)
      .order('updated_at', { ascending: false });

    if (error) {
      console.error('Error searching templates:', error);
      return { data: null, error };
    }

    if (!data) {
      return { data: [], error: null };
    }

    const templates: DocumentTemplate[] = data.map(transformTemplateData);
    return { data: templates, error: null };

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error searching templates';
    console.error('Error searching templates:', message);
    const typedError = error instanceof PostgrestError ? error : error instanceof Error ? error : new Error(message);
    return { data: null, error: typedError };
  }
};

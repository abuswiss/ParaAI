import { supabase } from '../lib/supabaseClient';
import { openai } from '../lib/openaiClient';
import { v4 as uuidv4 } from 'uuid';

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
  lastUsed?: string; // When the template was last used
}

/**
 * Interface for draft document
 */
export interface DocumentDraft {
  id: string;
  name: string;
  templateId?: string;
  content: string;
  caseId?: string;
  createdAt: string;
  updatedAt: string;
  metadata?: Record<string, any>;
}

/**
 * Get all available templates for the current user
 */
export const getAvailableTemplates = async (
  category?: string
): Promise<{ data: DocumentTemplate[] | null; error: Error | null }> => {
  try {
    let query = supabase
      .from('document_templates')
      .select('*')
      .or(`is_public.eq.true,creator_id.eq.${(await supabase.auth.getUser()).data.user?.id}`);

    if (category) {
      query = query.eq('category', category);
    }

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    // Transform the data to match our interface
    const templates: DocumentTemplate[] = data.map(transformTemplateData);

    return { data: templates, error: null };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error getting templates';
    console.error('Error getting templates:', message);
    return { data: null, error: error instanceof Error ? error : new Error(message) };
  }
};

/**
 * Transform database template object to our interface
 */
const transformTemplateData = (data: any): DocumentTemplate => {
  return {
    id: data.id,
    name: data.name,
    description: data.description,
    category: data.category,
    content: data.content,
    variables: data.variables || [],
    tags: data.tags || [], // Added for basic filtering
    createdAt: data.created_at,
    updatedAt: data.updated_at,
    isPublic: data.is_public,
    isFavorite: data.is_favorite || false,
    useCount: data.use_count || 0,
    lastUsed: data.last_used || null
  };
};

/**
 * Get a template by ID
 */
export const getTemplateById = async (
  templateId: string
): Promise<{ data: DocumentTemplate | null; error: Error | null }> => {
  try {
    const { data, error } = await supabase
      .from('document_templates')
      .select('*')
      .eq('id', templateId)
      .single();

    if (error) {
      throw error;
    }

    return { data: transformTemplateData(data), error: null };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error getting template by ID';
    console.error('Error getting template:', message);
    return { data: null, error: error instanceof Error ? error : new Error(message) };
  }
};

/**
 * Create a new template
 */
export const createTemplate = async (
  templateData: Omit<DocumentTemplate, 'id' | 'createdAt' | 'updatedAt'>
): Promise<{ data: DocumentTemplate | null; error: Error | null }> => {
  try {
    const user = (await supabase.auth.getUser()).data.user;
    
    if (!user) {
      throw new Error('User not authenticated');
    }

    const templateId = uuidv4();
    const now = new Date().toISOString();

    const { data, error } = await supabase
      .from('document_templates')
      .insert({
        id: templateId,
        name: templateData.name,
        description: templateData.description,
        category: templateData.category,
        content: templateData.content,
        variables: templateData.variables || [],
        created_at: now,
        updated_at: now,
        is_public: templateData.isPublic,
        creator_id: user.id
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    const template: DocumentTemplate = {
      id: data.id,
      name: data.name,
      description: data.description,
      category: data.category,
      content: data.content,
      variables: data.variables || [],
      tags: data.tags || [], // Added for basic filtering
      createdAt: data.created_at,
      updatedAt: data.updated_at,
      isPublic: data.is_public,
      isFavorite: data.is_favorite || false
    };

    return { data: template, error: null };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error creating template';
    console.error('Error creating template:', message);
    return { data: null, error: error instanceof Error ? error : new Error(message) };
  }
};

/**
 * Get recently used templates for the current user
 */
export const getRecentlyUsedTemplates = async (
  limit = 5
): Promise<{ data: DocumentTemplate[] | null; error: Error | null }> => {
  try {
    const user = (await supabase.auth.getUser()).data.user;
    
    if (!user) {
      throw new Error('User not authenticated');
    }

    // Get recently used templates from usage history
    const { data: history, error: historyError } = await supabase
      .from('template_usage_history')
      .select('template_id, used_at')
      .eq('user_id', user.id)
      .order('used_at', { ascending: false })
      .limit(limit);
    
    if (historyError) throw historyError;
    
    if (!history || history.length === 0) return { data: [], error: null };
    
    // Get the actual templates
    const templateIds = history.map(h => h.template_id);
    const { data, error } = await supabase
      .from('document_templates')
      .select('*')
      .in('id', templateIds);
    
    if (error) throw error;
    
    // Sort templates in the same order as the history
    const templatesMap = data.reduce((acc, template) => {
      acc[template.id] = template;
      return acc;
    }, {} as Record<string, any>);
    
    const sortedTemplates = templateIds
      .map(id => templatesMap[id])
      .filter(Boolean);
    
    return { 
      data: sortedTemplates.map(transformTemplateData),
      error: null 
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error getting recently used templates';
    console.error('Error getting recently used templates:', message);
    return { data: null, error: error instanceof Error ? error : new Error(message) };
  }
};

/**
 * Record template usage to track recently used templates
 */
export const recordTemplateUsage = async (
  templateId: string,
  caseId?: string
): Promise<{ success: boolean; error: Error | null }> => {
  try {
    const user = (await supabase.auth.getUser()).data.user;
    
    if (!user) {
      throw new Error('User not authenticated');
    }

    const usageId = uuidv4();
    const now = new Date().toISOString();

    // Record usage in history table
    const { error: historyError } = await supabase
      .from('template_usage_history')
      .insert({
        id: usageId,
        user_id: user.id,
        template_id: templateId,
        used_at: now,
        case_id: caseId
      });

    if (historyError) throw historyError;

    // Update template usage count and last used date
    const { error: templateError } = await supabase
      .from('document_templates')
      .update({
        use_count: supabase.rpc('increment', { row_id: templateId, table: 'document_templates', column: 'use_count' }),
        last_used: now
      })
      .eq('id', templateId);

    if (templateError) throw templateError;

    return { success: true, error: null };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error recording template usage';
    console.error('Error recording template usage:', message);
    return { success: false, error: error instanceof Error ? error : new Error(message) };
  }
};

/**
 * Import a template from JSON
 */
export const importTemplate = async (
  templateJson: string
): Promise<{ data: DocumentTemplate | null; error: Error | null }> => {
  try {
    const parsedData = JSON.parse(templateJson);
    
    // Validate the template data
    const requiredFields = ['name', 'description', 'category', 'content'];
    for (const field of requiredFields) {
      if (!parsedData[field]) {
        throw new Error(`Missing required field: ${field}`);
      }
    }

    // Create a new template from the imported data
    const templateData: Omit<DocumentTemplate, 'id' | 'createdAt' | 'updatedAt'> = {
      name: parsedData.name,
      description: parsedData.description,
      category: parsedData.category,
      content: parsedData.content,
      variables: parsedData.variables || [],
      tags: parsedData.tags || [],
      isPublic: false // Default to private for imported templates
    };

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
): Promise<{ data: string | null; error: Error | null }> => {
  try {
    const { data, error } = await getTemplateById(templateId);
    
    if (error) throw error;
    if (!data) throw new Error('Template not found');
    
    // Create a clean version without internal fields
    const exportData = {
      name: data.name,
      description: data.description,
      category: data.category,
      content: data.content,
      variables: data.variables,
      tags: data.tags
    };
    
    return { data: JSON.stringify(exportData, null, 2), error: null };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error exporting template';
    console.error('Error exporting template:', message);
    return { data: null, error: error instanceof Error ? error : new Error(message) };
  }
};

/**
 * Set a template as favorite for the current user
 */
export const setTemplateFavorite = async (
  templateId: string,
  isFavorite: boolean
): Promise<{ success: boolean; error: Error | null }> => {
  try {
    const user = (await supabase.auth.getUser()).data.user;
    
    if (!user) {
      throw new Error('User not authenticated');
    }

    if (isFavorite) {
      // Add to favorites
      const { error } = await supabase
        .from('user_template_favorites')
        .upsert({
          user_id: user.id,
          template_id: templateId,
          created_at: new Date().toISOString()
        });

      if (error) throw error;
    } else {
      // Remove from favorites
      const { error } = await supabase
        .from('user_template_favorites')
        .delete()
        .eq('user_id', user.id)
        .eq('template_id', templateId);

      if (error) throw error;
    }

    return { success: true, error: null };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error setting template favorite status';
    console.error('Error setting favorite status:', message);
    return { success: false, error: error instanceof Error ? error : new Error(message) };
  }
};

/**
 * Get variable values for a case
 */
export const getCaseVariables = async (
  caseId: string
): Promise<{ data: Record<string, string> | null; error: Error | null }> => {
  try {
    const { data, error } = await supabase
      .from('template_case_variables')
      .select('variable_name, variable_value')
      .eq('case_id', caseId);
    
    if (error) throw error;
    
    const variables = data.reduce((acc, v) => {
      acc[v.variable_name] = v.variable_value;
      return acc;
    }, {} as Record<string, string>);
    
    return { data: variables, error: null };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error getting case variables';
    console.error('Error getting case variables:', message);
    return { data: null, error: error instanceof Error ? error : new Error(message) };
  }
};

/**
 * Get standard case fields for variable replacement
 */
export const getCaseFields = async (
  caseId: string
): Promise<{ data: Record<string, string> | null; error: Error | null }> => {
  try {
    // Fetch case data from the cases table
    const { data: caseData, error: caseError } = await supabase
      .from('cases')
      .select('*')
      .eq('id', caseId)
      .single();
    
    if (caseError) throw caseError;
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
    const { data: customVars } = await getCaseVariables(caseId);
    
    // Combine standard fields with custom variables (custom vars take precedence)
    const combinedFields = {
      ...caseFields,
      ...(customVars || {})
    };
    
    return { data: combinedFields, error: null };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error getting case fields';
    console.error('Error getting case fields:', message);
    return { data: null, error: error instanceof Error ? error : new Error(message) };
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
 * Generate a draft using AI based on document context and requirements
 */
export const generateDraftWithAI = async (
  requirements: string,
  documentContext?: string,
  category?: string
): Promise<{ data: string | null; error: Error | null }> => {
  try {
    // Create a system prompt based on the category
    let systemPrompt = 'You are a legal document drafting assistant. Create professional, well-structured legal documents.';
    
    if (category) {
      systemPrompt += ` Focus on creating ${category} documents that follow standard legal conventions.`;
    }

    // Create a user prompt with the requirements and context
    let userPrompt = `Draft a legal document based on the following requirements:\n\n${requirements}`;
    
    if (documentContext) {
      userPrompt += `\n\nThis document should be based on the following context:\n\n${documentContext}`;
    }

    // Call the OpenAI API to generate the draft
    const response = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.1, // Lower temperature for more formal/structured output
      max_tokens: 2000,
    });

    return { data: response.choices[0]?.message.content || null, error: null };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error generating draft with AI';
    console.error('Error generating draft with AI:', message);
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
    const drafts: DocumentDraft[] = data.map((item) => ({
      id: item.id,
      name: item.name,
      templateId: item.template_id,
      content: item.content,
      caseId: item.case_id,
      createdAt: item.created_at,
      updatedAt: item.updated_at,
      metadata: item.metadata
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
  updates: Partial<Omit<DocumentDraft, 'id' | 'createdAt' | 'updatedAt'>>
): Promise<{ success: boolean; error: Error | null }> => {
  try {
    const updatedData: Record<string, any> = {
      updated_at: new Date().toISOString()
    };

    if (updates.name) updatedData.name = updates.name;
    if (updates.content) updatedData.content = updates.content;
    if (updates.caseId) updatedData.case_id = updates.caseId;
    if (updates.metadata) updatedData.metadata = updates.metadata;

    const { error } = await supabase
      .from('document_drafts')
      .update(updatedData)
      .eq('id', draftId);

    if (error) {
      throw error;
    }

    return { success: true, error: null };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error updating draft';
    console.error('Error updating draft:', message);
    return { success: false, error: error instanceof Error ? error : new Error(message) };
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
  metadata?: Record<string, any>
): Promise<{ data: DocumentDraft | null; error: Error | null }> => {
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
        case_id: caseId,
        created_at: now,
        updated_at: now,
        user_id: user.id,
        metadata: metadata || null
      })
      .select()
      .single();
    if (error) {
      throw error;
    }
    const draft: DocumentDraft = {
      id: data.id,
      name: data.name,
      content: data.content,
      caseId: data.case_id,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
      templateId: data.template_id,
      metadata: data.metadata
    };
    return { data: draft, error: null };
  } catch (error) {
    console.error('Error creating AI draft:', error);
    return { data: null, error: error as Error };
  }
};

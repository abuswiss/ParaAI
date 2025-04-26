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
  createdAt: string;
  updatedAt: string;
  isPublic: boolean;
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
    const templates: DocumentTemplate[] = data.map((item) => ({
      id: item.id,
      name: item.name,
      description: item.description,
      category: item.category,
      content: item.content,
      variables: item.variables,
      createdAt: item.created_at,
      updatedAt: item.updated_at,
      isPublic: item.is_public
    }));

    return { data: templates, error: null };
  } catch (error) {
    console.error('Error getting templates:', error);
    return { data: null, error: error as Error };
  }
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

    const template: DocumentTemplate = {
      id: data.id,
      name: data.name,
      description: data.description,
      category: data.category,
      content: data.content,
      variables: data.variables,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
      isPublic: data.is_public
    };

    return { data: template, error: null };
  } catch (error) {
    console.error('Error getting template:', error);
    return { data: null, error: error as Error };
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
      variables: data.variables,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
      isPublic: data.is_public
    };

    return { data: template, error: null };
  } catch (error) {
    console.error('Error creating template:', error);
    return { data: null, error: error as Error };
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
  } catch (error) {
    console.error('Error creating draft from template:', error);
    return { data: null, error: error as Error };
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
  } catch (error) {
    console.error('Error generating draft with AI:', error);
    return { data: null, error: error as Error };
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
  } catch (error) {
    console.error('Error getting drafts:', error);
    return { data: null, error: error as Error };
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
  } catch (error) {
    console.error('Error getting draft:', error);
    return { data: null, error: error as Error };
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
  } catch (error) {
    console.error('Error updating draft:', error);
    return { success: false, error: error as Error };
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

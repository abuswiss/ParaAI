import { Task } from './commandParser';
import { handleResearchQueryStream, sendMessageStream, handleAgentDraftStream, handleFindClauseStream, handleGenerateTimelineStream, handleExplainTermStream, handleAgentCompareStream, handleFlagPrivilegedTermsStream, handlePerplexityAgent, handleCaseSearch } from '../services/chatService';
import { analyzeDocument } from '../services/documentAnalysisService';
import * as templateService from '../services/templateService';

// Define interface for Perplexity sources (should match ChatInterface)
interface PerplexitySource {
  url: string;
  title: string;
  snippet: string;
}

// Define a specific return type for dispatcher actions
export type DispatcherResponse = {
  success: boolean;
  error?: Error | null;
  action?: 'show_template_modal'; // Action identifier for UI
  templateId?: string; // Data needed for the action
  newConversationId?: string; // For standard message stream responses
  sources?: PerplexitySource[]; // Use specific type
  // Add other potential action types and data as needed
};

// Define type for the params object
interface DispatcherParams {
  wsContext?: (chunk: string) => void; // Define known properties
  // Add other potential params here if needed
}

// Main dispatcher for user input
export async function handleUserTurn({
  task,
  message,
  onChunk,
  conversationId,
  caseId,
  documentContext,
  analysisContext,
  params
}: {
  task: Task;
  message: string;
  onChunk: (chunk: string) => void;
  conversationId?: string;
  caseId?: string;
  documentContext?: string | string[];
  analysisContext?: string;
  params: DispatcherParams; // Apply the type
}): Promise<DispatcherResponse> {
  console.log("Dispatcher received task:", task, "with caseId:", caseId);

  const docCtx = Array.isArray(documentContext) ? documentContext[0] : documentContext;

  // Handle /use template command
  if (task?.type === 'use_template') {
    try {
      const { data: templates, error: fetchError } = await templateService.getAvailableTemplates();
      if (fetchError) throw fetchError;

      // Find template by name (case-insensitive)
      const foundTemplate = templates?.find(t => t.name.toLowerCase() === task.templateName.toLowerCase());

      if (foundTemplate) {
        console.log(`Template found: ${foundTemplate.name} (ID: ${foundTemplate.id})`);
        // Return action to show modal
        return { success: true, action: 'show_template_modal', templateId: foundTemplate.id };
      } else {
        const errorMessage = `Template "${task.templateName}" not found.`;
        onChunk(errorMessage);
        return { success: false, error: new Error(errorMessage) };
      }
    } catch (error) {
      console.error("Error handling use_template task:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to process template command.";
      onChunk(`Error: ${errorMessage}`);
      return { success: false, error: error instanceof Error ? error : new Error(errorMessage) };
    }
  }

  // Handle /research command
  if (task?.type === 'research') {
    // Route to RAG handler (pass caseId if relevant later)
    try {
      return await handleResearchQueryStream(task.query, onChunk);
    } catch (error) {
      onChunk(`Error during research: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return { success: false, error: error instanceof Error ? error : new Error('Research failed') };
    }
  }

  // Handle /search command
  if (task?.type === 'case_search') {
    if (!caseId) {
      onChunk('Error: No active case selected. Please select a case to search documents.');
      return { success: false, error: new Error('No active case ID for case search') };
    }
    try {
      // Call the new handler function
      return await handleCaseSearch(caseId, task.query, onChunk);
    } catch (error) {
      onChunk(`Error during case search: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return { success: false, error: error instanceof Error ? error : new Error('Case search failed') };
    }
  }

  // Handle /agent commands
  if (task?.type === 'agent') {
    if (task.agent === 'compare') {
      // Pass the array of document contexts directly for compare agent
      return await handleAgentCompareStream(task, onChunk, documentContext, analysisContext, caseId);
    }
    if (task.agent === 'draft') {
      // Route to agent draft handler (pass caseId)
      return await handleAgentDraftStream(task.instructions || '', onChunk, docCtx, analysisContext, caseId);
    }
    if (task.agent === 'find_clause' && 'clause' in task && 'docId' in task) {
      // Find a clause in a document (pass caseId)
      return await handleFindClauseStream(task.clause, task.docId, onChunk, caseId);
    }
    if (task.agent === 'generate_timeline' && 'docId' in task) {
      // Generate a timeline from a document (pass caseId)
      return await handleGenerateTimelineStream(task.docId, onChunk, caseId);
    }
    if (task.agent === 'explain_term' && 'term' in task) {
      // Explain a legal term or acronym (pass caseId)
      return await handleExplainTermStream(task.term, onChunk, task.jurisdiction, caseId);
    }
    if (task.agent === 'flag_privileged_terms' && 'docId' in task) {
      // Scan a document for privileged terms (pass caseId)
      return await handleFlagPrivilegedTermsStream(task.docId, onChunk, caseId);
    }
    if (task.agent === 'risk_analysis' && 'docId' in task) {
      // Route to the risks analysis type using the document ID (pass caseId)
      const { data, error } = await analyzeDocument(task.docId, 'risks', caseId);
      if (error || !data) {
        onChunk('Error: Unable to perform risk analysis.');
        return { success: false, error };
      }
      onChunk(data.result);
      return { success: true, error: null };
    }
    if (task.agent === 'key_clauses' && 'docId' in task) {
      // Route to the clauses analysis type using the document ID (pass caseId)
      const { data, error } = await analyzeDocument(task.docId, 'clauses', caseId);
      if (error || !data) {
        onChunk('Error: Unable to extract key clauses.');
        return { success: false, error };
      }
      onChunk(data.result);
      return { success: true, error: null };
    }
    if (task.agent === 'summarize' && 'docId' in task) {
      // Route to the summary analysis type using the document ID (pass caseId)
      const { data, error } = await analyzeDocument(task.docId, 'summary', caseId);
      if (error || !data) {
        onChunk('Error: Unable to summarize the document.');
        return { success: false, error };
      }
      onChunk(data.result);
      return { success: true, error: null };
    }
    if (task.agent === 'perplexity' && 'query' in task && typeof conversationId === 'string') {
      // Route to the Perplexity agent handler (pass caseId)
      // Ensure wsContext exists before passing
      const wsContextHandler = params.wsContext ?? (() => {}); // Provide dummy if missing
      return await handlePerplexityAgent(conversationId, { query: task.query }, wsContextHandler, caseId);
    }
    // TODO: Implement other agent tasks
    onChunk('Error: Unknown or unimplemented agent command.');
    return { success: false, error: new Error('Agent task not implemented or invalid') };
  }
  if (task?.type === 'help') {
    // Return a detailed help message as a single chunk
    onChunk(`
Paralegal AI Agent Help

You can use special /agent commands to access powerful legal and document tools. Here are the main agents and how to use them:

1. /agent draft [instructions]
   • Draft legal documents, emails, or letters with AI.
   • Example: /agent draft draft a cease and desist letter
   • Tip: Add document context for more tailored drafts.

2. /agent find_clause "[clause description]" in [doc_id]
   • Find a specific clause or section in a document.
   • Example: /agent find_clause "termination clause" in 1234abcd
   • Tip: Use clear, descriptive clause names for best results.

3. /agent generate_timeline from [doc_id]
   • Extract a chronological timeline of key dates and events from a document.
   • Example: /agent generate_timeline from 1234abcd
   • Tip: Works best with depositions, case summaries, or event chronologies.

4. /agent explain_term "[legal term or acronym]"
   • Get a clear definition or explanation of a legal term or acronym.
   • Example: /agent explain_term "estoppel"
   • Tip: Add a jurisdiction for more specific definitions (e.g., /agent explain_term "CPLR" in New York law).

5. /research [query]
   • Perform advanced legal research using AI and real case law.
   • Example: /research Miranda rights
   • Tip: Use for case law, statutes, or legal doctrine research.

General Tips:
- Type / to see available commands and quick actions.
- You can upload documents to analyze, extract timelines, or use as context for drafting and clause search.
- Combine document context with agent commands for more powerful results.
- AI can make mistakes. Always review outputs and consult a legal professional when needed.
`);
    return { success: true, error: null };
  }
  // Default: normal chat (pass caseId)
  try {
    return await sendMessageStream(conversationId, message, onChunk, docCtx, analysisContext, caseId);
  } catch (error) {
    onChunk(`Error sending message: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return { success: false, error: error instanceof Error ? error : new Error('Failed to send message') };
  }
} 
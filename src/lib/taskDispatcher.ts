import { Task } from './commandParser';
import { 
  handleResearchQueryStream, 
  handleAgentDraftStream, 
  handleAgentCompareStream,
  handleFindClauseStream,
  handleExplainTermStream,
  handleFlagPrivilegedTermsStream,
  handlePerplexityAgent, 
  handleRewriteStream,
  handleSummarizeStream,
} from '../services/chatService';
import { analyzeDocument } from '../services/documentAnalysisService';
import * as templateService from '../services/templateService';
import { NavigateFunction } from 'react-router-dom';
import type { BackgroundTask } from '@/atoms/appAtoms';
import { TaskStatus } from '@/atoms/appAtoms';
import { PerplexitySource } from '@/types/sources'; 
import { v4 as uuidv4 } from 'uuid'; 

// Define type for the params object
interface DispatcherParams {
  wsContext?: (type: string, payload: any) => void; 
  addTask?: (task: Omit<BackgroundTask, 'createdAt'>) => void;
  updateTask?: (update: { id: string; status?: TaskStatus; progress?: number; description?: string }) => void;
  removeTask?: (taskId: string) => void;
}

// Define a specific return type for dispatcher actions
export type DispatcherResponse = {
  success: boolean;
  error?: Error | null;
  action?: 'show_template_modal'; 
  templateId?: string; 
  newConversationId?: string; 
  sources?: PerplexitySource[]; 
  // Add other potential action types and data as needed
};

// Main dispatcher for user input
export async function handleUserTurn({
  task,
  message,
  onChunk,
  conversationId,
  caseId,
  documentContext,
  setActiveDocumentId,
  navigate,
  params
}: {
  task: Task;
  message: string;
  onChunk: (chunk: string) => void;
  conversationId?: string;
  caseId?: string;
  documentContext?: string | string[];
  setActiveDocumentId: (id: string | null) => void;
  navigate: NavigateFunction;
  params: DispatcherParams; 
}): Promise<DispatcherResponse> {
  try {  
    console.log("Dispatcher received task:", task, "with caseId:", caseId);

    // Extract task atom setters from params, providing dummy fallbacks if missing
    const addTask = params.addTask || (() => console.warn('addTask not provided to dispatcher'));
    const updateTask = params.updateTask || (() => console.warn('updateTask not provided to dispatcher'));
    const removeTask = params.removeTask || (() => console.warn('removeTask not provided to dispatcher'));

    // Determine target document ID from task or context
    const getTargetDocId = (): string | null => {
        if (task?.type === 'agent' && 'docId' in task && task.docId) {
          return task.docId;
        }
        // Use context if task doesn't specify ID (for commands like /agent summarize)
        if (task?.type === 'agent' && (
           task.agent === 'summarize' || 
           task.agent === 'key_clauses' || 
           task.agent === 'risk_analysis' ||
           task.agent === 'generate_timeline' ||
           task.agent === 'flag_privileged_terms'
           // Add other agents that can use context here
        )) {
            const contextId = Array.isArray(documentContext) ? documentContext[0] : documentContext;
            if (contextId) return contextId;
        }
        return null;
    };
    
    // Get the target document ID once and reuse it
    const targetDocId = getTargetDocId();

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

    // Handle /agent commands
    if (task?.type === 'agent') {
      // Activate document view if a target document is identified for relevant commands
      if (targetDocId && [
            'find_clause', 
            'generate_timeline', 
            'flag_privileged_terms', 
            'risk_analysis', 
            'key_clauses', 
            'summarize',
            'rewrite'
          ].includes(task.agent)) {
          console.log(`Activating document view for ID: ${targetDocId}`);
          setActiveDocumentId(targetDocId);
          navigate(`/view/document/${targetDocId}`);
          // Add a small delay to allow navigation/UI update before potential blocking analysis call?
          // await new Promise(resolve => setTimeout(resolve, 100)); 
      }

      // Generate a unique ID for this task if task management functions are provided
      const taskId = (typeof addTask === 'function' && typeof updateTask === 'function' && typeof removeTask === 'function') ? uuidv4() : undefined;

      // Use string | undefined for the document ID (not null)
      const docIdForAnalysis = targetDocId ?? undefined;

      // Declare analysis context inside this scope
      let docAnalysisContext: string | undefined;
      
      if (docIdForAnalysis) {
        try {
          // Get analysis context for the target document if available
          const analysisResult = await analyzeDocument({ 
            documentId: docIdForAnalysis, 
            analysisType: 'document_context', 
            addTask,
            updateTask,
            removeTask
          });
          
          // Extract the context string from analysis result
          docAnalysisContext = typeof analysisResult === 'string' 
            ? analysisResult 
            : analysisResult.data?.context;
            
        } catch (e) {
          console.warn(`Could not get analysis context for doc ${docIdForAnalysis}:`, e);
        }
      }

      switch (task.agent) {
        case 'draft':
          if (!caseId) {
            onChunk('Error: Case ID is required for /agent draft.');
            return { success: false, error: new Error('Case ID is required for /agent draft.') };
          }
          if (!('instructions' in task) || !task.instructions) {
            onChunk('Error: Instructions are required for /agent draft.');
            return { success: false, error: new Error('Instructions are required for /agent draft.') };
          }
          if (taskId) {
            addTask({ id: taskId, status: 'running', description: `Drafting response...` });
          }
          return await handleAgentDraftStream(
            task.instructions,
            onChunk,
            docIdForAnalysis,
            docAnalysisContext,
            caseId,
            taskId,
            updateTask,
            removeTask
          );

        case 'find_clause': // Restored find_clause case
          if (!docIdForAnalysis) {
            onChunk('Error: A document must be open or specified to find clauses.');
            return { success: false, error: new Error('A document must be open or specified to find clauses.') };
          }
          if (!('clause' in task) || !task.clause) {
            onChunk('Error: Clause description is required for /agent find_clause.');
            return { success: false, error: new Error('Clause description is required for /agent find_clause.') };
          }
          if (taskId) {
            addTask({ id: taskId, status: 'running', description: `Finding clause: "${task.clause}"...` });
          }
          return await handleFindClauseStream(task.clause, docIdForAnalysis, onChunk, taskId, updateTask, removeTask);

        case 'explain_term':
          if (!('term' in task) || !task.term) {
            onChunk('Error: Term is required for /agent explain_term.');
            return { success: false, error: new Error('Term is required for /agent explain_term.') };
          }
          if (taskId) {
            addTask({ id: taskId, status: 'running', description: `Explaining term: "${task.term}"...` });
          }
          return await handleExplainTermStream(
            task.term,
            onChunk,
            'jurisdiction' in task ? task.jurisdiction : undefined,
            caseId, // Pass caseId if available
            taskId,
            updateTask,
            removeTask
          );

        case 'compare': {
          if (!caseId) {
            onChunk('Error: Case ID is required for /agent compare.');
            return { success: false, error: new Error('Case ID is required for /agent compare.') };
          }
          // Ensure docIds is always an array and exists
          if (!('docIds' in task) || !Array.isArray(task.docIds) || task.docIds.length < 2) {
             onChunk('Error: At least two document IDs are required for /agent compare.');
             return { success: false, error: new Error('At least two document IDs are required for /agent compare.') };
          }
          const docIdsToCompare = task.docIds;
          
          // Fetch contexts for all documents
          const documentContextPromises = docIdsToCompare.map(docId => 
            analyzeDocument({ 
              documentId: docId, 
              analysisType: 'document_context', 
              addTask,
              updateTask,
              removeTask
            }).catch(e => {
              console.warn(`Could not get context for doc ${docId} in comparison:`, e);
              return null; // Or handle error appropriately
            })
          );
          
          const documentContextResults = await Promise.all(documentContextPromises);
          
          // Extract context strings from results and filter out nulls
          const validContexts = documentContextResults
            .map(result => {
              if (!result) return null;
              return typeof result === 'string' ? result : result.data?.context;
            })
            .filter((ctx): ctx is string => ctx !== null);
            
          if (validContexts.length < 2) {
             onChunk('Error: Could not load context for at least two documents.');
             return { success: false, error: new Error('Could not load context for at least two documents.') };
          }

          if (taskId) {
            addTask({ id: taskId, status: 'running', description: `Comparing ${docIdsToCompare.length} documents...` });
          }
          
          return await handleAgentCompareStream(
            docIdsToCompare, // Pass the original IDs
            onChunk, // Pass onChunk function correctly
            caseId,
            validContexts.join('\n\n---\n\n'), // Concatenate contexts
            docAnalysisContext, // Pass analysisContext from the current document
            taskId,
            updateTask,
            removeTask
          );
        }

        case 'flag_privileged_terms':
          if (!docIdForAnalysis) {
            onChunk('Error: A document must be open or specified to flag terms.');
            return { success: false, error: new Error('A document must be open or specified to flag terms.') };
          }
          if (!caseId) { // Added check for caseId
            onChunk('Error: Case ID is required to flag terms.');
            return { success: false, error: new Error('Case ID is required to flag terms.') };
          }
          if (taskId) {
            addTask({ id: taskId, status: 'running', description: `Flagging privileged terms in document...` });
          }
          return await handleFlagPrivilegedTermsStream(
            docIdForAnalysis,
            onChunk,
            caseId, // Pass non-undefined caseId
            taskId,
            updateTask,
            removeTask
          );

        case 'perplexity':
          if (!('query' in task) || !task.query) {
            onChunk('Error: Query is required for /agent perplexity.');
            return { success: false, error: new Error('Query is required for /agent perplexity.') };
          }
          if (!conversationId) {
            onChunk('Error: Conversation ID is required for /agent perplexity.');
            return { success: false, error: new Error('Conversation ID is required for /agent perplexity.') };
          }
          if (taskId) {
            addTask({ id: taskId, status: 'running', description: `Running Perplexity query...` });
          }
          return await handlePerplexityAgent(conversationId, { query: task.query }, onChunk, taskId, updateTask, removeTask);

        case 'rewrite':
          if (!('instructions' in task) || !task.instructions) {
            onChunk('Error: Instructions are required for /agent rewrite.');
            return { success: false, error: new Error('Instructions are required for /agent rewrite.') };
          }
          if (!docIdForAnalysis) {
            onChunk('Error: A document must be open or specified to rewrite text.');
            return { success: false, error: new Error('A document must be open or specified to rewrite text.') };
          }
          if (!caseId) {
             onChunk('Error: Case ID is required for rewrite.');
             return { success: false, error: new Error('Case ID is required for rewrite.') };
          }
          
          // Use type assertion to narrow the task type for rewrite operations
          type RewriteTask = { selectedText: string; instructions?: string };
          const rewriteTask = task as unknown as RewriteTask;
          
          // Check for selectedText with proper type narrowing
          if (!rewriteTask.selectedText) {
            onChunk('Error: Selected text is required for /agent rewrite.');
            return { success: false, error: new Error('Selected text is required for /agent rewrite.') };
          }
          
          if (taskId) {
            addTask({ id: taskId, status: 'running', description: `Rewriting selected text...` });
          }
          
          return await handleRewriteStream(
             docIdForAnalysis,
             caseId,
             rewriteTask.selectedText,
             onChunk,
             rewriteTask.instructions,
             taskId,
             updateTask,
             removeTask
          );

        case 'summarize': {
          if (!docIdForAnalysis) {
            onChunk('Error: A document must be open or specified to summarize text.');
            return { success: false, error: new Error('A document must be open or specified to summarize text.') };
          }
          if (!caseId) { 
            onChunk('Error: Case ID is required for summarize.');
            return { success: false, error: new Error('Case ID is required for summarize.') };
          }
          
          // Use type assertion to narrow the task type for summarize operations
          type SummarizeTask = { selectedText: string; instructions?: string };
          const summarizeTask = task as unknown as SummarizeTask;
          
          // Check for selectedText with proper type narrowing
          if (!summarizeTask.selectedText) {
            onChunk('Error: Selected text is required for /agent summarize.');
            return { success: false, error: new Error('Selected text is required for /agent summarize.') };
          }
          
          if (taskId) {
            addTask({ id: taskId, status: 'running', description: `Summarizing selected text...` });
          }
          
          return await handleSummarizeStream(
            docIdForAnalysis,
            caseId,
            summarizeTask.selectedText,
            onChunk,
            summarizeTask.instructions,
            taskId,
            updateTask,
            removeTask
          );
        }

        default:
          console.warn(`Unknown agent command: ${task.agent}`);
          onChunk(`Unknown agent command: ${task.agent}`);
          return { success: false, error: new Error(`Unknown agent command: ${task.agent}`) };
      }
    }

    console.warn("Dispatcher couldn't handle task:", task);
    onChunk('Sorry, I could not process that request.');
    return { success: false, error: new Error('Unhandled task type') };

  } catch (error) {
    console.error("Error in handleUserTurn:", error);
    const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred.";
    onChunk(`Error: ${errorMessage}`);
    return { success: false, error: error instanceof Error ? error : new Error(errorMessage) };
  }
}
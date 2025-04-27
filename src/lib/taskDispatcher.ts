import { Task } from './commandParser';
import { handleResearchQueryStream, sendMessageStream, handleAgentDraftStream, handleFindClauseStream, handleGenerateTimelineStream, handleExplainTermStream } from '../services/chatService';

// Main dispatcher for user input
export async function handleUserTurn({
  task,
  message,
  onChunk,
  conversationId,
  documentContext,
  analysisContext
}: {
  task: Task;
  message: string;
  onChunk: (chunk: string) => void;
  conversationId?: string;
  documentContext?: string;
  analysisContext?: string;
}) {
  if (task?.type === 'research') {
    // Route to RAG handler
    return await handleResearchQueryStream(task.query, onChunk);
  }
  if (task?.type === 'agent') {
    if (task.agent === 'draft') {
      // Route to agent draft handler
      return await handleAgentDraftStream(task.instructions || '', onChunk, documentContext, analysisContext);
    }
    if (task.agent === 'find_clause') {
      // Find a clause in a document
      return await handleFindClauseStream(task.clause, task.docId, onChunk);
    }
    if (task.agent === 'generate_timeline') {
      // Generate a timeline from a document
      return await handleGenerateTimelineStream(task.docId, onChunk);
    }
    if (task.agent === 'explain_term') {
      // Explain a legal term or acronym
      return await handleExplainTermStream(task.term, onChunk, task.jurisdiction);
    }
    // TODO: Implement other agent tasks
    return { success: false, error: new Error('Agent tasks not yet implemented') };
  }
  if (task?.type === 'help') {
    // Return help text as a single chunk
    onChunk('Type /research [query] for legal research, /agent draft [instructions] to draft, or /agent help for this help message.');
    return { success: true, error: null };
  }
  // Default: normal chat
  return await sendMessageStream(conversationId, message, onChunk, documentContext, analysisContext);
} 
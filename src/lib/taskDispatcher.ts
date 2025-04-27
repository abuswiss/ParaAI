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
  // Default: normal chat
  return await sendMessageStream(conversationId, message, onChunk, documentContext, analysisContext);
} 
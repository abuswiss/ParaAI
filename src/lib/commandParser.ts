// Command parser utility for chat input
// Recognizes /research, /agent draft, /agent help, and returns a Task object or null

export type Task =
  | { type: 'research'; query: string }
  | { type: 'agent'; agent: string; instructions?: string }
  | { type: 'agent'; agent: 'find_clause'; clause: string; docId: string }
  | { type: 'help' }
  | null;

export function parseCommand(inputText: string): Task {
  const trimmed = inputText.trim();
  if (trimmed.startsWith('/research ')) {
    const query = trimmed.slice(10).trim();
    if (query) return { type: 'research', query };
  }
  if (trimmed === '/agent help') {
    return { type: 'help' };
  }
  if (trimmed.startsWith('/agent draft ')) {
    const instructions = trimmed.slice(13).trim();
    return { type: 'agent', agent: 'draft', instructions };
  }
  // /agent find_clause "..." in [doc_id]
  const findClauseMatch = trimmed.match(/^\/agent find_clause\s+"([^"]+)"\s+in\s+(.+)$/i);
  if (findClauseMatch) {
    const clause = findClauseMatch[1].trim();
    const docId = findClauseMatch[2].trim();
    if (clause && docId) {
      return { type: 'agent', agent: 'find_clause', clause, docId };
    }
  }
  // Add more /agent commands as needed
  return null;
} 
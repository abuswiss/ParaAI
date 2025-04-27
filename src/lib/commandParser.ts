// Command parser utility for chat input
// Recognizes /research, /agent draft, /agent help, and returns a Task object or null

export type Task =
  | { type: 'research'; query: string }
  | { type: 'agent'; agent: string; instructions?: string }
  | { type: 'agent'; agent: 'find_clause'; clause: string; docId: string }
  | { type: 'agent'; agent: 'flag_privileged_terms'; docId: string }
  | { type: 'agent'; agent: 'generate_timeline'; docId: string }
  | { type: 'agent'; agent: 'risk_analysis'; docId: string }
  | { type: 'agent'; agent: 'key_clauses'; docId: string }
  | { type: 'agent'; agent: 'summarize'; docId: string }
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
  // /agent find_clause "..." in|from [doc_id]
  const findClauseMatch = trimmed.match(/^\/agent find_clause\s+"([^"]+)"\s+(in|from)\s+(.+)$/i);
  if (findClauseMatch) {
    const clause = findClauseMatch[1].trim();
    const docId = findClauseMatch[3].trim();
    if (clause && docId) {
      return { type: 'agent', agent: 'find_clause', clause, docId };
    }
  }
  // /agent flag_privileged_terms in|from [doc_id]
  const flagPrivMatch = trimmed.match(/^\/agent flag_privileged_terms\s+(in|from)\s+(.+)$/i);
  if (flagPrivMatch) {
    const docId = flagPrivMatch[2].trim();
    if (docId) {
      return { type: 'agent', agent: 'flag_privileged_terms', docId };
    }
  }
  // /agent generate_timeline in|from [doc_id]
  const genTimelineMatch = trimmed.match(/^\/agent generate_timeline\s+(in|from)\s+(.+)$/i);
  if (genTimelineMatch) {
    const docId = genTimelineMatch[2].trim();
    if (docId) {
      return { type: 'agent', agent: 'generate_timeline', docId };
    }
  }
  // /agent risk_analysis in|from [doc_id]
  const riskAnalysisMatch = trimmed.match(/^\/agent risk_analysis\s+(in|from)\s+(.+)$/i);
  if (riskAnalysisMatch) {
    const docId = riskAnalysisMatch[2].trim();
    if (docId) {
      return { type: 'agent', agent: 'risk_analysis', docId };
    }
  }
  // /agent key_clauses in|from [doc_id]
  const keyClausesMatch = trimmed.match(/^\/agent key_clauses\s+(in|from)\s+(.+)$/i);
  if (keyClausesMatch) {
    const docId = keyClausesMatch[2].trim();
    if (docId) {
      return { type: 'agent', agent: 'key_clauses', docId };
    }
  }
  // /agent summarize in|from [doc_id]
  const summarizeMatch = trimmed.match(/^\/agent summarize\s+(in|from)\s+(.+)$/i);
  if (summarizeMatch) {
    const docId = summarizeMatch[2].trim();
    if (docId) {
      return { type: 'agent', agent: 'summarize', docId };
    }
  }
  // Add more /agent commands as needed
  return null;
} 
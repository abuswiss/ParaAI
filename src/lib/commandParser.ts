// Command parser utility for chat input
// Recognizes /research, /agent commands, /use template, and returns a Task object or null

import { AgentName } from './agents'; // Assuming AgentName type exists

// Define specific task types for clarity
interface HelpTask { type: 'help' }
interface ResearchTask { type: 'research'; query: string }
interface AgentDraftTask { type: 'agent'; agent: 'draft'; instructions?: string }
interface FindClauseTask { type: 'agent'; agent: 'find_clause'; clause: string; docId: string }
interface FlagPrivilegedTask { type: 'agent'; agent: 'flag_privileged_terms'; docId: string }
interface GenerateTimelineTask { type: 'agent'; agent: 'generate_timeline'; docId: string }
interface RiskAnalysisTask { type: 'agent'; agent: 'risk_analysis'; docId: string }
interface KeyClausesTask { type: 'agent'; agent: 'key_clauses'; docId: string }
interface SummarizeDocTask { type: 'agent'; agent: 'summarize'; docId: string }
interface ExplainTermTask { type: 'agent'; agent: 'explain_term'; term: string; jurisdiction?: string } // Add jurisdiction
interface PerplexityTask { type: 'agent'; agent: 'perplexity'; query: string }
interface AgentCompareTask { type: 'agent'; agent: 'compare'; docIdA: string; docIdB: string } // New task type
interface UseTemplateTask { type: 'use_template'; templateName: string }
interface CaseSearchTask { type: 'case_search'; query: string }
interface UnknownTask { type: 'unknown'; command: string }

// Union type for all possible tasks
export type Task =
  | HelpTask
  | ResearchTask
  | AgentDraftTask
  | FindClauseTask
  | FlagPrivilegedTask
  | GenerateTimelineTask
  | RiskAnalysisTask
  | KeyClausesTask
  | SummarizeDocTask
  | ExplainTermTask // Add to union
  | PerplexityTask
  | AgentCompareTask // Added to union
  | UseTemplateTask
  | CaseSearchTask
  | UnknownTask
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
  // /agent perplexity [query]
  const perplexityMatch = trimmed.match(/^\/agent perplexity\s+(.+)$/i);
  if (perplexityMatch) {
    const query = perplexityMatch[1].trim();
    if (query) {
      return { type: 'agent', agent: 'perplexity', query };
    }
  }
  // /agent compare [docA_id] [docB_id]
  const compareMatch = trimmed.match(/^\/agent compare\s+(\S+)\s+(\S+)$/i);
  if (compareMatch) {
    const docIdA = compareMatch[1].trim();
    const docIdB = compareMatch[2].trim();
    if (docIdA && docIdB) {
      return { type: 'agent', agent: 'compare', docIdA, docIdB };
    }
  }
  // /use template "Template Name" OR /use template TemplateName
  // Also allow /use tmpl ... as shorthand
  const useTemplateMatch = trimmed.match(/^\/use\s+(?:template|tmpl)\s+(?:"([^"]+)"|(\S+))$/i);
  if (useTemplateMatch) {
    const templateName = useTemplateMatch[1] || useTemplateMatch[2]; // Group 1 for quoted, Group 2 for unquoted
    if (templateName) {
      return { type: 'use_template', templateName: templateName.trim() };
    }
  }
  // Case Search command (handles quoted and unquoted queries)
  const caseSearchMatch = trimmed.match(/^\/search\s+(?:\"([^\"]+)\"|(.+))$/);
  if (caseSearchMatch) {
    const query = (caseSearchMatch[1] || caseSearchMatch[2]).trim();
    return { type: 'case_search', query };
  }
  // /agent explain_term "..." (optional: in [jurisdiction])
  const explainTermMatch = trimmed.match(/^\/agent explain_term\s+\"([^\"]+)\"(?:\s+in\s+(.+))?$/i);
  if (explainTermMatch) {
    const term = explainTermMatch[1].trim();
    const jurisdiction = explainTermMatch[2]?.trim();
    if (term) {
      return { type: 'agent', agent: 'explain_term', term, jurisdiction };
    }
  }
  // If it starts with / but doesn't match known commands
  if (trimmed.startsWith('/')) {
    return { type: 'unknown', command: trimmed };
  }
  return null; // Not a command
} 
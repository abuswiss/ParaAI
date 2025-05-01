// Command parser utility for chat input
// Recognizes /research, /agent commands, /use template, and returns a Task object or null

import { AnalysisType } from '../services/documentAnalysisService'; // Import AnalysisType

// Define specific task types for clarity
export interface HelpTask { type: 'help'; query?: string }
export interface ResearchTask { type: 'research'; query: string }
export interface AgentDraftTask { type: 'agent'; agent: 'draft'; instructions: string; docId?: string }
export interface FindClauseTask { type: 'agent'; agent: 'find_clause'; clauseType: string; docId: string } // Requires docId
export interface FlagPrivilegedTask { type: 'agent'; agent: 'flag_privileged_terms'; docId: string } // Requires docId
export interface GenerateTimelineTask { type: 'agent'; agent: 'generate_timeline'; docId: string } // Requires docId
export interface RiskAnalysisTask { type: 'agent'; agent: 'risk_analysis'; docId: string } // Requires docId
export interface KeyClausesTask { type: 'agent'; agent: 'key_clauses'; docId: string } // Requires docId
export interface SummarizeDocTask { type: 'agent'; agent: 'summarize'; docId?: string } // Optional docId
export interface ExplainTermTask { type: 'agent'; agent: 'explain_term'; term: string; docId?: string } // Optional docId
export interface PerplexityTask { type: 'agent'; agent: 'perplexity'; query: string }
export interface AgentCompareTask { type: 'agent'; agent: 'compare'; docId1: string; docId2: string } // Requires two docIds
export interface RewriteTask { type: 'agent'; agent: 'rewrite'; instructions: string; docId?: string } // Added RewriteTask
export interface UseTemplateTask { type: 'use_template'; templateName: string }
export interface CaseSearchTask { type: 'case_search'; query: string }
export interface UnknownTask { type: 'unknown'; originalInput: string }
export interface AnalyzeDocumentTask { type: 'analyze_document'; docId: string; analysisType: AnalysisType } // Added AnalyzeDocumentTask

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
  | RewriteTask      // Added RewriteTask to union
  | UseTemplateTask
  | CaseSearchTask
  | AnalyzeDocumentTask // Added AnalyzeDocumentTask to union
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
      return { type: 'agent', agent: 'find_clause', clauseType: clause, docId };
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
      return { type: 'agent', agent: 'compare', docId1: docIdA, docId2: docIdB };
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
      return { type: 'agent', agent: 'explain_term', term, docId: jurisdiction };
    }
  }
  // /analyze [type] in|from [doc_id]
  const analyzeMatch = trimmed.match(/^\/analyze\s+([a-zA-Z_]+)\s+(?:in|from)\s+(.+)$/i);
  if (analyzeMatch) {
    const analysisType = analyzeMatch[1].trim().toLowerCase();
    const docId = analyzeMatch[2].trim();
    // Basic validation - check if analysisType is one of the known literal types
    // A more robust approach might involve importing AnalysisType here, but this avoids circular dependency
    const knownTypes = ['summary', 'entities', 'clauses', 'risks', 'timeline', 'custom', 'privilegedTerms', 'document_context'];
    if (docId && knownTypes.includes(analysisType)) {
      // We assert here because we checked against knownTypes, but TS can't infer it matches AnalysisType
      return { type: 'analyze_document', analysisType: analysisType as AnalysisType, docId }; 
    }
  }
  // If it starts with / but doesn't match known commands
  if (trimmed.startsWith('/')) {
    return { type: 'unknown', originalInput: trimmed };
  }
  return null; // Not a command
} 
export interface AIKeyExcerpt {
  text: string;
  documentId: string; // Or a more specific identifier if you have one
  pageNumber?: number; // Optional
  relevanceScore?: number; // Optional, if AI provides it
}

export interface AIDraftedResponseSupportingExcerpt {
  text: string;
  documentId: string;
  sourceFilename: string; // To display which document it came from
}

export interface AIDraftedResponse {
  responseNumber: string; // e.g., "Response to Interrogatory No. 1"
  draftedText: string;
  supportingExcerpts: AIDraftedResponseSupportingExcerpt[];
  objections?: string[]; // List of applicable objections
}

export interface AIIdentifiedObjection {
  objection: string; // e.g., "Vague and Ambiguous"
  explanation: string; // Why this objection applies
  supportingExcerpts: AIDraftedResponseSupportingExcerpt[]; // Text supporting the objection
}

/**
 * Defines the structured output expected from the ai-discovery-analyzer function.
 * Depending on the primaryGoal, some fields might be more prominent or exclusively present.
 */
export interface AIAnalysisResults {
  overallSummary: string;
  keyExcerpts: AIKeyExcerpt[];
  draftedResponses?: AIDraftedResponse[]; // For drafting tasks
  identifiedObjections?: AIIdentifiedObjection[]; // For objection identification
  suggestedRequestsForAdmission?: string[]; // For RFA suggestion tasks
  suggestedInterrogatories?: string[]; // For Interrogatory suggestion tasks
  suggestedRequestsForProduction?: string[]; // For RFP suggestion tasks
  potentialIssues: string[];
  suggestedNextSteps: string[];
  rawAIOutput?: string; // For debugging in case of parsing errors
}

// Enum for primary goal types to help with structured prompting
export enum CopilotGoalType {
  GENERAL_ANALYSIS = "GENERAL_ANALYSIS",
  DRAFT_RESPONSES_INTERROGATORIES = "DRAFT_RESPONSES_INTERROGATORIES",
  DRAFT_RESPONSES_ADMISSIONS = "DRAFT_RESPONSES_ADMISSIONS",
  IDENTIFY_OBJECTIONS_INTERROGATORIES = "IDENTIFY_OBJECTIONS_INTERROGATORIES",
  IDENTIFY_OBJECTIONS_ADMISSIONS = "IDENTIFY_OBJECTIONS_ADMISSIONS",
  IDENTIFY_OBJECTIONS_RFPS = "IDENTIFY_OBJECTIONS_RFPS",
  SUGGEST_REQUESTS_FOR_ADMISSION = "SUGGEST_REQUESTS_FOR_ADMISSION",
  SUGGEST_INTERROGATORIES = "SUGGEST_INTERROGATORIES",
  SUGGEST_REQUESTS_FOR_PRODUCTION = "SUGGEST_REQUESTS_FOR_PRODUCTION",
  SUMMARIZE_DISCOVERY_DOCUMENTS = "SUMMARIZE_DISCOVERY_DOCUMENTS",
  COMPARE_DISCOVERY_RESPONSES = "COMPARE_DISCOVERY_RESPONSES",
  IDENTIFY_KEY_FACTS_AND_ISSUES = "IDENTIFY_KEY_FACTS_AND_ISSUES",
} 
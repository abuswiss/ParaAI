import { supabase } from '@/lib/supabaseClient';
// import { SelectedDocumentContent } from '@/context/CopilotContext'; // This import seems unused here after context changes
import { AIAnalysisResults, CopilotGoalType } from '@/types/aiCopilot';

/**
 * Type for document inputs to AI services.
 */
export interface DocumentInput {
  id: string;
  filename: string;
  content: string; // This should be plain text content
}

/**
 * Invokes the AI Discovery Analyzer Supabase Edge Function.
 * This function will be responsible for the main analysis based on multiple documents and a goal.
 */
export const invokeAIDiscoveryAnalyzer = async (
  documents: SelectedDocumentContent[],
  goal: string
): Promise<AIAnalysisResults> => {
  console.log('aiCopilotService: Invoking ai-discovery-analyzer', { documents, goal });

  const requestBody = {
    documentContents: documents.map(d => ({ filename: d.filename, content: d.content })),
    primaryGoal: goal,
  };

  // Real Supabase function call (uncomment and adjust if your function name differs)
  const { data, error } = await supabase.functions.invoke('ai-discovery-analyzer', {
    body: requestBody,
  });

  if (error) {
    console.error('Error invoking ai-discovery-analyzer function:', error);
    throw new Error(error.message || 'Failed to analyze documents with AI.');
  }

  // The Supabase function itself should return a body with { success: boolean, results: AIAnalysisResults, error?: string }
  // We are assuming the Edge Function handles the actual response structure and returns the 'results' part upon success.
  if (!data || (data.success === false && data.error)) {
    console.error('AI analysis function returned an error:', data?.error);
    throw new Error(data?.error || 'AI analysis failed on the backend.');
  }
  
  if (data.success === true && data.results) {
    return data.results as AIAnalysisResults;
  }
  
  // Fallback or if structure is different than expected
  // This case should ideally not be hit if the edge function is robust
  console.warn('AI analysis function response was not in the expected format:', data);
  throw new Error('AI analysis returned an unexpected data format.');

  // --- Mock response (keep for quick testing if Supabase is down, but primary path is above) ---
  /*
  const combinedContent = documents.map(doc => 
    `--- START OF DOCUMENT: ${doc.filename} (ID: ${doc.id}) ---\n${doc.content}\n--- END OF DOCUMENT: ${doc.filename} ---`
  ).join('\n\n');
  await new Promise(resolve => setTimeout(resolve, 1500));
  const mockResults: AIAnalysisResults = {
    overallSummary: `Mock AI Analysis complete for goal: "${goal}" based on ${documents.length} document(s) including "${documents[0]?.filename}".`,
    keyExcerpts: [
      { documentFilename: documents[0]?.filename || 'doc1.pdf', excerpt: "This is a key excerpt from the first document.", relevance: "It directly addresses the primary goal."},
      { documentFilename: documents[1]?.filename || 'doc2.pdf', excerpt: "Another important point from the second document.", relevance: "Provides supporting evidence."}
    ],
    suggestedActions: ["Review section 5.", "Consult with lead counsel about point X."],
    potentialIssues: ["Potential conflict in document 3, page 2."],
    analysisType: 'general'
  };
  if (goal.toLowerCase().includes("interrogatories")) {
    mockResults.draftedResponses = [
        {
            interrogatoryText: "What is the primary address of the plaintiff?",
            sourceDocument: documents[0]?.filename || 'InterrogatorySet1.docx',
            suggestedResponse: "The primary address is 123 Main St, Anytown, USA, as stated in Exhibit A.",
            supportingExcerpts: [{ documentFilename: documents[0]?.filename || 'doc1.pdf', excerpt: 'Plaintiff resides at 123 Main St.'}]
        }
    ];
    mockResults.analysisType = 'interrogatoryDrafting';
  }
  return mockResults;
  */
};

/**
 * Invokes the AI Text Refiner Supabase Edge Function.
 * This function will handle iterative refinements on text snippets.
 */
export const invokeAITextRefiner = async (
  textSnippet: string,
  refinementCommand: string, // e.g., "rephrase", "expand", "make more formal"
  // originalContext?: SelectedDocumentContent[] // Optional: Full original context if needed for better refinement
): Promise<{ refinedText: string }> => {
  console.log('aiCopilotService: Invoking ai-text-refiner', { textSnippet, refinementCommand });

  const requestBody = {
    snippet: textSnippet,
    command: refinementCommand,
    // ...(originalContext && { fullContext: originalContext.map(d => d.content).join('\n---\n') })
  };
  
  // This is a placeholder. Actual implementation will call the Supabase function.
  // const { data, error } = await supabase.functions.invoke('ai-text-refiner', {
  //   body: requestBody,
  // });

  // if (error) {
  //   console.error('Error invoking ai-text-refiner function:', error);
  //   throw new Error(error.message || 'Failed to refine text with AI.');
  // }

  // if (!data || (data.success === false && data.error)) {
  //   console.error('AI text refinement function returned an error:', data?.error);
  //   throw new Error(data?.error || 'AI text refinement failed on the backend.');
  // }

  // return { refinedText: data.refinedText }; // Assuming structure

  // Mock response for now
  await new Promise(resolve => setTimeout(resolve, 1000));
  return {
    refinedText: `Mock refined text for "${refinementCommand}": ${textSnippet} (Now improved!)`
  };
};

// Remove the first instance of invokeAIDiscoveryAnalyzer (lines 8-40 of original file)
// The function below will be the one used.

/**
 * Invokes the AI Text Refiner Supabase Edge Function.
 * This function will handle iterative refinements on text snippets.
 */
// The existing invokeAITextRefiner function (lines 73-101 of original file) seems fine for now, 
// keeping its mock implementation until its Supabase counterpart is fully ready.
// We will just ensure its signature is consistent if it were to be used in the same service object.
export const invokeAITextRefinerInternal = async (
  textSnippet: string,
  refinementCommand: string, 
): Promise<{ refinedText: string }> => {
  console.log('aiCopilotService: Invoking ai-text-refiner', { textSnippet, refinementCommand });

  const requestBody = {
    snippet: textSnippet,
    command: refinementCommand,
  };
  
  // const { data, error } = await supabase.functions.invoke('ai-text-refiner', {
  //   body: requestBody,
  // });

  // if (error) {
  //   console.error('Error invoking ai-text-refiner function:', error);
  //   throw new Error(error.message || 'Failed to refine text with AI.');
  // }

  // if (!data || (data.success === false && data.error)) {
  //   console.error('AI text refinement function returned an error:', data?.error);
  //   throw new Error(data?.error || 'AI text refinement failed on the backend.');
  // }
  // return { refinedText: data.refinedText }; // Assuming structure

  await new Promise(resolve => setTimeout(resolve, 1000));
  return {
    refinedText: `Mock refined text for "${refinementCommand}": ${textSnippet} (Now improved!)`
  };
};

// This is the main function that will be exported as invokeAIDiscoveryAnalyzer.
async function analyzeDiscoveryDocuments(
  documents: DocumentInput[],
  primaryGoal: string,
  primaryGoalType: CopilotGoalType | null,
  previousAIOutput: AIAnalysisResults | null
): Promise<AIAnalysisResults> {
  console.log('aiCopilotService.analyzeDiscoveryDocuments called with:', { 
    documents: documents.map(d => ({ id: d.id, filename: d.filename, contentLength: d.content.length })),
    primaryGoal,
    primaryGoalType,
    hasPreviousOutput: !!previousAIOutput
  });

  const requestBody = {
    documentContents: documents,
    primaryGoal,
    primaryGoalType,
    previousAIOutput
  };

  const { data: responseData, error } = await supabase.functions.invoke('ai-discovery-analyzer', {
    body: requestBody,
  });

  if (error) {
    console.error('Error invoking ai-discovery-analyzer function:', error);
    let detailedMessage = `Failed to analyze discovery documents: ${error.message}`;
    if (typeof error.details === 'string') detailedMessage += ` Details: ${error.details}`;
    else if (typeof error.context === 'string') detailedMessage += ` Context: ${error.context}`;
    else if (error.context && typeof error.context.details === 'string') detailedMessage += ` Details: ${error.context.details}`;
    throw new Error(detailedMessage);
  }

  if (!responseData) {
    console.error('AI discovery analyzer function returned no data.');
    throw new Error('AI analysis failed: No data returned from the function.');
  }

  if (responseData.success === false && responseData.error) {
    console.error('AI analysis function returned an error:', responseData.error);
    const errorMessage = responseData.error.message || responseData.error;
    throw new Error(typeof errorMessage === 'string' ? errorMessage : 'AI analysis failed on the backend.');
  }
  
  if (responseData.success === true && responseData.results) {
    return responseData.results as AIAnalysisResults;
  }
  
  console.warn('AI analysis function response was not in the expected format:', responseData);
  throw new Error('AI analysis returned an unexpected data format.');
}

// Placeholder for the text refiner (the one previously named invokeAITextRefiner without 'Internal')
// This is the one that was exported via the aiCopilotService object at the end of the original file
async function refineTextInternal(
  textToRefine: string,
  refinementInstructions: string
): Promise<{ refinedText: string }> {
  console.log('aiCopilotService.refineTextInternal called with:', { textToRefine, refinementInstructions });

  const requestBody = {
    snippet: textToRefine,
    command: refinementInstructions,
  };
  
  const { data, error } = await supabase.functions.invoke('ai-text-refiner', {
    body: requestBody,
  });

  if (error) {
    console.error('Error invoking ai-text-refiner function:', error);
    throw new Error(error.message || 'Failed to refine text with AI.');
  }

  if (!data || (data.success === false && data.error)) {
    console.error('AI text refinement function returned an error:', data?.error);
    const errorMessage = data?.error.message || data?.error;
    throw new Error(typeof errorMessage === 'string' ? errorMessage : 'AI text refinement failed on the backend.');
  }
  
  if (data.success === true && data.refinedText) {
     return { refinedText: data.refinedText };
  }

  console.warn('AI text refinement function response was not in the expected format:', data);
  throw new Error('AI text refinement returned an unexpected data format.');
}

export const aiCopilotService = {
  invokeAIDiscoveryAnalyzer: analyzeDiscoveryDocuments,
  invokeAITextRefiner: refineTextInternal,
}; 
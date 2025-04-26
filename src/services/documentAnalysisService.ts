import { supabase } from '../lib/supabaseClient';

// Maximum length for text chunks to avoid token limitations in AI analysis
const MAX_CHUNK_SIZE = 4000;

/**
 * Document Analysis Results
 */
export interface DocumentAnalysisResult {
  id: string;
  documentId: string;
  analysisType: 'summary' | 'entities' | 'sentiment' | 'clauses' | 'risks' | 'timeline' | 'custom';
  result: any;
  createdAt: string;
}

/**
 * Interface for document entities (people, organizations, dates, etc.)
 */
export interface DocumentEntity {
  type: 'person' | 'organization' | 'date' | 'location' | 'money' | 'percentage' | 'other';
  text: string;
  relevance: number; // 0-1 score
  startPosition?: number;
  endPosition?: number;
  metadata?: Record<string, any>;
}

/**
 * Interface for legal clauses found in documents
 */
export interface LegalClause {
  type: string; // e.g., "non-disclosure", "termination", "indemnification"
  text: string;
  startPosition?: number;
  endPosition?: number;
  riskLevel?: 'low' | 'medium' | 'high';
  analysis?: string;
}

/**
 * Interface for document summary
 */
export interface DocumentSummary {
  summary: string;
  keyPoints: string[];
  topicCategories: string[];
}

/**
 * Interface for document risk analysis
 */
export interface DocumentRiskAnalysis {
  riskScore: number; // 0-100
  riskLevel: 'low' | 'medium' | 'high';
  keyRisks: Array<{
    description: string;
    severity: 'low' | 'medium' | 'high';
    clauseReference?: string;
  }>;
  recommendations: string[];
}

/**
 * Split text into chunks of a maximum size
 * This is important for handling large documents that exceed token limits
 */
export const chunkDocumentText = (text: string, maxLength: number = MAX_CHUNK_SIZE): string[] => {
  // If text is smaller than max length, return as is
  if (text.length <= maxLength) {
    return [text];
  }

  const chunks: string[] = [];
  let currentIndex = 0;

  while (currentIndex < text.length) {
    // Try to find a natural break point near the max length
    let endIndex = Math.min(currentIndex + maxLength, text.length);
    
    // If we're not at the end, try to break at a paragraph or sentence
    if (endIndex < text.length) {
      // Look for paragraph breaks
      const paragraphBreak = text.lastIndexOf('\n\n', endIndex);
      if (paragraphBreak > currentIndex && paragraphBreak > endIndex - 500) {
        endIndex = paragraphBreak;
      } else {
        // Look for sentence breaks (period followed by space)
        const sentenceBreak = text.lastIndexOf('. ', endIndex);
        if (sentenceBreak > currentIndex && sentenceBreak > endIndex - 200) {
          endIndex = sentenceBreak + 1; // Include the period
        }
      }
    }

    // Add the chunk
    chunks.push(text.substring(currentIndex, endIndex));
    currentIndex = endIndex;
  }

  return chunks;
};

/**
 * Analyze a document using OpenAI for text analysis
 */
export const analyzeDocument = async (
  documentId: string,
  analysisType: 'summary' | 'entities' | 'sentiment' | 'clauses' | 'risks' | 'timeline' | 'custom',
  customPrompt?: string
): Promise<{ data: DocumentAnalysisResult | null; error: Error | null }> => {
  try {
    // Check if document exists and has extracted text
    const { data: document, error: docError } = await supabase
      .from('documents')
      .select('id, filename, extracted_text, processing_status')
      .eq('id', documentId)
      .single();

    if (docError || !document) {
      throw docError || new Error('Document not found');
    }

    if (document.processing_status !== 'completed' || !document.extracted_text) {
      throw new Error('Document text extraction is not complete');
    }

    // Chunk the document text
    const textChunks = chunkDocumentText(document.extracted_text);
    
    // Build prompt based on analysis type
    let prompt = '';
    let systemPrompt = '';
    
    switch (analysisType) {
      case 'summary':
        systemPrompt = 'You are a legal document analyzer specialized in creating concise summaries of legal documents.';
        prompt = `Please provide a summary of the following document, highlighting the key points and main topics. Format the summary in clear, well-structured paragraphs with headings for different sections where appropriate. Document: ${textChunks[0].substring(0, 3000)}`;
        if (textChunks.length > 1) {
          prompt += `\n\nNote: This is part 1 of ${textChunks.length} parts of the document.`;
        }
        break;
        
      case 'entities':
        systemPrompt = 'You are a legal entity extraction system that identifies people, organizations, dates, and locations in legal documents.';
        prompt = `Please identify and categorize all entities found in this legal document using the following categories:\n\n- People (individuals mentioned)\n- Organizations (companies, agencies, institutions)\n- Dates (all dates mentioned)\n- Locations (places, addresses, jurisdictions)\n- Legal Terms (specific legal terminology)\n- Financial Terms (monetary values, financial concepts)\n\nFor each category, list all relevant entities. Format your response with category headers followed by bullet points listing entities in that category. Document: ${textChunks[0].substring(0, 3000)}`;
        break;
        
      case 'clauses':
        systemPrompt = 'You are a legal clause identification system that identifies and analyzes legal clauses in contracts and agreements.';
        prompt = `Please identify all important legal clauses in this document. For each clause:\n\n1. Provide a descriptive title/type for the clause\n2. Quote or paraphrase the key text of the clause\n3. Include a brief analysis of its legal implications\n\nPresent each clause as a separate section with a clear header. Document: ${textChunks[0].substring(0, 3000)}`;
        break;
        
      case 'risks':
        systemPrompt = 'You are a legal risk analysis system that identifies potential legal risks in contracts and agreements.';
        prompt = `Please analyze this document for potential legal risks. For each identified risk:\n\n1. Provide a clear title for the risk\n2. Assign a severity level (Low, Medium, High, or Critical)\n3. Provide a detailed explanation of the risk\n\nFormat each risk as: **Risk Title** [Severity Level]: Explanation\n\nAlso include recommendations for mitigating the highest priority risks at the end. Document: ${textChunks[0].substring(0, 3000)}`;
        break;
        
      case 'timeline':
        systemPrompt = 'You are a legal timeline extraction system that identifies events, dates, and chronology in legal documents.';
        prompt = `Please extract a chronological timeline of events from this document. For each event:\n\n1. Identify the date (if available) in a standardized format\n2. Provide a concise description of what occurred\n3. Note any relevant parties involved\n\nFormat your response as separate event entries, with each event separated by two newlines. Start each entry with the date when available. Arrange events in chronological order. Document: ${textChunks[0].substring(0, 3000)}`;
        break;
        
      case 'sentiment':
        systemPrompt = 'You are a sentiment analysis system for legal documents that identifies the tone and attitude in legal language.';
        prompt = `Please analyze the sentiment in this legal document. Identify whether the language is favorable, neutral, or unfavorable to the parties involved. Include specific examples from the text that support your analysis. Document: ${textChunks[0].substring(0, 3000)}`;
        break;
        
      case 'custom':
        systemPrompt = 'You are a legal document analysis assistant.';
        prompt = customPrompt || 'Please analyze this legal document for insights.';
        prompt += ` Document: ${textChunks[0].substring(0, 3000)}`;
        break;
    }

    // If document has multiple chunks and this is a summary, use a different approach
    if (textChunks.length > 1 && analysisType === 'summary') {
      // For lengthy documents, we process chunks separately and then combine
      const chunkPromises = textChunks.map(async (chunk, index) => {
        const chunkPrompt = `Please summarize part ${index + 1} of ${textChunks.length} of the document: ${chunk}`;
        
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
          },
          body: JSON.stringify({
            model: 'gpt-4-turbo',
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: chunkPrompt }
            ],
            temperature: 0.1,
            max_tokens: 500
          })
        });
        
        if (!response.ok) {
          throw new Error(`OpenAI API error: ${response.status}`);
        }
        
        const data = await response.json();
        return data.choices[0].message.content;
      });
      
      try {
        // Process all chunk summaries in parallel
        const chunkSummaries = await Promise.all(chunkPromises);
        
        // Combine the chunk summaries into a final summary
        const finalSummaryPrompt = `I have divided a document into ${textChunks.length} parts and summarized each part. Please create a cohesive final summary based on these individual summaries:\n\n${chunkSummaries.join('\n\n')}`;
        
        const finalResponse = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
          },
          body: JSON.stringify({
            model: 'gpt-4-turbo',
            messages: [
              { role: 'system', content: 'You are a legal document analyzer that creates comprehensive summaries based on partial summaries.' },
              { role: 'user', content: finalSummaryPrompt }
            ],
            temperature: 0.1,
            max_tokens: 1000
          })
        });
        
        if (!finalResponse.ok) {
          throw new Error(`OpenAI API error: ${finalResponse.status}`);
        }
        
        const finalData = await finalResponse.json();
        const analysisResult = finalData.choices[0].message.content;
        
        // Store and return the final combined result
        const { data: analysisData, error: insertError } = await supabase
          .from('document_analyses')
          .insert({
            document_id: documentId,
            analysis_type: analysisType,
            result: analysisResult,
            created_at: new Date().toISOString()
          })
          .select()
          .single();
        
        if (insertError) {
          throw insertError;
        }
        
        // Return the analysis result
        const result: DocumentAnalysisResult = {
          id: analysisData.id,
          documentId: analysisData.document_id,
          analysisType: analysisData.analysis_type,
          result: analysisData.result,
          createdAt: analysisData.created_at
        };
        
        return { data: result, error: null };
      } catch (error) {
        console.error('Error processing multi-part document:', error);
        // Fall back to processing just the first chunk
      }
    }
    
    // For other analysis types or if multi-chunk processing failed, just use the first chunk
    
    // Call OpenAI
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4-turbo',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt }
        ],
        temperature: 0.1,
        max_tokens: analysisType === 'timeline' || analysisType === 'entities' ? 1500 : 1000
      })
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const aiResponse = await response.json();
    const analysisResult = aiResponse.choices[0].message.content;

    // Store analysis result in the database
    const { data: analysisData, error: insertError } = await supabase
      .from('document_analyses')
      .insert({
        document_id: documentId,
        analysis_type: analysisType,
        result: analysisResult,
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (insertError) {
      throw insertError;
    }

    // Return the analysis result
    const result: DocumentAnalysisResult = {
      id: analysisData.id,
      documentId: analysisData.document_id,
      analysisType: analysisData.analysis_type,
      result: analysisData.result,
      createdAt: analysisData.created_at
    };

    return { data: result, error: null };
  } catch (error) {
    console.error('Error analyzing document:', error);
    return { data: null, error: error as Error };
  }
};

/**
 * Get existing analysis results for a document
 */
export const getDocumentAnalyses = async (
  documentId: string,
  analysisType?: string
): Promise<{ data: DocumentAnalysisResult[] | null; error: Error | null }> => {
  try {
    let query = supabase
      .from('document_analyses')
      .select('*')
      .eq('document_id', documentId)
      .order('created_at', { ascending: false });

    if (analysisType) {
      query = query.eq('analysis_type', analysisType);
    }

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    if (!data) {
      return { data: [], error: null };
    }

    // Transform the data to match our interface
    const analysisResults: DocumentAnalysisResult[] = data.map((item) => ({
      id: item.id,
      documentId: item.document_id,
      analysisType: item.analysis_type,
      result: item.result,
      createdAt: item.created_at
    }));

    return { data: analysisResults, error: null };
  } catch (error) {
    console.error('Error getting document analyses:', error);
    return { data: null, error: error as Error };
  }
};

/**
 * Extract timeline events from a document
 * This is useful for legal cases where chronology is important
 * @deprecated Use analyzeDocument with 'timeline' type instead
 */
export const extractTimelineEvents = async (
  documentId: string
): Promise<{ data: any | null; error: Error | null }> => {
  try {
    // Check if document exists and has extracted text
    const { data: document, error: docError } = await supabase
      .from('documents')
      .select('id, filename, extracted_text, processing_status')
      .eq('id', documentId)
      .single();

    if (docError || !document) {
      throw docError || new Error('Document not found');
    }

    if (document.processing_status !== 'completed' || !document.extracted_text) {
      throw new Error('Document text extraction is not complete');
    }

    // Use OpenAI to extract timeline events
    const systemPrompt = 'You are a legal timeline extraction system that identifies events, dates, and chronology in legal documents.';
    const userPrompt = `Please extract a chronological timeline of events from the following document. For each event, provide the date (if available), a description of the event, and references to relevant people or organizations. Format the output as a JSON array. Document: ${document.extracted_text.substring(0, 3000)}`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4-turbo',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.1,
        max_tokens: 1000
      })
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const aiResponse = await response.json();
    const timelineResult = aiResponse.choices[0].message.content;

    // Parse the JSON response
    let parsedTimeline;
    try {
      parsedTimeline = JSON.parse(timelineResult);
    } catch (e) {
      // If the response isn't valid JSON, return the raw text
      parsedTimeline = { rawText: timelineResult };
    }

    // Store in database
    const { error: insertError } = await supabase
      .from('document_analyses')
      .insert({
        document_id: documentId,
        analysis_type: 'timeline',
        result: parsedTimeline,
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (insertError) {
      throw insertError;
    }

    return { data: parsedTimeline, error: null };
  } catch (error) {
    console.error('Error extracting timeline:', error);
    return { data: null, error: error as Error };
  }
};

import React from 'react';
import { DocumentAnalysisResult } from '../../services/documentAnalysisService';

interface RiskAssessmentProps {
  analysis: DocumentAnalysisResult;
}

/**
 * RiskAssessment component that visualizes risk analysis with color-coding
 * Parses the analysis result and categorizes risks by severity
 */
export const RiskAssessment: React.FC<RiskAssessmentProps> = ({ analysis }) => {
  if (!analysis || !analysis.result) {
    return <div className="p-4 bg-gray-800 rounded-md">No risk assessment available</div>;
  }

  try {
    // Try to parse risk assessment as structured data
    // This assumes the AI returns risks in a format we can parse
    const risksText = analysis.result;
    
    // Simple pattern matching for risk levels
    const highRiskPattern = /\b(high risk|critical|severe)\b/i;
    const mediumRiskPattern = /\b(medium risk|moderate|concerning)\b/i;
    const lowRiskPattern = /\b(low risk|minor|minimal)\b/i;
    
    // Split text into paragraphs/sections
    const sections = risksText.split('\n\n');
    
    return (
      <div className="space-y-4">
        {sections.map((section: string, index: number) => {
          // Determine risk level by pattern matching
          let riskLevel = 'Unspecified';
          let colorClass = 'bg-gray-700';
          let indicatorClass = 'bg-gray-500';
          
          if (highRiskPattern.test(section)) {
            riskLevel = 'High';
            colorClass = 'bg-red-900/50 border-l-4 border-red-600';
            indicatorClass = 'bg-red-700';
          } else if (mediumRiskPattern.test(section)) {
            riskLevel = 'Medium';
            colorClass = 'bg-yellow-900/50 border-l-4 border-yellow-600';
            indicatorClass = 'bg-yellow-700';
          } else if (lowRiskPattern.test(section)) {
            riskLevel = 'Low';
            colorClass = 'bg-green-900/50 border-l-4 border-green-600';
            indicatorClass = 'bg-green-700';
          }
          
          return (
            <div key={index} className={`p-3 rounded-md ${colorClass}`}>
              {riskLevel !== 'Unspecified' && (
                <div className="flex items-center mb-2">
                  <span className={`mr-2 inline-block w-3 h-3 rounded-full ${indicatorClass}`}></span>
                  <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                    riskLevel === 'High' ? 'bg-red-700 text-white' :
                    riskLevel === 'Medium' ? 'bg-yellow-700 text-white' :
                    'bg-green-700 text-white'
                  }`}>
                    {riskLevel} Risk
                  </span>
                </div>
              )}
              <div className="text-sm whitespace-pre-wrap">{section}</div>
            </div>
          );
        })}
      </div>
    );
  } catch {
    // Fallback to simple display if parsing fails
    return <div className="whitespace-pre-wrap">{analysis.result}</div>;
  }
};

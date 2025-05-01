import React from 'react';
import { RisksResult } from '@/services/documentAnalysisService';
import ReactMarkdown from 'react-markdown';

interface RiskAssessmentProps {
  analysisResult: RisksResult | null;
}

/**
 * RiskAssessment component that visualizes risk analysis with color-coding
 * Parses the analysis result and categorizes risks by severity
 */
export const RiskAssessment: React.FC<RiskAssessmentProps> = ({ analysisResult }) => {
  if (!analysisResult || !analysisResult.risks || analysisResult.risks.length === 0) {
    return <div className="p-4 text-muted-foreground italic">No specific risks identified.</div>;
  }

  const risks = analysisResult.risks;

  return (
    <div className="space-y-4">
      {risks.map((risk, index) => {
        const riskText = `${risk.title || ''} ${risk.explanation || ''}`.toLowerCase();
        let riskLevel = 'Unspecified';
        let colorClass = 'bg-gray-700 border-l-4 border-gray-500';
        let indicatorClass = 'bg-gray-500';
        let badgeClass = 'bg-gray-500 text-white';

        if (risk.severity === 'High' || riskText.includes('high risk') || riskText.includes('critical') || riskText.includes('severe')) {
          riskLevel = 'High';
          colorClass = 'bg-red-900/50 border-l-4 border-red-600';
          indicatorClass = 'bg-red-700';
          badgeClass = 'bg-red-700 text-white';
        } else if (risk.severity === 'Medium' || riskText.includes('medium risk') || riskText.includes('moderate') || riskText.includes('concerning')) {
          riskLevel = 'Medium';
          colorClass = 'bg-yellow-900/50 border-l-4 border-yellow-600';
          indicatorClass = 'bg-yellow-700';
          badgeClass = 'bg-yellow-700 text-white';
        } else if (risk.severity === 'Low' || riskText.includes('low risk') || riskText.includes('minor') || riskText.includes('minimal')) {
          riskLevel = 'Low';
          colorClass = 'bg-green-900/50 border-l-4 border-green-600';
          indicatorClass = 'bg-green-700';
          badgeClass = 'bg-green-700 text-white';
        }

        return (
          <div key={index} className={`p-4 rounded-md ${colorClass}`}>
            <div className="flex items-center mb-2">
              <span className={`mr-2 inline-block w-3 h-3 rounded-full ${indicatorClass}`}></span>
              <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${badgeClass}`}>
                {riskLevel} Risk
              </span>
            </div>
            {risk.title && (
                <div className="font-semibold text-text-primary mb-1">
                    <ReactMarkdown>{risk.title}</ReactMarkdown>
                </div>
            )}
            {risk.explanation && (
                <div className="text-sm text-text-secondary whitespace-pre-wrap">
                    <ReactMarkdown>{risk.explanation}</ReactMarkdown>
                </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

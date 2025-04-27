import React, { useState } from 'react';
import { InfoIcon } from './Icons';
import { Tooltip } from './Tooltip';

const MagicalInfoButton: React.FC = () => {
  const [showInfo, setShowInfo] = useState(false);
  return (
    <>
      <Tooltip content="About Paralegal AI & Quick Help">
        <button
          className="p-2 rounded-full text-white shadow-lg hover:scale-105 transition-transform duration-200 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-opacity-50 magical-gradient-animated"
          aria-label="About Paralegal AI"
          onClick={() => setShowInfo(true)}
          style={{ position: 'relative', overflow: 'hidden' }}
        >
          <span className="relative z-10">
            <InfoIcon className="h-5 w-5" color="url(#ai-gradient)" />
            <svg width="0" height="0">
              <defs>
                <linearGradient id="ai-gradient" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#F472B6" />
                  <stop offset="50%" stopColor="#A78BFA" />
                  <stop offset="100%" stopColor="#FDE68A" />
                </linearGradient>
              </defs>
            </svg>
          </span>
          {/* Animated gradient background */}
          <span className="absolute inset-0 z-0 magical-gradient-animated-bg" />
        </button>
      </Tooltip>
      {/* Info Popup */}
      {showInfo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60">
          <div className="relative bg-gradient-to-br from-gray-900 via-purple-900 to-yellow-900 border-4 border-primary rounded-2xl shadow-2xl p-8 max-w-lg w-full animate-fadeIn">
            <button
              className="absolute top-3 right-3 text-gray-300 hover:text-white focus:outline-none"
              aria-label="Close info popup"
              onClick={() => setShowInfo(false)}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <div className="flex flex-col items-center text-center">
              <div className="mb-4">
                <InfoIcon className="h-12 w-12" color="url(#ai-gradient)" />
              </div>
              <h2 className="text-2xl font-bold text-primary mb-2">Welcome to Paralegal AI</h2>
              <p className="text-lg text-white mb-4">Your magical AI-powered legal assistant for document analysis, drafting, and more.</p>
              <div className="mb-4">
                <h3 className="text-lg font-semibold text-pink-300 mb-1">What can you do here?</h3>
                <ul className="text-white text-left mx-auto max-w-xs list-disc list-inside space-y-1">
                  <li>Upload, analyze, and chat about legal documents</li>
                  <li>Use AI to extract key clauses, risks, and summaries</li>
                  <li>Draft new documents from smart templates</li>
                  <li>Organize cases and manage files</li>
                  <li>Get instant legal insights and suggestions</li>
                </ul>
              </div>
              <div className="mb-2">
                <h3 className="text-lg font-semibold text-yellow-300 mb-1">Quick Start</h3>
                <ul className="text-white text-left mx-auto max-w-xs list-disc list-inside space-y-1">
                  <li>Upload or select a document to begin</li>
                  <li>Ask questions or request analysis in chat</li>
                  <li>Try the Templates tab to draft new docs</li>
                </ul>
              </div>
              <div className="mt-4 text-xs text-gray-300">Paralegal AI is not a law firm and does not provide legal advice. For informational purposes only.</div>
            </div>
          </div>
        </div>
      )}
      {/* Animated gradient CSS */}
      <style>{`
        .magical-gradient-animated {
          background: linear-gradient(270deg, #F472B6, #A78BFA, #FDE68A, #F472B6);
          background-size: 600% 600%;
          animation: magical-gradient-move 4s linear infinite;
        }
        .magical-gradient-animated-bg {
          background: inherit;
          background-size: inherit;
          animation: inherit;
          opacity: 0.7;
          border-radius: 9999px;
        }
        @keyframes magical-gradient-move {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
      `}</style>
    </>
  );
};

export default MagicalInfoButton; 
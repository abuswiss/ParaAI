import React from 'react';
import { BarChart2, Globe, Search, MessageCircle, MagicWand } from 'lucide-react';

const howToUse = [
  {
    icon: <MessageCircle className="h-6 w-6 text-primary" />,
    title: 'Ask a Legal Question',
    desc: 'Type any legal question or prompt and get instant answers.',
    example: 'What are the key elements of a valid contract?'
  },
  {
    icon: <MagicWand className="h-6 w-6 text-purple-400" />,
    title: 'Use AI Legal Tools',
    desc: 'Type /agent to access powerful document and legal tools.',
    example: '/agent generate_timeline from [doc_id]'
  },
  {
    icon: <Search className="h-6 w-6 text-blue-400" />,
    title: 'Advanced Legal Research',
    desc: 'Type /research to search case law and legal sources with AI.',
    example: '/research Miranda rights'
  }
];

const HowToUsePanel: React.FC = () => (
  <div className="w-full max-w-2xl mx-auto bg-gray-900 border border-gray-800 rounded-xl shadow-lg p-6 mb-6 flex flex-col gap-4">
    <h2 className="text-lg font-semibold text-text-primary mb-2 text-center">How to use the Paralegal AI Assistant</h2>
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {howToUse.map((item, idx) => (
        <div key={idx} className="flex flex-col items-center text-center p-3 bg-gray-800 rounded-lg h-full">
          <div className="mb-2">{item.icon}</div>
          <div className="font-medium text-text-primary mb-1">{item.title}</div>
          <div className="text-gray-400 text-sm mb-2">{item.desc}</div>
          <div className="bg-gray-700 text-primary text-xs px-2 py-1 rounded font-mono select-all">{item.example}</div>
        </div>
      ))}
    </div>
  </div>
);

export default HowToUsePanel; 
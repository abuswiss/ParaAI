import React from 'react';
import { Button, Icons } from '../ui';
import { motion } from 'framer-motion';

interface PromptSuggestionProps {
  text: string;
  onClick: () => void;
  icon?: React.ReactNode;
  type?: 'document' | 'summary' | 'timeline' | 'draft' | 'search' | 'default';
}

const PromptSuggestion: React.FC<PromptSuggestionProps> = ({ text, onClick, icon, type = 'default' }) => {
  // Determine which icon to use based on type if no custom icon is provided
  const getIconByType = () => {
    if (icon) return icon;
    
    switch (type) {
      case 'document':
        return <Icons.Document size={16} className="text-primary" />;
      case 'summary':
        return <Icons.FileText size={16} className="text-primary" />;
      case 'timeline':
        return <Icons.Clock size={16} className="text-primary" />;
      case 'draft':
        return <Icons.Edit size={16} className="text-primary" />;
      case 'search':
        return <Icons.Info size={16} className="text-primary" />;
      default:
        return <Icons.Message size={16} className="text-primary" />;
    }
  };
  return (
    <Button 
      onClick={onClick} 
      variant="outline"
      size="md"
      isFullWidth
      className="text-left justify-start p-3 h-auto relative overflow-hidden"
      animateOnHover
    >
      <div className="flex items-center relative z-10">
        <span className="mr-2">{getIconByType()}</span>
        <span className="text-sm font-medium text-text-primary">{text}</span>
      </div>
      <motion.div 
        className="absolute inset-0 bg-gradient-to-r from-primary/0 to-primary/10 pointer-events-none"
        initial={{ opacity: 0 }}
        whileHover={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
      />
      <motion.div 
        className="absolute inset-x-0 bottom-0 h-[2px] bg-primary/50"
        initial={{ scaleX: 0 }}
        whileHover={{ scaleX: 1 }}
        style={{ originX: 0 }}
        transition={{ duration: 0.3 }}
      />
    </Button>
  );
};

export default PromptSuggestion;

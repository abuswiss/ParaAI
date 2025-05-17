import React from 'react';
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Animated skeleton loader for AI responses
 * Displays a visual placeholder while waiting for AI responses to stream in
 */
const ChatSkeletonLoader: React.FC = () => {
  return (
    <div className="flex justify-start w-full mb-6">
      <div className="bg-card/70 dark:bg-dark-card/70 backdrop-blur-md border border-card-border dark:border-dark-card-border p-4 rounded-lg w-full max-w-[80%] space-y-3">
        <div className="flex items-center space-x-2 mb-2">
          <Skeleton className="h-4 w-24" />
        </div>
        
        {/* First paragraph - longer */}
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-[90%]" />
        
        {/* Some space between paragraphs */}
        <div className="h-2" />
        
        {/* Second paragraph - medium */}
        <Skeleton className="h-4 w-[95%]" />
        <Skeleton className="h-4 w-[85%]" />
        
        {/* Some space between paragraphs */}
        <div className="h-2" />
        
        {/* Third paragraph - shorter */}
        <Skeleton className="h-4 w-[70%]" />
        <Skeleton className="h-4 w-[60%]" />
        
        {/* Final element - like a potential link or citation */}
        <div className="mt-4">
          <Skeleton className="h-4 w-[40%]" />
        </div>
      </div>
    </div>
  );
};

export default ChatSkeletonLoader;

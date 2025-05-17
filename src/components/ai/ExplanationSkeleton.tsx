import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/Skeleton'; // Assuming this exists

const ExplanationSkeleton: React.FC = () => {
  return (
    <Card className="max-w-2xl mx-auto mt-6 shadow-sm">
      <CardHeader>
        {/* Skeleton for the title: "Explanation for "[term]"" */}
        <Skeleton className="h-6 w-3/4 mb-2" /> 
        <Skeleton className="h-4 w-1/2" />
      </CardHeader>
      <CardContent className="pt-4 space-y-3">
        {/* Skeleton for paragraphs of text */}
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-4/5" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
      </CardContent>
    </Card>
  );
};

export default ExplanationSkeleton; 
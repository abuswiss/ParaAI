"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { useAtom } from 'jotai';
import { activeCaseIdAtom } from '@/atoms/appAtoms';
import * as caseService from '@/services/caseService';
import { Case } from '@/types/case';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";

const CaseSelector: React.FC = () => {
  const [activeCaseId, setActiveCaseId] = useAtom(activeCaseIdAtom);
  const [cases, setCases] = useState<Case[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchCases = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const { data, error: fetchError } = await caseService.getUserCases();
        if (fetchError) throw fetchError;
        setCases(data || []);
        // If no case is active, and there are cases, maybe select the first one?
        // Or leave it as null/undefined if you want explicit selection
        // if (!activeCaseId && data && data.length > 0) {
        //   setActiveCaseId(data[0].id);
        // }
      } catch (err) {
        console.error("Error fetching cases for selector:", err);
        setError("Failed to load cases.");
      } finally {
        setIsLoading(false);
      }
    };
    fetchCases();
  }, [setActiveCaseId]); // Dependency ensures setActiveCaseId is stable

  const handleValueChange = (value: string) => {
    // Check if the value is for clearing selection or a valid case ID
    if (value === "__none__") {
        setActiveCaseId(null); // Or handle as needed
    } else {
        setActiveCaseId(value);
    }
  };

  // Memoize the selected case name to avoid recalculating on every render
  const selectedCaseName = useMemo(() => {
    if (!activeCaseId) return "Select a case...";
    return cases.find(c => c.id === activeCaseId)?.name || "Select a case...";
  }, [activeCaseId, cases]);

  if (isLoading) {
    return <Skeleton className="h-9 w-full" />;
  }

  if (error) {
    return <div className="text-xs text-destructive p-2 text-center">{error}</div>;
  }

  return (
    <Select 
        value={activeCaseId || "__none__"} // Use a placeholder value if null/undefined
        onValueChange={handleValueChange}
    >
      <SelectTrigger className="w-full h-9 text-sm truncate">
        <SelectValue placeholder="Select a case...">
            {selectedCaseName} 
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {/* Optional: Add an item to represent "No Case Selected" if needed */}
        {/* <SelectItem value="__none__">-- No Case Selected --</SelectItem> */} 
        {cases.length === 0 ? (
          <div className="p-2 text-sm text-muted-foreground text-center italic">
            No cases found.
          </div>
        ) : (
          cases.map((caseItem) => (
            <SelectItem key={caseItem.id} value={caseItem.id} className="text-sm">
              {caseItem.name}
            </SelectItem>
          ))
        )}
      </SelectContent>
    </Select>
  );
};

export default CaseSelector; 
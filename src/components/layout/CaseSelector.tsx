"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
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
  
  // Define all hooks at the top level before any conditional logic
  // Prevent event propagation to keep sidebar open when interacting with dropdown
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
  }, []);

  const handleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    // Mark the dropdown as active to prevent sidebar collapse
    const parentElement = document.querySelector('[data-open-state="open"]');
    if (parentElement) {
      parentElement.setAttribute('data-dropdown-active', 'true');
      // Remove this attribute when clicked outside
      const removeAttribute = () => {
        parentElement.removeAttribute('data-dropdown-active');
        document.removeEventListener('click', removeAttribute);
      };
      // Add with slight delay to avoid immediate removal
      setTimeout(() => {
        document.addEventListener('click', removeAttribute);
      }, 100);
    }
  }, []);

  useEffect(() => {
    const fetchCases = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const { data, error: fetchError } = await caseService.getUserCases();
        if (fetchError) throw fetchError;
        setCases(data || []);
      } catch (err) {
        console.error("Error fetching matters for selector:", err);
        setError("Failed to load matters.");
      } finally {
        setIsLoading(false);
      }
    };
    fetchCases();
  }, []);  // Removed setActiveCaseId from dependency array as it's not used in the effect

  const handleValueChange = (value: string) => {
    if (value === "__none__") {
        setActiveCaseId(null);
    } else {
        setActiveCaseId(value);
    }
  };

  const selectedCaseName = useMemo(() => {
    if (!activeCaseId) return "Select a matter...";
    return cases.find(c => c.id === activeCaseId)?.name || "Select a matter...";
  }, [activeCaseId, cases]);

  if (isLoading) {
    return <Skeleton className="h-9 w-full" />;
  }

  if (error) {
    return <div className="text-xs text-destructive p-2 text-center">{error}</div>;
  }

  // Event handlers were moved to the top of the component to maintain hooks order

  return (
    <Select 
        value={activeCaseId || "__none__"} 
        onValueChange={handleValueChange}
    >
      <SelectTrigger 
        className="w-full h-9 text-sm truncate"
        onMouseDown={handleMouseDown}
        onClick={handleClick}
      >
        <SelectValue placeholder="Select a matter...">
            {selectedCaseName} 
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {cases.length === 0 ? (
          <div className="p-2 text-sm text-muted-foreground text-center italic">
            No matters found.
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
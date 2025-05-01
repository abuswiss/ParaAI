import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Placeholder regex - Adjust based on the actual format used in templates 
// (e.g., %%[Variable Name]%%, {{variable_name}}, etc.)
const PLACEHOLDER_REGEX = /%%\s*\[(.*?)\]\s*%%/g;

/**
 * Extracts unique variable names from template content based on a regex.
 * @param content The template content (string).
 * @returns An array of unique variable names.
 */
export const extractVariables = (content: string): string[] => {
    if (!content) return [];
    const found = new Set<string>();
    let match;
    PLACEHOLDER_REGEX.lastIndex = 0; // Reset regex state
    while ((match = PLACEHOLDER_REGEX.exec(content)) !== null) {
      const variableName = match[1]?.trim(); 
      if (variableName) {
        found.add(variableName);
      }
    }
    return Array.from(found);
};

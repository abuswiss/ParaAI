import { Case } from '@/types/case';

/**
 * Type definition for an extracted variable from a template
 */
export interface ExtractedVariable {
  name: string;         // The name of the variable (e.g., "client_name")
  placeholder: string;  // The full placeholder text (e.g., "{{client_name}}")
}

/**
 * Type definition for variable state during prefilling/editing
 */
export interface TemplateVariableState {
  name: string;                 // The name of the variable
  value: string | null;         // Current value (prefilled or user-entered)
  status: 'pending' | 'prefilled' | 'missing' | 'user-filled';  // Status of the variable
  originalPlaceholder: string;  // The original placeholder text for accurate replacement
}

/**
 * Extract variables from template content
 * @param content HTML content with variables in {{variable_name}} format
 * @returns Array of extracted variables with their names and original placeholders
 */
export function extractVariables(content: string): ExtractedVariable[] {
  // Regex to match {{variable_name}} patterns, allowing for spacing
  const regex = /\{\{\s*([^}]+?)\s*\}\}/g;
  const matches = Array.from(content.matchAll(regex));
  
  // Use a Set to deduplicate variable names
  const uniqueVars = new Map<string, ExtractedVariable>();
  
  for (const match of matches) {
    const fullMatch = match[0]; // e.g., "{{ client_name }}"
    const varName = match[1].trim(); // e.g., "client_name"
    
    if (!uniqueVars.has(varName)) {
      uniqueVars.set(varName, {
        name: varName,
        placeholder: fullMatch
      });
    }
  }
  
  return Array.from(uniqueVars.values());
}

/**
 * Map a variable name to a case property path
 * This function maps template variable names to case object properties
 * 
 * @param variableName The name of the variable to map
 * @returns A property path to use with case data
 */
function mapVariableToPropertyPath(variableName: string): string[] {
  // Remove any prefixes like 'case.' or 'client.'
  const cleanVarName = variableName.replace(/^(case|client)\./, '');
  
  // Handle special case mappings
  const specialMappings: Record<string, string[]> = {
    'client_name': ['client', 'name'],
    'client_email': ['client', 'email'],
    'client_phone': ['client', 'phone'],
    'client_address': ['client', 'address'],
    'case_number': ['caseNumber'],
    'case_name': ['name'],
    'case_description': ['description'],
    'case_date': ['createdAt'],
    'judge_name': ['judge', 'name'],
    'court_name': ['court', 'name'],
    'opposing_party': ['opposingParty', 'name'],
    'opposing_counsel': ['opposingCounsel', 'name'],
    // Add more mappings as needed
  };
  
  // Return the special mapping if it exists
  if (specialMappings[cleanVarName]) {
    return specialMappings[cleanVarName];
  }
  
  // Otherwise split by underscore and return as a path
  return cleanVarName.split('_');
}

/**
 * Get a value from an object using a property path
 * 
 * @param obj The object to extract from
 * @param path Array of property names forming a path
 * @returns The value at the specified path or undefined
 */
function getValueByPath(obj: any, path: string[]): any {
  return path.reduce((current, key) => 
    current && typeof current === 'object' ? current[key] : undefined, 
    obj
  );
}

/**
 * Format a value for template display
 * Handles different types of values (dates, objects, etc.)
 * 
 * @param value The value to format
 * @returns A formatted string
 */
function formatValue(value: any): string {
  if (value === undefined || value === null) {
    return '';
  }
  
  if (value instanceof Date) {
    return value.toLocaleDateString();
  }
  
  if (typeof value === 'object') {
    // Try to provide a meaningful string representation
    return JSON.stringify(value);
  }
  
  return String(value);
}

/**
 * Prefill variables in a template using case data
 * 
 * @param content The original template content
 * @param caseData The case data for prefilling
 * @param extractedVariables Array of variables to prefill
 * @returns Object containing updated content and variable states
 */
export function prefillVariables(
  content: string, 
  caseData: Case, 
  extractedVariables: ExtractedVariable[]
): { 
  content: string; 
  variableStates: TemplateVariableState[] 
} {
  let processedContent = content;
  const variableStates: TemplateVariableState[] = [];
  
  for (const variable of extractedVariables) {
    // Get the property path for this variable
    const propertyPath = mapVariableToPropertyPath(variable.name);
    
    // Extract value from case data using the property path
    const value = getValueByPath(caseData, propertyPath);
    
    // Format the value as a string
    const formattedValue = formatValue(value);
    
    // Determine the status
    const status = formattedValue ? 'prefilled' : 'missing';
    
    // Store the variable state
    variableStates.push({
      name: variable.name,
      value: formattedValue || null,
      status,
      originalPlaceholder: variable.placeholder
    });
    
    // Replace the placeholder in the content if we have a value
    if (formattedValue) {
      processedContent = processedContent.replace(
        variable.placeholder, 
        formattedValue
      );
    }
  }
  
  return { 
    content: processedContent, 
    variableStates 
  };
}

/**
 * Final resolution of variables in a template
 * Replaces all placeholders with their values
 * 
 * @param content The original template content
 * @param variables Array of variable states with values
 * @returns The fully resolved content
 */
export function resolveVariables(
  content: string, 
  variables: TemplateVariableState[]
): string {
  return variables.reduce((result, variable) => {
    // Skip variables without values
    if (!variable.value) return result;
    
    // Replace all instances of the placeholder with the value
    return result.replace(
      new RegExp(escapeRegExp(variable.originalPlaceholder), 'g'), 
      variable.value
    );
  }, content);
}

/**
 * Escape special characters in a string for use in a regular expression
 */
function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Handles template selection and navigation to the editor
 * @param navigate - React Router navigate function
 * @param templateId - ID of the selected template
 * @param activeCaseId - Current active case ID (or null if none)
 * @param onComplete - Optional callback after successful navigation
 * @returns boolean indicating if navigation was successful
 */
export const useTemplate = (
  navigate: any,
  templateId: string,
  activeCaseId: string | null,
  onComplete?: () => void
): boolean => {
  if (!activeCaseId) {
    return false;
  }
  
  navigate(`/edit/document/new?templateId=${templateId}&caseId=${activeCaseId}`);
  
  if (onComplete) {
    onComplete();
  }
  
  return true;
}; 
import { Case } from '@/types/case';
import { JSONContent, Editor, Mark } from '@tiptap/react'; // Import Tiptap JSON type, Editor, Mark
import { toast } from 'sonner'; // Import toast for messages

/**
 * Type definition for variable state during prefilling/editing
 */
export interface TemplateVariableState {
  name: string;                 
  value: string | null;         
  status: 'pending' | 'prefilled' | 'missing' | 'user-filled';  
  position?: { from: number; to: number }; // ADDED: Optional position
}

interface TiptapNode {
  type: string;
  attrs?: Record<string, any>;
  content?: TiptapNode[];
  marks?: TiptapMark[];
  text?: string;
}

interface TiptapMark {
  type: string;
  attrs?: Record<string, any>;
}

/**
 * Represents a variable extracted from Tiptap JSON content.
 */
export interface JsonExtractedVariable {
  name: string;
  description?: string | null; // Add optional description
  position: { from: number; to: number }; // ADDED: Position of the mark
}

// Renamed from getNodeFlatSize and refined for accuracy
function getNodeSize(node: TiptapNode): number {
  if (typeof node.text === 'string') {
    return node.text.length; // Text node size is its length
  }
  if (node.content && Array.isArray(node.content)) {
    // Element node: 1 (for opening tag) + sum of children sizes + 1 (for closing tag)
    let contentSize = 0;
    for (const child of node.content) {
      contentSize += getNodeSize(child);
    }
    return 1 + contentSize + 1;
  }
  // Leaf node (e.g., horizontalRule, image) or unknown type
  return 1; 
}

function findVariablesInNode(
  node: TiptapNode,
  foundVariables: Map<string, JsonExtractedVariable>,
  currentPos: number // currentPos is the starting position of *this* node
) {
  if (node.type === 'text' && node.text && node.marks) {
    for (const mark of node.marks) {
      if (mark.type === 'variable' && mark.attrs && mark.attrs['data-variable-name']) {
        const variableName = mark.attrs['data-variable-name'];
        const variableDescription = mark.attrs['data-variable-description'] || null;
        if (!foundVariables.has(variableName)) {
          // Position of the variable mark is the text node's position range
          const from = currentPos;
          const to = currentPos + node.text.length;
          foundVariables.set(variableName, { 
            name: variableName, 
            description: variableDescription,
            position: { from, to }
          });
        }
      }
    }
  }

  if (node.content && Array.isArray(node.content)) {
    let childNodePos = currentPos + 1; // Content starts after the parent node's opening tag
    for (const childNode of node.content) {
      findVariablesInNode(childNode, foundVariables, childNodePos);
      childNodePos += getNodeSize(childNode); // Advance position by the size of the processed child
    }
  }
}

/**
 * Extracts variables defined by VariableMark from Tiptap JSON content.
 * @param jsonContent Tiptap document content in JSON format.
 * @returns Array of unique extracted variable names and their positions.
 */
export function extractVariablesFromJson(jsonContent: JSONContent): JsonExtractedVariable[] {
  const foundVariables = new Map<string, JsonExtractedVariable>();
  if (jsonContent && jsonContent.type === 'doc' && Array.isArray(jsonContent.content)) {
    // The document itself is a node. Its content starts at position 1.
    // Iterate through the top-level children of the 'doc' node.
    let currentPos = 1; // ProseMirror positions are 1-indexed within the document content
    for (const childNode of jsonContent.content) {
      findVariablesInNode(childNode as TiptapNode, foundVariables, currentPos);
      currentPos += getNodeSize(childNode as TiptapNode);
    }
  } else if (jsonContent) {
    // Fallback for a single node that is not a 'doc' - though typically jsonContent is a doc.
    // This path is less common for full documents.
    // Treat the jsonContent itself as the first node starting at an assumed pos 1 if it's not a doc.
    // This might need adjustment based on how non-doc JSONContent is structured/used.
    // For safety, we can wrap it in a conceptual doc if it's not one.
    // However, prefillVariableStates usually gets a full doc.
    // If jsonContent is a single node, its own position relative to a doc is 1.
    findVariablesInNode(jsonContent as TiptapNode, foundVariables, 1);
  }
  return Array.from(foundVariables.values());
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
 * Prefill variable states based on Tiptap JSON content and case data.
 * This function EXTRACTS variables from JSON and finds corresponding Case data,
 * but it DOES NOT modify the editor content directly.
 * 
 * @param jsonContent The Tiptap JSON document content.
 * @param caseData The case data for prefilling.
 * @returns Array of variable states with prefilled values where possible.
 */
export function prefillVariableStates(
  jsonContent: JSONContent | null, 
  caseData: Case | null, 
): TemplateVariableState[] {
  if (!caseData || !jsonContent) return [];
  
  const extractedVariables = extractVariablesFromJson(jsonContent);
  const variableStates: TemplateVariableState[] = [];
  
  for (const variable of extractedVariables) {
    const propertyPath = mapVariableToPropertyPath(variable.name);
    const value = getValueByPath(caseData, propertyPath);
    const formattedValue = formatValue(value);
    const status = formattedValue ? 'prefilled' : 'missing';
    
    variableStates.push({
      name: variable.name,
      value: formattedValue || null,
      status,
      position: variable.position, // STORE POSITION
    });
  }
  
  return variableStates;
}

/**
 * Handles template selection and navigation for creating a document FROM a template.
 * @param navigate - React Router navigate function
 * @param templateId - ID of the selected template
 * @param activeCaseId - Current active case ID (must be provided)
 * @param onComplete - Optional callback after successful navigation
 * @returns boolean indicating if navigation was successful or if prerequisites were missing
 */
export const createDocumentFromTemplate = (
  navigate: (path: string, options?: { replace?: boolean; state?: any }) => void, // More specific type for navigate
  templateId: string,
  activeCaseId: string | null,
  onComplete?: () => void
): boolean => {
  if (!activeCaseId) {
    toast.warning("Please select an active case before creating a document from a template.");
    return false;
  }
  if (!templateId) {
    toast.warning("No template selected to create a document from.");
    return false;
  }
  
  // Navigate to the template filling page, which handles document creation.
  // Pass activeCaseId as a query parameter so the fill page can use it.
  navigate(`/ai/templates/${templateId}/fill?caseId=${activeCaseId}`);
  
  if (onComplete) {
    onComplete();
  }
  
  return true;
}; 
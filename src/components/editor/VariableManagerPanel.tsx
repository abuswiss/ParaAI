import React, { useState, useEffect, useCallback } from 'react';
import { Editor } from '@tiptap/react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Label } from '@/components/ui/Label';
import { extractVariablesFromJson, JsonExtractedVariable, TiptapNode } from '@/lib/templateUtils';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { toast } from 'sonner';
import { Transaction } from '@tiptap/pm/state';
import { Textarea } from '@/components/ui/Textarea';

interface VariableManagerPanelProps {
  editor: Editor | null;
}

interface EditableVariable extends JsonExtractedVariable {
  newName: string;
  newDescription: string;
  isEditing: boolean;
}

export const VariableManagerPanel: React.FC<VariableManagerPanelProps> = ({ editor }) => {
  const [variables, setVariables] = useState<EditableVariable[]>([]);

  // Function to extract variables from editor JSON
  const refreshVariables = useCallback(() => {
    if (!editor) return;
    try {
      const jsonContent = editor.getJSON();
      const extracted = extractVariablesFromJson(jsonContent);
      // Initialize state for editing, including description
      setVariables(extracted.map(v => ({ 
        ...v, 
        newName: v.name, 
        newDescription: v.description || '', // Default to empty string
        isEditing: false 
      })));
    } catch (error) {
      console.error("Error extracting variables from JSON:", error);
      toast.error("Failed to load variables from editor content.");
      setVariables([]);
    }
  }, [editor]);

  // Refresh variables when editor content changes
  useEffect(() => {
    if (!editor) return;

    const handleUpdate = () => {
      refreshVariables();
    };

    editor.on('update', handleUpdate);
    // Initial load
    refreshVariables();

    return () => {
      editor.off('update', handleUpdate);
    };
  }, [editor, refreshVariables]);

  // Renamed from handleRename to handleUpdateVariable
  const handleUpdateVariable = (oldName: string, newName: string, newDescription: string) => {
    if (!editor) return;

    const trimmedNewName = newName.trim();
    const trimmedNewDescription = newDescription.trim();

    if (!trimmedNewName) {
      toast.error("Variable name cannot be empty.");
      // Revert UI if name is invalid
      setVariables(vars => vars.map(v => v.name === oldName ? { ...v, isEditing: false, newName: v.name, newDescription: v.description || '' } : v));
      return;
    }

    // Validation: Check if the new name already exists (and is not the current variable)
    const otherVariables = variables.filter(v => v.name !== oldName);
    if (otherVariables.some(v => v.name === trimmedNewName)) {
      toast.error(`Variable name "${trimmedNewName}" already exists. Please choose a unique name.`);
      // Revert UI
      setVariables(vars => vars.map(v => v.name === oldName ? { ...v, isEditing: false, newName: v.name, newDescription: v.description || '' } : v));
      return;
    }

    // Check if anything actually changed
    const currentVar = variables.find(v => v.name === oldName);
    if (currentVar && currentVar.name === trimmedNewName && (currentVar.description || '') === trimmedNewDescription) {
        // Nothing changed, just exit edit mode
        setVariables(vars => vars.map(v => v.name === oldName ? { ...v, isEditing: false } : v));
        return;
    }

    let transaction: Transaction | null = null;
    let modified = false;

    try {
        transaction = editor.state.tr;

        editor.state.doc.descendants((node, pos) => {
            if (!node.isText || !node.marks) return true; // Continue descent if not text or no marks

            let markModifiedInNode = false;
            const updatedMarks = node.marks.map(mark => {
                if (mark.type.name === 'variable' && mark.attrs['data-variable-name'] === oldName) {
                    // Create a new mark with the updated name and description
                    const newMark = editor.schema.marks.variable.create({ 
                        'data-variable-name': trimmedNewName,
                        'data-variable-description': trimmedNewDescription || null // Save null if empty
                    });
                    markModifiedInNode = true;
                    modified = true; // Mark transaction as modified
                    return newMark;
                }
                return mark;
            });

            // Apply the changes if modified
            if (markModifiedInNode && transaction) {
                // Use replaceWith to replace the node with a new one having the updated marks
                // This is often more reliable than addMark/removeMark for complex cases.
                 const newNode = node.type.create(node.attrs, node.content, updatedMarks);
                 transaction = transaction.replaceWith(pos, pos + node.nodeSize, newNode);
                 // Returning false stops descending into this node's children as it was replaced
                 return false; 
            }
            return true; // Continue descent
        });
        
        if (modified && transaction) {
            editor.view.dispatch(transaction);
            toast.success(`Variable "${oldName}" updated successfully.`);
            // Refresh the list from the updated editor state *after* dispatch
             requestAnimationFrame(() => refreshVariables()); 
        } else {
            // If no changes were needed (e.g., variable not found), just exit edit mode
             setVariables(vars => vars.map(v => v.name === oldName ? { ...v, isEditing: false } : v));
             if (!modified) {
                toast.info("No changes detected for variable.");
             }
        }

    } catch (error) {
        console.error("Error updating variable:", error);
        toast.error("An error occurred while updating the variable.");
        // Revert UI on error
        setVariables(vars => vars.map(v => v.name === oldName ? { ...v, isEditing: false, newName: v.name, newDescription: v.description || '' } : v));
    }
  };

  const handleInputChange = (index: number, field: 'name' | 'description', value: string) => {
    setVariables(vars => vars.map((v, i) => {
      if (i === index) {
        return field === 'name' ? { ...v, newName: value } : { ...v, newDescription: value };
      }
      return v;
    }));
  };

  const toggleEditMode = (index: number, edit: boolean) => {
    // If exiting edit mode, trigger the save/update
    if (!edit) {
        const variable = variables[index];
        handleUpdateVariable(variable.name, variable.newName, variable.newDescription);
    } else {
        // Entering edit mode
        setVariables(vars => vars.map((v, i) => i === index ? { ...v, isEditing: edit, newName: v.name, newDescription: v.description || '' } : v));
    }
  };

  if (!editor) {
    return <p>Loading editor...</p>;
  }

  return (
    <Card className="h-full flex flex-col bg-card dark:bg-dark-card text-card-foreground dark:text-dark-card-foreground backdrop-blur-md border border-card-border dark:border-dark-card-border">
      <CardHeader>
        <CardTitle>Template Variables</CardTitle>
      </CardHeader>
      <CardContent className="flex-1 overflow-hidden p-0">
        <ScrollArea className="h-full p-4">
          {variables.length === 0 ? (
            <p className="text-sm text-muted-foreground">No variables defined yet. Select text in the editor and use the toolbar to mark it as a variable.</p>
          ) : (
            <ul className="space-y-4">
              {variables.map((variable, index) => (
                <li key={variable.name} className="p-3 border border-border dark:border-dark-border rounded-md bg-muted/50 dark:bg-dark-muted/50 shadow-sm">
                  {variable.isEditing ? (
                    <div className="space-y-2">
                      <div>
                        <Label htmlFor={`var-name-${index}`} className="text-xs font-medium text-card-foreground dark:text-dark-card-foreground">Name</Label>
                        <Input
                          id={`var-name-${index}`}
                          type="text"
                          value={variable.newName}
                          onChange={(e) => handleInputChange(index, 'name', e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') toggleEditMode(index, false);
                            if (e.key === 'Escape') toggleEditMode(index, false);
                          }}
                          autoFocus
                          className="h-8 mt-1"
                        />
                      </div>
                      <div>
                        <Label htmlFor={`var-desc-${index}`} className="text-xs font-medium text-card-foreground dark:text-dark-card-foreground">Description (Optional)</Label>
                        <Textarea
                          id={`var-desc-${index}`}
                          value={variable.newDescription}
                          onChange={(e) => handleInputChange(index, 'description', e.target.value)}
                          placeholder="Enter a short description..."
                          rows={2}
                          className="mt-1 text-sm"
                          onKeyDown={(e) => {
                              if (e.key === 'Enter' && !e.shiftKey) { // Save on Enter unless Shift is pressed
                                  e.preventDefault();
                                  toggleEditMode(index, false);
                              }
                              if (e.key === 'Escape') toggleEditMode(index, false);
                          }}
                        />
                      </div>
                       <Button variant="primary" size="sm" onClick={() => toggleEditMode(index, false)} className="mt-2">Save Changes</Button>
                    </div>
                  ) : (
                    <div className="space-y-1 cursor-pointer group" onClick={() => toggleEditMode(index, true)}>
                      <span className="font-mono text-sm font-medium text-primary dark:text-dark-primary group-hover:underline">
                        {variable.name}
                      </span>
                      <p className="text-xs text-muted-foreground dark:text-dark-muted-foreground">
                        {variable.description || <span className="italic">No description. Click to add.</span>}
                      </p>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
};

import React, { createContext, useState, useEffect, useCallback, useContext, ReactNode } from 'react';
import { Editor } from '@tiptap/react';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import { Plugin, PluginKey } from '@tiptap/pm/state';
// Import the widget component we will create next
// import { SuggestionWidgetComponent } from './SuggestionWidgetComponent'; 

// 1. Define State and Context Types
interface SuggestionState {
  isActive: boolean;
  originalRange: { from: number; to: number } | null;
  originalText: string | null;
  suggestionText: string | null;
}

interface SuggestionContextType {
  suggestionState: SuggestionState;
  suggestionDecorations: DecorationSet;
  triggerSuggestion: (range: { from: number; to: number }, original: string, suggestion: string) => void;
  acceptSuggestion: () => void;
  rejectSuggestion: () => void;
}

// 2. Create Context
const InlineSuggestionContext = createContext<SuggestionContextType | null>(null);

// 3. Create Provider Component
interface InlineSuggestionProviderProps {
  children: ReactNode;
  editor: Editor | null; // Pass the editor instance
}

export const InlineSuggestionProvider: React.FC<InlineSuggestionProviderProps> = ({ children, editor }) => {
  const [suggestionState, setSuggestionState] = useState<SuggestionState>({
    isActive: false,
    originalRange: null,
    originalText: null,
    suggestionText: null,
  });
  const [suggestionDecorations, setSuggestionDecorations] = useState<DecorationSet>(DecorationSet.empty);

  // --- Handler Functions ---
  const triggerSuggestion = useCallback((range: { from: number; to: number }, original: string, suggestion: string) => {
    console.log("Triggering suggestion:", { range, original, suggestion });
    setSuggestionState({
      isActive: true,
      originalRange: range,
      originalText: original,
      suggestionText: suggestion,
    });
  }, []);

  const clearSuggestionState = useCallback(() => {
     console.log("Clearing suggestion state");
     setSuggestionState({
        isActive: false,
        originalRange: null,
        originalText: null,
        suggestionText: null,
     });
  }, []);

  const acceptSuggestion = useCallback(() => {
    if (!editor || !suggestionState.isActive || !suggestionState.originalRange || suggestionState.suggestionText === null) return;
    console.log("Accepting suggestion");
    
    editor.chain().focus()
      .insertContentAt(suggestionState.originalRange, suggestionState.suggestionText)
      .run();
      
    clearSuggestionState();
  }, [editor, suggestionState, clearSuggestionState]);

  const rejectSuggestion = useCallback(() => {
    console.log("Rejecting suggestion");
    clearSuggestionState();
  }, [clearSuggestionState]);


  // --- Effect to Create/Clear Decorations ---
  useEffect(() => {
    if (!editor || !suggestionState.isActive || !suggestionState.originalRange || suggestionState.suggestionText === null) {
      if (suggestionDecorations.size > 0) {
        console.log("Clearing decorations");
        setSuggestionDecorations(DecorationSet.empty);
      }
      return;
    }

    console.log("Creating decorations for suggestion");
    const { from, to } = suggestionState.originalRange;
    const suggestionText = suggestionState.suggestionText;
    
    // Decoration to style original text
    const originalTextDeco = Decoration.inline(from, to, {
      class: 'suggestion-original text-muted-foreground/70 line-through',
    });

    // Decoration Widget for the inline suggestion UI
    // NOTE: Passing callbacks directly to the widget via toDOM is tricky.
    // We might need a different mechanism (event listeners, registry)
    // For now, we'll create the widget structure.
    const suggestionWidgetDeco = Decoration.widget(to, (view, getPos) => {
        const widgetDOM = document.createElement('span');
        widgetDOM.classList.add('suggestion-widget', 'ml-1'); // Add margin
        widgetDOM.contentEditable = "false"; // Prevent editing the widget itself
        
        // Render the suggestion text
        const textNode = document.createElement('span');
        textNode.textContent = suggestionText;
        textNode.classList.add('suggestion-text', 'bg-primary/10', 'text-foreground', 'rounded-sm', 'px-1');
        widgetDOM.appendChild(textNode);

        // Render Accept button
        const acceptBtn = document.createElement('button');
        acceptBtn.textContent = 'Accept';
        acceptBtn.classList.add('suggestion-action-btn', 'ml-1', 'text-xs', 'text-primary', 'hover:underline');
        acceptBtn.onclick = (e) => { 
            e.preventDefault(); 
            acceptSuggestion(); 
        };
        widgetDOM.appendChild(acceptBtn);

        // Render Reject button
        const rejectBtn = document.createElement('button');
        rejectBtn.textContent = 'Reject';
        rejectBtn.classList.add('suggestion-action-btn', 'ml-1', 'text-xs', 'text-muted-foreground', 'hover:underline');
        rejectBtn.onclick = (e) => { 
            e.preventDefault(); 
            rejectSuggestion(); 
        }; 
        widgetDOM.appendChild(rejectBtn);

        return widgetDOM;
    }, { 
        // Avoid interfering with selection
        // side: 1, 
        // ignoreSelection: true, 
    });

    setSuggestionDecorations(DecorationSet.create(editor.state.doc, [originalTextDeco, suggestionWidgetDeco]));

  }, [editor, suggestionState, acceptSuggestion, rejectSuggestion]); // Dependencies

  // --- Provide Context Value ---
  const contextValue: SuggestionContextType = {
    suggestionState,
    suggestionDecorations,
    triggerSuggestion,
    acceptSuggestion,
    rejectSuggestion,
  };

  return (
    <InlineSuggestionContext.Provider value={contextValue}>
      {children}
    </InlineSuggestionContext.Provider>
  );
};

// 4. Custom Hook to use the Context
export const useInlineSuggestions = (): SuggestionContextType => {
  const context = useContext(InlineSuggestionContext);
  if (!context) {
    throw new Error('useInlineSuggestions must be used within an InlineSuggestionProvider');
  }
  return context;
}; 
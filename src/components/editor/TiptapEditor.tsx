import React, { useEffect, useRef, useState, useContext } from 'react';
import { useEditor, EditorContent, Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Highlight from '@tiptap/extension-highlight'; 
import Link from '@tiptap/extension-link';
import Underline from '@tiptap/extension-underline';
import TextStyle from '@tiptap/extension-text-style'; 
import { Color } from '@tiptap/extension-color'; 
import { Decoration, DecorationSet } from '@tiptap/pm/view'; 
import { Node } from '@tiptap/pm/model'; 
import { StructuredAnalysisResult, Entity, Clause, Risk, TimelineEvent } from '@/services/documentAnalysisService'; 
import { getEditorExtensions } from '@/lib/editor/extensions';
import { summarizeTextSimple } from '@/services/chatService';
import { rewriteTextSimple } from '@/services/chatService';
import TiptapToolbar from './TiptapToolbar';
import './TiptapEditor.css';
import { cn } from '@/lib/utils';
import { Spinner } from '@/components/ui/Spinner';
import { FloatingToolbarComponent, FloatingToolbarOptions } from '@/lib/editor/extensions/FloatingToolbar';
import { InlineSuggestionProvider, useInlineSuggestions } from '@/context/InlineSuggestionContext';

type TiptapAnalysisResult = 
    | { type: 'entities', result: { entities: Entity[] } } 
    | { type: 'clauses', result: { clauses: Clause[] } } 
    | { type: 'risks', result: { risks: Risk[] } }
    | { type: 'timeline', result: { timeline: TimelineEvent[] } }
    | { type: 'privilegedTerms', result: string[] } 
    | null;

const createDecorationsFromResult = (doc: Node | null, result: StructuredAnalysisResult | null): DecorationSet => {
  if (!doc || !result || typeof result !== 'object' || 'error' in result) { 
    return DecorationSet.empty;
  }

  let items: (Entity | Clause | Risk | TimelineEvent)[] = [];
  let highlightBaseType = 'unknown';

  if ('entities' in result && result.entities) {
      items = result.entities;
      highlightBaseType = 'entity';
  } else if ('clauses' in result && result.clauses) {
      items = result.clauses;
      highlightBaseType = 'clause';
  } else if ('risks' in result && result.risks) {
      items = result.risks;
      highlightBaseType = 'risk';
  } else if ('timeline' in result && result.timeline) {
      items = result.timeline;
      highlightBaseType = 'timeline';
  } else {
       return DecorationSet.empty;
  }

  if (!items || items.length === 0) {
      return DecorationSet.empty;
  }

  const decorations = items.map((item) => {
    let className = `analysis-highlight highlight-${highlightBaseType}`;
    let tooltipContent = '';
    if (typeof item.start !== 'number' || typeof item.end !== 'number' || item.start >= item.end) {
        console.warn('Skipping decoration due to invalid range:', item);
        return null;
    }
    const from = Math.max(0, item.start);
    const to = Math.min(doc.content.size, item.end);
     if (from >= to) {
        console.warn(`Skipping decoration for "${highlightBaseType}" due to invalid range [${item.start}, ${item.end}] clamped to [${from}, ${to}] doc size ${doc.content.size}`, item);
        return null;
     }

    let itemText = '';
    try {
        itemText = doc.textBetween(from, to); 
    } catch (e) {
        console.error(`Error in textBetween for range [${from}, ${to}], item:`, item, e);
        return null; 
    }

    if (highlightBaseType === 'entity' && 'type' in item) { 
      const entityTypeClass = item.type.toLowerCase().replace(/[^a-z0-9]/g, '-'); 
      className += ` highlight-entity-${entityTypeClass}`;
      tooltipContent = `Entity (${item.type}): ${itemText}`;
    } else if (highlightBaseType === 'risk' && 'severity' in item && 'explanation' in item) { 
      const severityClass = item.severity.toLowerCase().replace(/[^a-z0-9]/g, '-'); 
      className += ` highlight-risk-${severityClass}`;
      tooltipContent = `Risk (${item.severity}): ${item.explanation}`;
      if ('suggestion' in item && typeof item.suggestion === 'string') {
        tooltipContent += `\nSuggestion: ${item.suggestion}`;
      }
    } else if (highlightBaseType === 'clause' && 'title' in item && 'text' in item) { 
      className += ` highlight-clause-key`; 
      tooltipContent = `Clause: ${item.title || 'Key Clause'}\n${item.text.substring(0, 100)}${item.text.length > 100 ? '...' : ''}`;
    } else if (highlightBaseType === 'timeline' && 'event' in item && 'date' in item) { 
      className += ' highlight-timeline-event';
      tooltipContent = `Timeline (${new Date(item.date).toLocaleDateString()}): ${item.event}`;
    } else {
        return null; 
    }

    return Decoration.inline(from, to, {
      class: className,
      'data-tooltip-id': 'viewer-tooltip', 
      'data-tooltip-content': tooltipContent, 
      'data-highlight-type': highlightBaseType,
      'data-highlight-details': JSON.stringify(item), 
    });
  }).filter((d): d is Decoration => d !== null); 

  console.log(`Created ${decorations.length} decorations for ${highlightBaseType}`);
  return DecorationSet.create(doc, decorations);
};

interface TiptapEditorProps {
  content?: string | object; // Allow initial content as HTML string or JSON object
  editable?: boolean;
  placeholder?: string;
  onChange?: (htmlContent: string) => void;
  onJsonChange?: (jsonContent: object) => void;
  className?: string;
  analysisResult?: StructuredAnalysisResult | null;
}

// Inner component to access context *after* editor is created
const EditorWithSuggestions: React.FC<TiptapEditorProps & { editor: Editor, floatingToolbarOptions: FloatingToolbarOptions }> = ({ 
    editor, 
    floatingToolbarOptions,
    editable,
    analysisResult,
    className 
}) => {
    const { suggestionDecorations } = useInlineSuggestions(); // Get decorations from context
    const analysisResultRef = useRef(analysisResult);
    const [analysisDecorations, setAnalysisDecorations] = useState<DecorationSet>(DecorationSet.empty);

    // Effect for Analysis Decorations (moved from main component)
    useEffect(() => {
        if (editor && analysisResult && !editable) {
            const { from, to } = editor.state.doc.content.fullRange();
            // Basic example: assuming analysisResult.highlights exist
             const highlights = (analysisResult.highlights || []).map((hl: any) => {
                let cssClass = `highlight highlight-${hl.type}`;
                if (hl.type === 'risk') {
                    cssClass += ` highlight-risk-${hl.severity?.toLowerCase() || 'low'}`;
                }
                return Decoration.inline(hl.start + from, hl.end + from, {
                  class: cssClass,
                  nodeName: 'span',
                  'data-tooltip': hl.explanation || hl.label || hl.type,
                });
            });
            setAnalysisDecorations(DecorationSet.create(editor.state.doc, highlights));
        } else {
            setAnalysisDecorations(DecorationSet.empty);
        }
    }, [editor, analysisResult, editable]);

    // Effect to update editor decorations (combine analysis + suggestion)
    useEffect(() => {
        if (editor) {
            const combinedDecos = new DecorationSet().add(editor.state.doc, [ 
              ...analysisDecorations.find(), 
              ...suggestionDecorations.find()
            ]);
             // Manually trigger a view update if needed, though Tiptap often handles it
             // This might require a different approach like using a ProseMirror plugin 
             // to manage decorations directly if this doesn't update reliably.
            const tr = editor.state.tr.setMeta('decorations', combinedDecos);
            editor.view.dispatch(tr);
        }
    }, [editor, analysisDecorations, suggestionDecorations]);

    return (
        <div className={cn("relative h-full", className)}> 
            <EditorContent editor={editor} className="h-full" />
            {editor && <FloatingToolbarComponent editor={editor} options={floatingToolbarOptions} />} 
        </div>
    );
}

const TiptapEditor: React.FC<TiptapEditorProps> = (
  { content, editable = true, placeholder = 'Start typing...', onChange, onJsonChange, className = '', analysisResult = null }
) => {

  const floatingToolbarOptions: FloatingToolbarOptions = {
    onSummarize: summarizeTextSimple,
    onRewrite: rewriteTextSimple, 
  };

  const editor = useEditor({
    extensions: getEditorExtensions({ floatingToolbar: floatingToolbarOptions }),
    content: content || '',
    editable: editable,
    editorProps: {
        attributes: {
            class: cn(
                'prose dark:prose-invert prose-sm sm:prose-base focus:outline-none min-h-[150px] w-full max-w-full',
                '[&_p]:my-2 [&_h1]:my-4 [&_h2]:my-3 [&_h3]:my-2',
                // className removed from here, applied to outer div
            ),
        },
        // Decorations are now handled by the effect in EditorWithSuggestions
        // decorations: () => { ... } // REMOVED
    },
    onUpdate: ({ editor }) => {
      if (onChange) {
        onChange(editor.getHTML());
      }
      if (onJsonChange) {
        onJsonChange(editor.getJSON());
      }
    },
  });

  // Handle editable changes
  useEffect(() => {
    if (editor) {
      editor.setEditable(editable);
    }
  }, [editable, editor]);

  // Cleanup
  useEffect(() => {
    return () => {
      editor?.destroy();
    };
  }, [editor]);

  if (!editor) {
    return <Spinner />; 
  }

  return (
     // Wrap the inner component with the provider, passing the editor instance
    <InlineSuggestionProvider editor={editor}>
        <EditorWithSuggestions 
            editor={editor} 
            floatingToolbarOptions={floatingToolbarOptions}
            editable={editable}
            analysisResult={analysisResult}
            className={className} // Pass className to the inner wrapper
            content={content} // Pass other props if needed by inner
            placeholder={placeholder}
            onChange={onChange}
            onJsonChange={onJsonChange}
         />
    </InlineSuggestionProvider>
  );
};

export default TiptapEditor; 
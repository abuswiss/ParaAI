import { Mark, mergeAttributes, markInputRule, markPasteRule } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet, EditorView } from '@tiptap/pm/view';

// Regex to match {{variable_name}} syntax for input/paste rules
// Allows spaces around the name: {{ variable name }}
const variableSyntaxRegex = /\{\{\s*([^}]+?)\s*\}\}/g;

export interface VariableMarkOptions {
  HTMLAttributes: Record<string, any>;
}

// Add this declaration merging block
// Use object signature for setVariable and toggleVariable
// Remove old string signatures

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    variable: {
      /**
       * Set a variable mark
       */
      setVariable: (attributes: { variableName: string }) => ReturnType;
      /**
       * Toggle a variable mark
       */
      toggleVariable: () => ReturnType;
      /**
       * Unset a variable mark
       */
      unsetVariable: () => ReturnType;
    };
  }
}

// Plugin key needs to be exported and created outside the extension
const variablePluginKey = new PluginKey('variableMarkPlugin');

export const VariableMark = Mark.create<VariableMarkOptions>({
  name: 'variable',

  // Make variable marks span across multiple nodes if needed
  spanning: true,

  // Make it inclusive so typing at the boundaries includes the mark
  inclusive: true,

  // Define attributes for the mark
  addAttributes() {
    return {
      'data-variable-name': {
        default: null,
        parseHTML: element => element.getAttribute('data-variable-name'),
        renderHTML: attributes => {
          if (!attributes['data-variable-name']) {
            return {};
          }
          return { 'data-variable-name': attributes['data-variable-name'] };
        },
      },
      // Add description attribute
      'data-variable-description': {
        default: null,
        parseHTML: element => element.getAttribute('data-variable-description'),
        renderHTML: attributes => {
          if (!attributes['data-variable-description']) {
            return {};
          }
          return { 'data-variable-description': attributes['data-variable-description'] };
        },
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-variable-name]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, { class: 'variable-highlight' }), 0];
  },

  addCommands() {
    return {
      setVariable: (attributes) => ({ commands }) => {
        if (!attributes.variableName || attributes.variableName.trim().length === 0) {
          console.warn("Variable name cannot be empty.");
          return false;
        }
        const trimmedName = attributes.variableName.trim();
        return commands.setMark(this.name, { 'data-variable-name': trimmedName });
      },
      toggleVariable: () => ({ commands }) => {
        return commands.toggleMark(this.name);
      },
      unsetVariable: () => ({ commands }) => {
        return commands.unsetMark(this.name);
      },
    };
  },

  addInputRules() {
    return [
      markInputRule({
        find: variableSyntaxRegex,
        type: this.type,
        getAttributes: match => {
          const variableName = match[1]?.trim();
          if (variableName) {
            return { 'data-variable-name': variableName };
          }
          return null;
        },
      }),
    ];
  },

  addPasteRules() {
    return [
      markPasteRule({
        find: variableSyntaxRegex,
        type: this.type,
        getAttributes: match => {
          const variableName = match[1]?.trim();
          if (variableName) {
            return { 'data-variable-name': variableName };
          }
          return null;
        },
      }),
    ];
  },

  addProseMirrorPlugins() {
    const markType = this.type;
    
    return [
      new Plugin({
        key: variablePluginKey,
        
        // Initialize state for the plugin 
        state: {
          init() {
            return {
              activeVariablePos: null,  // Position of the active variable being edited
              originalVariableName: null, // Original name before editing
              originalVariableDescription: null, // Original description before editing
            };
          },
          apply(tr, oldState) {
            // Reset state if we have any position changes
            if (tr.docChanged && oldState.activeVariablePos !== null) {
              return { activeVariablePos: null, originalVariableName: null, originalVariableDescription: null };
            }
            
            // Check for our metadata to update plugin state
            const meta = tr.getMeta(variablePluginKey);
            if (meta) {
              return { 
                activeVariablePos: meta.activeVariablePos,
                originalVariableName: meta.originalVariableName,
                originalVariableDescription: meta.originalVariableDescription
              };
            }
            
            return oldState;
          }
        },
        
        props: {
          // Handle clicks on variables
          handleClick: (view, pos, event) => {
            const { state } = view;
            const { doc } = state;

            if (pos < 0 || pos > doc.content.size) return false;

            const $pos = doc.resolve(pos);
            const marksAtPos = $pos.marks();
            const variableMarkInstance = marksAtPos.find(mark => mark.type === markType);

            if (variableMarkInstance) {
              const attrs = variableMarkInstance.attrs;
              const variableName = attrs['data-variable-name'];
              const variableDescription = attrs['data-variable-description'] || null;

              // Find the full range of this specific mark instance
              // ProseMirror marks can span multiple nodes but are usually on text nodes.
              // We need to find the start and end of the continuous marked range at the click position.
              let markStart = -1;
              let markEnd = -1;
              let currentValue = '';

              // Iterate over the nodes around the click position to find the exact marked range
              // and its text content.
              // $pos.parent.content.forEach((childNode, offset, index) => {
              //   if (childNode.isText) {
              //     childNode.marks.forEach(m => {
              //       if (m.eq(variableMarkInstance)) {
              //         const nodeAbsPos = $pos.start() + offset; // Start pos of parent + offset of child
              //         if (markStart === -1 || nodeAbsPos < markStart) markStart = nodeAbsPos;
              //         if (nodeAbsPos + childNode.nodeSize > markEnd) markEnd = nodeAbsPos + childNode.nodeSize;
              //         currentValue += childNode.text;
              //       }
              //     });
              //   }
              // });
              // The above iteration is complex because a mark can span multiple text nodes if they are adjacent.
              // A simpler approach for click: use textBetween with the resolved mark range if PM provides it easily.
              // For now, let's find the range by checking adjacent positions.

              let start = pos;
              let end = pos;

              // Expand start to the beginning of the mark
              while (start > $pos.start() && doc.resolve(start - 1).marks().some(m => m.eq(variableMarkInstance))) {
                start--;
              }
              // Expand end to the end of the mark
              while (end < $pos.end() && doc.resolve(end).marks().some(m => m.eq(variableMarkInstance))) {
                end++;
              }
              
              // If a mark exists right at $pos, but $pos is at the end of the mark,
              // the above loop for `end` might not expand. Let's check `doc.resolve(pos-1)` if `pos` is an end boundary.
              // For simplicity, Tiptap often gives a good selection range from `getMarkRange` if available.
              // Let's try a robust way to get the mark's range at the current selection or click position.

              const selection = state.selection;
              // Check if the click was within an existing selection that has the mark
              let range = view.dragging ? null : state.doc.resolve(pos).marks().reduce((r, m) => {
                if (m.type === markType && m.attrs['data-variable-name'] === variableName) {
                    // This is not a standard PM way to get range from mark itself.
                    // We need to find the actual node range for the clicked mark.
                    // The `start` and `end` calculated above by expanding from `pos` is more reliable here.
                }
                return r;
              }, null as { from: number; to: number } | null);
              
              // If no specific range found via a selection helper, use the expanded `start` and `end`.
              if (!range) {
                // Correct the range finding logic. $pos.marks() gets marks *at* a position.
                // We need the segment that this mark covers.
                // This typically means finding the text node(s) this mark applies to around `pos`.
                
                // Resolve the node at the current position
                const resolvedPos = doc.resolve(pos);
                const node = resolvedPos.nodeAfter || resolvedPos.nodeBefore; // Get node at or before pos
                let nodePos = resolvedPos.pos;
                if(resolvedPos.nodeAfter) {
                    nodePos = resolvedPos.pos; // pos before nodeAfter
                } else if (resolvedPos.nodeBefore) {
                    nodePos = resolvedPos.pos - (resolvedPos.nodeBefore.nodeSize || 0); // pos before nodeBefore
                }

                if (node && node.isText && node.marks.some(m => m.eq(variableMarkInstance))) {
                    // The mark is on this node. The range is within this node for this click.
                    // We search from the start of this text node.
                    let textNodeStartPos = -1;
                    doc.nodesBetween(resolvedPos.start(), resolvedPos.end(), (n, p) => {
                        if (n === node) { // Found the text node
                            textNodeStartPos = p;
                            return false; // stop iteration
                        }
                        return true;
                    });

                    if (textNodeStartPos !== -1) {
                        let from = textNodeStartPos;
                        let to = textNodeStartPos + node.textContent.length;
                        
                        // Now refine `from` and `to` to the exact span of the variableMarkInstance within this text node.
                        // This is needed if multiple variables or mixed marks are on the same text node.
                        // For simplicity, if a variable mark is clicked, assume its range covers the text it's on OR
                        // Tiptap's own internal logic for mark selection on click should be leveraged if possible.
                        // The `start` and `end` calculated by expanding from `pos` is a decent heuristic.
                        range = { from: start, to: end };
                        currentValue = doc.textBetween(start, end, '\0');
                    } else {
                         // Fallback if textNodeStartPos couldn't be found (should not happen)
                        range = { from: start, to: end };
                        currentValue = doc.textBetween(start, end, '\0');
                    }

                } else {
                    // Fallback if not on a text node or mark doesn't match (should be caught by variableMarkInstance check)
                    range = { from: start, to: end };
                    currentValue = doc.textBetween(start, end, '\0');
                }
              }

              if (range && range.from < range.to) {
                const detail = {
                  name: variableName,
                  description: variableDescription,
                  currentValue: currentValue, // Text content of the mark
                  from: range.from,
                  to: range.to,
                  node: event.target as HTMLElement, // The clicked DOM node
                };

                // Dispatch custom event
                const customEvent = new CustomEvent('variable-mark-clicked', { detail, bubbles: true, cancelable: true });
                event.target?.dispatchEvent(customEvent);
                
                return true; // Indicate that the click was handled
              }
            }
            return false; // Click not on a variable mark relevant to this logic
          },
          
          // Handle keydown events
          handleKeyDown(view, event) {
            // Only process if we have an active variable being edited
            const pluginState = variablePluginKey.getState(view.state);
            if (!pluginState?.activeVariablePos) return false;
            
            // Re-apply the variable mark on Enter or Escape
            if (event.key === 'Enter' || event.key === 'Escape') {
              const { from, to } = pluginState.activeVariablePos;
              const originalName = pluginState.originalVariableName;
              const originalDescription = pluginState.originalVariableDescription;
              
              // Don't reapply if the selection is empty or invalid
              if (from >= 0 && to > from) {
                view.dispatch(
                  view.state.tr
                    .addMark(from, to, markType.create({ 
                        'data-variable-name': originalName,
                        'data-variable-description': originalDescription 
                    }))
                    .setMeta(variablePluginKey, { 
                      activeVariablePos: null,
                      originalVariableName: null,
                      originalVariableDescription: null 
                    })
                );
                
                if (event.key === 'Enter') {
                  // On Enter, collapse selection to end of variable
                  view.dispatch(
                    view.state.tr.setSelection(
                      view.state.selection.constructor.near(
                        view.state.doc.resolve(to)
                      )
                    )
                  );
                }
                
                event.preventDefault();
                return true;
              }
            }
            
            return false;
          },
          
          // Handle transactions to deactivate variables when selection changes
          appendTransaction(transactions, oldState, newState) {
            // Check if selection has changed
            const pluginState = variablePluginKey.getState(newState);
            if (!pluginState?.activeVariablePos) return null;
            
            // If selection is now outside the variable, reapply the mark
            const { from, to } = pluginState.activeVariablePos;
            const { selection } = newState;
            
            // If selection has changed and isn't overlapping the active variable, reapply the mark
            if (selection.from < from || selection.to > to) {
              const originalName = pluginState.originalVariableName;
              const originalDescription = pluginState.originalVariableDescription;

              return newState.tr
                .addMark(from, to, markType.create({ 
                    'data-variable-name': originalName,
                    'data-variable-description': originalDescription
                 }))
                .setMeta(variablePluginKey, { 
                  activeVariablePos: null,
                  originalVariableName: null,
                  originalVariableDescription: null 
                });
            }
            
            return null;
          }
        }
      }),
    ];
  },
});
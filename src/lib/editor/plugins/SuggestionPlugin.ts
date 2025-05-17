import { Plugin, PluginKey, EditorState, Transaction } from '@tiptap/pm/state';
import { Decoration, DecorationSet, EditorView } from '@tiptap/pm/view';
import { Editor } from '@tiptap/react';
import { marked } from 'marked';
import { DOMParser } from '@tiptap/pm/model';

// Define the state managed by the plugin
interface SuggestionPluginState {
  isActive: boolean;
  originalRange: { from: number; to: number } | null;
  suggestionText: string | null;
  suggestionRange: { from: number; to: number } | null; // Range of the temporarily inserted suggestion
}

// Create a unique key for the plugin
export const suggestionPluginKey = new PluginKey<SuggestionPluginState>('suggestionPlugin');

// --- Actions ---
// Helper functions to create transactions that update the plugin state

export const showSuggestion = (
    originalRange: { from: number; to: number },
    suggestionText: string
): Transaction | ((state: EditorState) => Transaction) => {
    return (state: EditorState, dispatch?: (tr: Transaction) => void): Transaction => {
        console.log("SuggestionPlugin: showSuggestion action called.");
        const tr = state.tr;

        // --- Parse markdown to HTML, then to ProseMirror Slice ---
        let slice = null;
        try {
            console.log("SuggestionPlugin: Parsing markdown:", suggestionText);
            const html = marked.parse(suggestionText.trim()); // Trim whitespace
            console.log("SuggestionPlugin: Parsed HTML:", html);

            // Create a temporary DOM element to parse the HTML string
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = html;

            // Use ProseMirror's DOMParser with the current schema
            console.log("SuggestionPlugin: Trying ProseMirror DOMParser...");
            const pmParser = DOMParser.fromSchema(state.schema);
            slice = pmParser.parseSlice(tempDiv, { preserveWhitespace: 'full' });
            console.log("SuggestionPlugin: ProseMirror DOMParser result (Slice):", slice);

        } catch (e) {
            console.error('SuggestionPlugin: Error parsing markdown suggestion to Slice:', e);
            slice = null; // Ensure slice is null on error
        }

        // Replace the original range with the parsed slice
        if (slice && slice.content.size > 0) {
            console.log("SuggestionPlugin: Replacing range with parsed Slice:", slice);
            // Adjust range to prevent insertion errors if slice is just a wrapper
            tr.replaceRange(originalRange.from, originalRange.to, slice);
        } else {
            console.warn("SuggestionPlugin: Failed to parse or empty slice, falling back to insertText.");
            // Fallback: insert as plain text
            tr.insertText(suggestionText, originalRange.from, originalRange.to);
        }

        // Recalculate range based on the final state *after* the transaction step
        // We map the *original* range through the transaction's mapping
        const mappedFrom = tr.mapping.map(originalRange.from);
        // Estimate the end based on inserted content length - this is tricky!
        // For simplicity, let's use the original text length for now, plugin state handles mapping later.
        // The actual end position depends on the structure of the inserted slice.
        // Let the 'apply' function handle the final range mapping.
        const estimatedEnd = mappedFrom + suggestionText.length; // Placeholder

        const suggestionRange = { from: mappedFrom, to: estimatedEnd }; // Initial estimate

        console.log("SuggestionPlugin: Setting meta SHOW_SUGGESTION with initial range estimate:", suggestionRange);
        tr.setMeta(suggestionPluginKey, {
            type: 'SHOW_SUGGESTION',
            // Pass the original range and text, let 'apply' calculate final range
            payload: { originalRange, suggestionText, suggestionRange: { from: mappedFrom, to: mappedFrom } }, // Let apply calculate 'to'
        });
        return tr;
    };
};


export const acceptSuggestion = (): Transaction | ((state: EditorState) => Transaction) => {
    return (state: EditorState, dispatch?: (tr: Transaction) => void): Transaction => {
        const pluginState = suggestionPluginKey.getState(state);
        if (!pluginState?.isActive || !pluginState.suggestionRange) {
            // No active suggestion to accept, return an unchanged transaction
            return state.tr; 
        }

        const tr = state.tr;

        // 1. Remove the suggestion mark/styling (handled by decoration removal below)
        // No document change needed here if we only used decorations

        // 2. Clear the plugin state via metadata
        tr.setMeta(suggestionPluginKey, { type: 'CLEAR_SUGGESTION' });

        // Optional: If the suggestion wasn't already permanently in the doc via the initial
        // insert in showSuggestion, this is where you'd permanently apply it.
        // However, the current showSuggestion inserts it directly, so accepting
        // mainly involves clearing the temporary state/decorations.

        // if (dispatch) {
        //     dispatch(tr);
        // }
        return tr;
    };
};


export const declineSuggestion = (): Transaction | ((state: EditorState) => Transaction) => {
    return (state: EditorState, dispatch?: (tr: Transaction) => void): Transaction => {
        const pluginState = suggestionPluginKey.getState(state);
        if (!pluginState?.isActive || !pluginState.originalRange || !pluginState.suggestionRange) {
             // No active suggestion to decline, return an unchanged transaction
            return state.tr;
        }

        const tr = state.tr;
        // 1. Replace the suggestion text with the original text (if we inserted suggestion)
        // Need original text here - modify state to store it or pass it in?
        // Let's assume for now we need to retrieve original text based on originalRange
        // This implies showSuggestion should NOT modify the doc, only set state.
        // REVISED APPROACH: Decline means removing the decorations and doing nothing else,
        // assuming the original text was never actually replaced. If showSuggestion *did*
        // replace, then decline needs to revert it.
        // Let's stick to the decoration-only approach for now. Decline just clears state.

        // 2. Clear the plugin state via metadata
        tr.setMeta(suggestionPluginKey, { type: 'CLEAR_SUGGESTION' });

        // if (dispatch) {
        //     dispatch(tr);
        // }
        return tr;
    };
};


// --- Plugin Definition ---

export const SuggestionPlugin = () => new Plugin<SuggestionPluginState>({
    key: suggestionPluginKey,

    // Initial state
    state: {
        init(): SuggestionPluginState {
            return {
                isActive: false,
                originalRange: null,
                suggestionText: null,
                suggestionRange: null,
            };
        },
        // How state changes based on transactions
        apply(tr, currentPluginState, oldEditorState, newEditorState): SuggestionPluginState {
            const meta = tr.getMeta(suggestionPluginKey);
            console.log("SuggestionPlugin: apply called. Meta:", meta);

            if (meta) {
                 console.log("SuggestionPlugin apply - Meta found:", meta);
                if (meta.type === 'SHOW_SUGGESTION') {
                    // Calculate the correct range *after* the transaction changes
                    const { originalRange } = meta.payload;
                    const from = tr.mapping.map(originalRange.from);
                    // Find the end position based on the changes in the transaction
                    // This requires looking at the transaction steps
                    let to = from; // Default
                    tr.steps.forEach(step => {
                         if (step instanceof ReplaceStep || step instanceof ReplaceAroundStep) {
                             // Map the original end position through the step
                             const mappedOriginalEnd = step.map(originalRange.to);
                             // The new end might be calculated based on the inserted content
                             // For replaceRange, the new end is 'from + inserted content size'
                             to = Math.max(to, step.slice ? from + step.slice.size : mappedOriginalEnd);
                         }
                    });
                     // Final check: ensure 'to' doesn't exceed doc size
                     to = Math.min(to, newEditorState.doc.content.size);

                    const newSuggestionRange = { from, to };
                    console.log("SuggestionPlugin apply - SHOW_SUGGESTION. Calculated Range:", newSuggestionRange);

                    // Ensure range is valid before setting state
                    if (from >= to || from < 0 || to > newEditorState.doc.content.size) {
                         console.warn("SuggestionPlugin apply - Calculated invalid range, clearing state.", newSuggestionRange);
                         return { isActive: false, originalRange: null, suggestionText: null, suggestionRange: null };
                    }

                    console.log("SuggestionPlugin apply - Setting new state:", { ...meta.payload, suggestionRange: newSuggestionRange });
                    return {
                        isActive: true,
                        originalRange: meta.payload.originalRange,
                        suggestionText: meta.payload.suggestionText,
                        suggestionRange: newSuggestionRange,
                    };
                }
                if (meta.type === 'CLEAR_SUGGESTION') {
                     console.log("SuggestionPlugin apply - CLEAR_SUGGESTION received. Clearing state.");
                    return { isActive: false, originalRange: null, suggestionText: null, suggestionRange: null };
                }
            }
            // If no meta, update range if transaction affected it
            if (tr.docChanged && currentPluginState.isActive && currentPluginState.suggestionRange) {
                try {
                    const updatedRange = {
                        from: tr.mapping.map(currentPluginState.suggestionRange.from),
                        to: tr.mapping.map(currentPluginState.suggestionRange.to, -1),
                    };
                    console.log("SuggestionPlugin apply - Mapping existing suggestion range:", currentPluginState.suggestionRange, "->", updatedRange);
                    if (updatedRange.from >= updatedRange.to || updatedRange.from < 0 || updatedRange.to > newEditorState.doc.content.size) {
                        console.log("SuggestionPlugin apply - Suggestion range became invalid or deleted, clearing state.");
                        return { isActive: false, originalRange: null, suggestionText: null, suggestionRange: null };
                    }
                    return { ...currentPluginState, suggestionRange: updatedRange };
                } catch (e) {
                    console.error("SuggestionPlugin apply - Error mapping range, clearing state:", e);
                    return { isActive: false, originalRange: null, suggestionText: null, suggestionRange: null };
                }
            }
            console.log("SuggestionPlugin: apply returning current state:", currentPluginState);
            return currentPluginState; // No change
        },
    },

    // Define decorations based on the plugin state
    props: {
        decorations(state): DecorationSet | null {
            const pluginState = this.getState(state);
            console.log("SuggestionPlugin: decorations called. Plugin State:", pluginState);

            if (!pluginState?.isActive || !pluginState.suggestionRange) {
                console.log("SuggestionPlugin: decorations - Not active or no range, returning null.");
                return null;
            }

            // Validate range before creating decorations
            const { from, to } = pluginState.suggestionRange;
            if (from >= to || from < 0 || to > state.doc.content.size) {
                console.warn("SuggestionPlugin: decorations - Invalid range, returning null.", pluginState.suggestionRange);
                return null;
            }
            
            console.log(`SuggestionPlugin props.decorations - Applying decorations from ${from} to ${to}`);


            // 1. Inline Decoration for highlighting
            const highlightDecoration = Decoration.inline(from, to, {
                 class: 'suggestion-highlight',
            });

            // 2. Widget Decorations for Buttons
            const acceptButtonWidget = Decoration.widget(to, (view) => {
                console.log("SuggestionPlugin: Creating Accept button widget.");
                const button = document.createElement('button');
                button.textContent = 'Accept';
                button.className = 'suggestion-button accept';
                button.title = 'Accept this suggestion';
                button.onclick = (e) => {
                    e.preventDefault();
                    console.log("Accept button clicked");
                    // Use the view passed to the widget builder
                    if (view && view.state) {
                        view.dispatch(acceptSuggestion()(view.state));
                    }
                    return false;
                };
                return button;
            }, { side: 1 });

            const declineButtonWidget = Decoration.widget(to, (view) => {
                console.log("SuggestionPlugin: Creating Decline button widget.");
                const button = document.createElement('button');
                button.textContent = 'Decline';
                button.className = 'suggestion-button decline';
                button.title = 'Decline this suggestion';
                button.onclick = (e) => {
                    e.preventDefault();
                    console.log("Decline button clicked");
                    // Use the view passed to the widget builder
                     if (view && view.state) {
                         view.dispatch(declineSuggestion()(view.state));
                    }
                    return false;
                };
                 // Add a little space before this button
                 const spacer = document.createElement('span');
                 spacer.innerHTML = '&nbsp;'; // Non-breaking space

                 const container = document.createElement('span');
                 container.appendChild(spacer);
                 container.appendChild(button);

                 return container; // Return container with spacer and button
            }, { side: 2 }); // Adjust side to position after accept button

             // Add a small widget for spacing *after* decline if needed
            // const endSpacerWidget = Decoration.widget(to, () => {
            //     const spacer = document.createElement('span');
            //     spacer.innerHTML = '&nbsp;';
            //     return spacer;
            // }, { side: 3 });


             console.log("SuggestionPlugin props.decorations - Creating DecorationSet with highlight and buttons."); // Log successful creation
            return DecorationSet.create(state.doc, [
                highlightDecoration,
                acceptButtonWidget,
                declineButtonWidget,
                // endSpacerWidget
            ]);
        },
         // Handle clicks within decorations if needed (e.g., to prevent default behavior)
        // handleClickOn(view, pos, node, nodePos, event, direct) {
        //     // Check if the click was on one of our suggestion buttons
        //     const target = event.target as HTMLElement;
        //     if (target.classList.contains('suggestion-button')) {
        //         // We already have onclick handlers, return true to indicate we handled it
        //         return true;
        //     }
        //     return false; // Default handling
        // }
    },
});

// Helper to get plugin state outside of plugin props
export const getSuggestionState = (state: EditorState): SuggestionPluginState | undefined => {
  return suggestionPluginKey.getState(state);
}; 
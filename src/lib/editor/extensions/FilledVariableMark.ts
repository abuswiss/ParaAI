import { Mark, mergeAttributes } from '@tiptap/core';

export interface FilledVariableMarkOptions {
  HTMLAttributes: Record<string, any>;
}

/**
 * Mark to visually distinguish text that has replaced a template variable.
 */
export const FilledVariableMark = Mark.create<FilledVariableMarkOptions>({
  name: 'filledVariable',

  // Not spanning, applies to specific text
  spanning: false,

  // Make it inclusive so typing at boundaries doesn't break it easily
  inclusive: true,

  // Store the original variable name for potential future use (optional)
  addAttributes() {
    return {
      'data-original-variable-name': {
        default: null,
        parseHTML: element => element.getAttribute('data-original-variable-name'),
        renderHTML: attributes => {
          if (!attributes['data-original-variable-name']) {
            return {};
          }
          return { 'data-original-variable-name': attributes['data-original-variable-name'] };
        },
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-original-variable-name]', // Parse based on the attribute
        // Optional: get attributes from HTML
        // getAttrs: node => ({ 'data-original-variable-name': (node as HTMLElement).getAttribute('data-original-variable-name') }),
      },
      // Optionally parse elements with just the class if needed
      {
         tag: 'span.filled-variable',
         getAttrs: node => {
           const originalName = (node as HTMLElement).getAttribute('data-original-variable-name');
           return originalName ? { 'data-original-variable-name': originalName } : null;
         },
      }
    ];
  },

  renderHTML({ HTMLAttributes }) {
    // Apply the specific class and merge other attributes
    return ['span', mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, { class: 'filled-variable' }), 0];
  },

  // No specific commands needed, just applied via editor chain
  addCommands() {
    return {
       setFilledVariable: (attributes) => ({ commands }) => {
         return commands.setMark(this.name, attributes);
       },
       unsetFilledVariable: () => ({ commands }) => {
         return commands.unsetMark(this.name);
       },
    };
  },
});

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    filledVariable: {
      /**
       * Set a filledVariable mark
       */
      setFilledVariable: (attributes: { originalVariableName: string }) => ReturnType;
      /**
       * Unset a filledVariable mark
       */
      unsetFilledVariable: () => ReturnType;
    };
  }
} 
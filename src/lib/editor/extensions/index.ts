import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Highlight from '@tiptap/extension-highlight';
import Link from '@tiptap/extension-link';
import Underline from '@tiptap/extension-underline';
import TextStyle from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import { Extension } from '@tiptap/core';

// Import custom extensions if they exist (adjust paths if needed)
import { FloatingToolbar, FloatingToolbarOptions } from './FloatingToolbar';
import { SlashCommands } from './SlashCommands';
// import { FloatingMenu } from './FloatingMenu'; // Assuming FloatingMenu is also an extension

export interface EditorExtensionOptions {
  placeholder?: string;
  floatingToolbar?: FloatingToolbarOptions;
  onSummarize?: (editor: any) => void;
  onRewrite?: (editor: any, mode?: string) => void;
  // Add options for other custom extensions like FloatingMenu if needed
}

export const getEditorExtensions = (options: EditorExtensionOptions = {}): Extension[] => {
  const extensions = [
    StarterKit.configure({
      // Configure StarterKit options if needed
      // e.g., heading: { levels: [1, 2, 3] }
      // By default, includes: Blockquote, Bold, BulletList, Code, CodeBlock, Document, Dropcursor,
      // Emphasis (Italic), Gapcursor, HardBreak, Heading, History, HorizontalRule, Italic,
      // ListItem, OrderedList, Paragraph, Strike, Text
    }),
    Underline,
    Highlight.configure({ multicolor: true }), // Allow multiple highlight colors
    Link.configure({
      openOnClick: true,
      autolink: true,
      defaultProtocol: 'https',
    }),
    TextStyle, // Required for Color extension
    Color.configure({
        // types: ['textStyle'], // Apply color to text styles
    }),
    Placeholder.configure({
      placeholder: options.placeholder || 'Start writing...',
    }),
    // Add custom extensions
    FloatingToolbar.configure(options.floatingToolbar || {}),
    // FloatingMenu.configure({ /* options */ }), // Add if FloatingMenu is an extension
  ];

  // Add slash commands if onSummarize or onRewrite functions are provided
  if (options.onSummarize || options.onRewrite) {
    extensions.push(
      SlashCommands.configure({
        onSummarize: options.onSummarize,
        onRewrite: options.onRewrite,
      })
    );
  }

  // Add more extensions here as needed

  return extensions.filter(Boolean) as Extension[]; // Filter out any potentially null extensions
}; 
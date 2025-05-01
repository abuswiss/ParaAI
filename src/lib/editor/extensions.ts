import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Highlight from '@tiptap/extension-highlight';
import Link from '@tiptap/extension-link'; // Keep Link for potential use
import Underline from '@tiptap/extension-underline';
import TextStyle from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';

// Import the custom extensions (ensure paths are correct)
import { FloatingToolbar } from './extensions/FloatingToolbar';
import { FloatingMenuExtension } from './extensions/FloatingMenu';

// Placeholder for AI function types (replace with actual types)
type AIFunction = (text: string) => Promise<string>;

// Define options type for FloatingToolbar
interface FloatingToolbarOptions {
  onSummarize?: AIFunction;
  onRewrite?: AIFunction;
}

// Function to configure extensions, allowing options to be passed
export const getEditorExtensions = (options?: { floatingToolbar?: FloatingToolbarOptions }) => [
  StarterKit.configure({
    // Configure StarterKit options if needed
     heading: {
       levels: [1, 2, 3, 4],
     },
     // Disable default history for potential custom handling or if conflicting
    // history: false, 
  }),
  Placeholder.configure({
    placeholder: 'Start writing your document or template content here...',
  }),
  Highlight.configure({ multicolor: true, HTMLAttributes: { class: 'highlight' } }),
  Link.configure({
    openOnClick: false, // Recommend false for better control
    autolink: true,
    defaultProtocol: 'https',
    HTMLAttributes: {
      class: 'text-primary hover:underline', // Use theme color
      rel: 'noopener noreferrer nofollow',
      target: '_blank'
    }
  }),
  Underline,
  TextStyle,
  Color.configure({
    // types: ['textStyle'], // Usually not needed with TextStyle included
  }),
  // Add the floating menu and toolbar extensions
  // We assume FloatingToolbar will be modified to accept options like onSummarize/onRewrite
  FloatingToolbar.configure(options?.floatingToolbar), // Pass options here
  FloatingMenuExtension, // Assuming FloatingMenu doesn't need options for now
];

// Keep the original export if needed elsewhere, but prefer the configurable function
// export const editorExtensions = getEditorExtensions(); 

// Type definition for easier use
export type EditorExtensions = typeof getEditorExtensions; 
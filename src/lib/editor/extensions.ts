import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Highlight from '@tiptap/extension-highlight';
import Link from '@tiptap/extension-link'; // Keep Link for potential use
import Underline from '@tiptap/extension-underline';
import TextStyle from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import { Editor } from '@tiptap/react'; // Import Editor type

// Import the custom extensions (ensure paths are correct)
import { FloatingToolbar, FloatingToolbarOptions as ActualFloatingToolbarOptions } from './extensions/FloatingToolbar'; // Import the actual options type
import { FloatingMenuExtension } from './extensions/FloatingMenu';

// Remove old AIFunction type if no longer used elsewhere
// type AIFunction = (text: string) => Promise<string>;

// Define options type passed to getEditorExtensions, referencing the actual type from FloatingToolbar
interface ConfigurableFloatingToolbarOptions extends ActualFloatingToolbarOptions {}

// Function to configure extensions, allowing options to be passed
export const getEditorExtensions = (options?: { floatingToolbar?: ConfigurableFloatingToolbarOptions }) => [
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
  // Configure FloatingToolbar with the passed options
  FloatingToolbar.configure(options?.floatingToolbar), // Pass options here
  FloatingMenuExtension, // Assuming FloatingMenu doesn't need options for now
];

// Type definition for easier use
// Ensure this reflects the updated options structure if needed
export type EditorExtensionsOptions = { floatingToolbar?: ConfigurableFloatingToolbarOptions };
export type EditorExtensions = (options?: EditorExtensionsOptions) => any[]; // Adjust return type if needed

// Keep the original export if needed elsewhere, but prefer the configurable function
// export const editorExtensions = getEditorExtensions(); 
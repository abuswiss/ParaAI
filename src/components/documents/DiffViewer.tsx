import React, { useMemo } from 'react';
import ReactDiffViewer, { DiffMethod } from 'react-diff-viewer-continued';
import { useTheme } from 'next-themes';

interface DiffViewerProps {
  originalContent: string;
  newContent: string;
  viewType: 'unified' | 'split';
  originalTitle?: string;
  newTitle?: string;
}

export const DiffViewer: React.FC<DiffViewerProps> = ({
  originalContent,
  newContent,
  viewType,
  originalTitle = 'Original',
  newTitle = 'New'
}) => {
  const { theme } = useTheme();
  const isDarkTheme = theme === 'dark';
  
  // Clean HTML content for diff viewing
  const cleanHtml = (html: string): string => {
    // First handle empty content
    if (!html) return '';
    
    try {
      // Parse HTML into DOM
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      
      // Remove script tags for security
      const scripts = doc.getElementsByTagName('script');
      while (scripts[0]) {
        scripts[0].parentNode?.removeChild(scripts[0]);
      }
      
      // Get the cleaned body content
      const bodyContent = doc.body.innerHTML;
      
      // Basic formatting cleanup
      return bodyContent
        .replace(/>\s+</g, '><') // Remove whitespace between tags
        .replace(/\n\s*/g, '\n') // Keep line breaks but remove indentation
        .trim();
    } catch (error) {
      console.error('Error cleaning HTML for diff:', error);
      return html;
    }
  };

  // Memoize the cleaned content
  const cleanedOriginalContent = useMemo(() => cleanHtml(originalContent), [originalContent]);
  const cleanedNewContent = useMemo(() => cleanHtml(newContent), [newContent]);

  // Define theme variables from your tailwind.config.js (or manually if not all are there)
  // These are illustrative; replace with actual hex values from your theme
  const colors = {
    light: {
      background: '#FFF8E7',
      foreground: '#000000',
      primary: '#E3735E',
      muted: '#F1F5F9', // Example: tailwind slate-100
      success: '#22C55E', // Example: tailwind green-500
      successForeground: '#FFFFFF', // Or a dark color if success is light
      destructive: '#EF4444', // Example: tailwind red-500
      destructiveForeground: '#FFFFFF', // Or a dark color if destructive is light
    },
    dark: {
      background: '#18181B',
      foreground: '#E4E4E7',
      primary: '#E3735E',
      muted: '#374151', // Example: tailwind gray-700
      success: '#4ADE80', // Example: tailwind green-400
      successForeground: '#065F46', // Example: tailwind green-800
      destructive: '#F87171', // Example: tailwind red-400
      destructiveForeground: '#991B1B', // Example: tailwind red-800
    }
  };

  const currentColors = isDarkTheme ? colors.dark : colors.light;

  const customStyles = {
    variables: {
      light: { // Styles for light mode
        diffViewerBackground: colors.light.background,
        diffViewerColor: colors.light.foreground,
        addedBackground: 'rgba(34, 197, 94, 0.1)', // success/10
        addedColor: colors.light.foreground, // Or a specific green text like colors.light.success
        removedBackground: 'rgba(239, 68, 68, 0.1)', // destructive/10
        removedColor: colors.light.foreground, // Or a specific red text
        wordAddedBackground: 'rgba(34, 197, 94, 0.3)', // success/30
        wordRemovedBackground: 'rgba(239, 68, 68, 0.3)', // destructive/30
        addedGutterBackground: 'rgba(34, 197, 94, 0.15)', // success/15
        removedGutterBackground: 'rgba(239, 68, 68, 0.15)', // destructive/15
        gutterBackground: colors.light.muted,
        gutterBackgroundDark: colors.light.muted, // Kept for structure, but useDarkTheme handles dark mode
        highlightBackground: 'rgba(227, 115, 94, 0.1)', // primary/10
        highlightGutterBackground: 'rgba(227, 115, 94, 0.15)', // primary/15
        codeFoldGutterBackground: colors.light.muted,
        codeFoldBackground: colors.light.muted,
        emptyLineBackground: 'rgba(241, 245, 249, 0.5)', // muted/50
      },
      dark: { // Styles for dark mode
        diffViewerBackground: colors.dark.background,
        diffViewerColor: colors.dark.foreground,
        addedBackground: 'rgba(74, 222, 128, 0.15)', // dark-success/15 (using example dark success)
        addedColor: colors.dark.foreground, // Or a specific green text
        removedBackground: 'rgba(248, 113, 113, 0.15)', // dark-destructive/15 (using example dark destructive)
        removedColor: colors.dark.foreground, // Or a specific red text
        wordAddedBackground: 'rgba(74, 222, 128, 0.3)', // dark-success/30
        wordRemovedBackground: 'rgba(248, 113, 113, 0.3)', // dark-destructive/30
        addedGutterBackground: 'rgba(74, 222, 128, 0.2)', // dark-success/20
        removedGutterBackground: 'rgba(248, 113, 113, 0.2)', // dark-destructive/20
        gutterBackground: colors.dark.muted,
        gutterBackgroundDark: colors.dark.muted, // Should be covered by dark object
        highlightBackground: 'rgba(227, 115, 94, 0.15)', // primary/15 (same primary)
        highlightGutterBackground: 'rgba(227, 115, 94, 0.2)', // primary/20
        codeFoldGutterBackground: colors.dark.muted,
        codeFoldBackground: colors.dark.muted,
        emptyLineBackground: 'rgba(55, 65, 81, 0.5)', // dark-muted/50
      }
    },
    line: {
      padding: '10px 2px',
      fontFamily: 'monospace', // Added for better diff readability
    },
    content: {
      width: '100%',
    },
    codeFold: { // Ensure a border for visibility if background is same as gutter
      border: isDarkTheme ? '1px solid rgba(228, 228, 231, 0.2)' : '1px solid rgba(24, 24, 27, 0.1)', // Example border
    },
    emptyLine: {
       backgroundColor: isDarkTheme ? 'rgba(55, 65, 81, 0.3)' : 'rgba(241, 245, 249, 0.3)', // Make it more subtle
    },
    diffRemoved: { // More specific control
        // Example: Apply a more subtle color if needed
        // color: isDarkTheme ? '#FCA5A5' : '#B91C1C', // Lighter red for dark, darker for light
    },
    diffAdded: {
        // color: isDarkTheme ? '#86EFAC' : '#14532D',
    }
  };

  return (
    <div className="w-full overflow-hidden rounded-md border border-border dark:border-dark-border">
      <ReactDiffViewer
        oldValue={cleanedOriginalContent}
        newValue={cleanedNewContent}
        splitView={viewType === 'split'}
        disableWordDiff={false}
        compareMethod={DiffMethod.WORDS}
        useDarkTheme={isDarkTheme}
        styles={customStyles}
        leftTitle={originalTitle}
        rightTitle={newTitle}
        extraLinesSurroundingDiff={3}
      />
    </div>
  );
};

export default DiffViewer;

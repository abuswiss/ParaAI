interface IdentifiedObjectionsDisplayProps {
  objections: AIIdentifiedObjection[];
  isDisabled?: boolean;
}

interface KeyExcerptsDisplayProps {
  excerpts: AIKeyExcerpt[];
  documentsMap: Map<string, { filename: string; title?: string; }>;
  isDisabled?: boolean;
}

interface SimpleListDisplayProps {
  title: string;
  items?: string[];
  iconType?: string; // 'potentialIssues', 'suggestedSteps', etc.
  isDisabled?: boolean;
} 
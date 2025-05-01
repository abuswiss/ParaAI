export interface CourtListenerSnippet {
    url: string;
    title: string;
    content?: string; // Snippet content preview
    date?: string; // e.g., date filed
    case_name?: string; // Often same as title, but could differ
}

export interface PerplexitySource {
    url: string;
    title: string;
    snippet?: string; // Re-confirm: Make snippet optional
    // Add other fields if the API provides them (e.g., favicon)
}

// General Source type (union or common interface if structures align enough)
export type SourceInfo = CourtListenerSnippet | PerplexitySource; 

// Other shared types can go here... 
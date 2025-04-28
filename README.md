# Paralegal AI Assistant

A modern AI-powered assistant for legal professionals to streamline document management, analysis, and drafting tasks.

## Features

- **Document Management**: Upload, organize, and store legal documents
- **AI Chat Interface**: Interact with AI assistant for legal queries
- **AI Live Search**: Instantly ask up-to-date legal questions with sources, powered by a live search agent (highlighted at the top of the /agent list)
- **Document Analysis**: Extract key information from legal documents
- **Timeline Generation**: Create chronological timelines from document events
- **Draft Creation**: Generate and edit legal document drafts
- **Search Capability**: Find information across documents and conversations

## Recent Updates

- **AI Live Search Agent**: The Perplexity agent has been renamed to **AI Live Search** and is now featured at the top of the `/agent` command list, highlighted with a gradient background for visibility.
- **No Perplexity Branding**: All references to "Perplexity" have been removed from the UI and documentation.
- **Sources Display**: When using AI Live Search, sources are now shown below the streamed response as clickable links.
- **Improved Command List**: The `/agent` command dropdown now visually highlights AI Live Search and provides clearer descriptions and examples for all agents.
- **UI/UX Enhancements**: Various improvements to chat, command hints, and error handling for a smoother experience.

## Tech Stack

- **Frontend**: React with TypeScript
- **State Management**: React Context API with custom hooks
- **Styling**: Tailwind CSS
- **Authentication**: Supabase Auth
- **Database**: Supabase PostgreSQL
- **Storage**: Supabase Storage
- **AI Integration**: OpenAI API

## Getting Started

### Prerequisites

- Node.js (v16+)
- Supabase account
- OpenAI API key

### Setup

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Copy `.env.example` to `.env` and fill in your API keys:
   ```bash
   cp .env.example .env
   ```
4. Start the development server:
   ```bash
   npm run dev
   ```

## Project Structure

```
src/
├── assets/         # Static assets
├── components/     # Reusable components
├── context/        # React context providers
├── hooks/          # Custom React hooks
├── lib/            # External service clients
├── pages/          # Page components
├── services/       # API and business logic
├── types/          # TypeScript type definitions
└── utils/          # Utility functions
```

## Database Schema

The application uses Supabase as the database and storage solution with the following main tables:

- `profiles`: User profile information
- `documents`: Document metadata and references
- `cases`: Legal cases containing documents
- `conversations`: Chat conversation metadata
- `messages`: Individual chat messages

## Security

This application implements Row Level Security (RLS) in Supabase to ensure users can only access their own data. API keys are stored securely in environment variables and are never exposed to the client.

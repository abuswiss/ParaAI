import React from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
// import { checkSupabaseEnv } from './utils/envCheck' // Commented out - file not found
import { AuthProvider } from './context/AuthContext'
import App from './App'

// Create a client
const queryClient = new QueryClient()

// const envCheck = checkSupabaseEnv(); // Commented out - function source not found

// if (!envCheck.valid) {
//   // Render an error message or a diagnostic component
//   // For example, you could render a simple message:
//   document.getElementById("root")!.innerHTML = `
//     <div style="padding: 20px; font-family: sans-serif;">
//       <h1>Configuration Error</h1>
//       <p>Supabase environment variables are missing or invalid.</p>
//       <p>Please check your .env file and ensure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set correctly.</p>
//       <ul>
//         ${envCheck.missing.map(key => `<li>Missing: ${key}</li>`).join('')}
//       </ul>
//     </div>
//   `;
// } else {
  // Environment variables are okay, render the app
  createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <AuthProvider>
        <QueryClientProvider client={queryClient}>
          <App />
        </QueryClientProvider>
      </AuthProvider>
    </React.StrictMode>,
  )
// }

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tsconfigPaths from 'vite-tsconfig-paths'
import path from "path"

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  return {
    plugins: [
      react(), 
      tsconfigPaths({
        ignoreConfigErrors: true,
        projects: ["."],
        exclude: [
          "**/paralegal-ai-assistant/mp/**", 
          "**/paralegal-ai-assistant/my app/**",
          "**/node_modules/**"
        ]
      })
    ],
    // Define process.env.NODE_ENV for compatibility
    define: {
      'process.env.NODE_ENV': JSON.stringify(mode),
      // Add other process.env variables if needed, but be careful
      // 'process.env.SOME_VAR': JSON.stringify(process.env.SOME_VAR || 'default')
    },
    server: {
      proxy: {
        // Proxy requests specifically for /api/supabase to your Supabase functions URL
        '/api/supabase': {
          target: 'https://unljodyhmrrluitblnrm.functions.supabase.co', // Your Supabase Function URL
          changeOrigin: true, // Recommended for CORS
          rewrite: (path) => path.replace(/^\/api\/supabase/, ''), // Remove /api/supabase prefix
        },
        // Keep other /api proxies if needed, e.g., for a separate local backend
        // '/api': 'http://localhost:3001' // If you still need this for other /api routes
      }
    },
  }
})

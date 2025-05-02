import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tsconfigPaths from 'vite-tsconfig-paths'
import path from "path"

// https://vite.dev/config/
export default defineConfig({
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
  server: {
    proxy: {
      '/api': 'http://localhost:3001'
    }
  },
})

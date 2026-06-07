import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

/**
 * VITE CONFIGURATION
 * ==================
 * 
 * KEY SETTINGS:
 * 
 * 1. tailwindcss() plugin — Integrates Tailwind CSS v4 with Vite's build pipeline.
 *    Unlike v3, Tailwind v4 uses a Vite plugin instead of PostCSS config.
 * 
 * 2. server.proxy — This is crucial for development!
 *    When your React app (port 5173) makes a request to /api/auth/login,
 *    Vite intercepts it and forwards it to your Express server (port 5000).
 *    This avoids CORS issues during development.
 *    
 *    Without proxy: fetch('http://localhost:5000/api/auth/login') — CORS error!
 *    With proxy:    fetch('/api/auth/login') — Works! Vite forwards it.
 */
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
      '/socket.io': {
        target: 'http://localhost:5000',
        ws: true,        // Enable WebSocket proxying
        changeOrigin: true,
      },
    },
  },
})

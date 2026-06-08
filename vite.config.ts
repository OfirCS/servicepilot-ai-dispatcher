import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
// Relative base so the built site works both on Netlify (root) and on
// GitHub Pages (served from /<repo>/).
export default defineConfig({
  base: './',
  plugins: [react()],
})

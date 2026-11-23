import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base './' : chemins relatifs, pour fonctionner aussi bien sur GitHub Pages
// (https://pseudo.github.io/depot/) qu'à la racine d'un domaine.
export default defineConfig({
  base: './',
  plugins: [react()],
})

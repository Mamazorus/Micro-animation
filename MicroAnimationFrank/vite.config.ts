import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    // La minification CSS d'esbuild fusionne `backdrop-filter` et son préfixe
    // `-webkit-backdrop-filter` et n'en garde qu'un seul → le flou des cartes
    // (verre dépoli qui floute Frank derrière) tombait en build/prod alors qu'il
    // marchait en dev. On la désactive : le CSS de prod conserve les deux
    // propriétés, identique au dev. (gain de poids négligeable une fois gzippé.)
    cssMinify: false,
  },
})

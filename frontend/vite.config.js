import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true, // 0.0.0.0 - necesario para acceder desde fuera del contenedor Docker
    open: false, // dentro de Docker no hay navegador que abrir
    watch: {
      usePolling: true, // asegura que detecte cambios cuando el código está en un volumen montado
    },
  },
  build: {
    outDir: 'dist',
  },
})

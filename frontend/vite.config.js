import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Listen on every interface so a phone on the same Wi-Fi can open the app.
    host: true,
    port: 5173,
    strictPort: true,
  },
})

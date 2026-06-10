import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    // Allows requests from public tunnels like localhost.run
    allowedHosts: true,
    host: true
  }
});

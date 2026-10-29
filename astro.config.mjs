import { defineConfig, envField } from 'astro/config';
import node from '@astrojs/node';
import cloudflare from '@astrojs/cloudflare';
import tailwindcss from '@tailwindcss/vite';

const secret = (opts = {}) => envField.string({ context: 'server', access: 'secret', ...opts });

// Destino del build: Node (local y Railway, por defecto) o Cloudflare Workers (DEPLOY_TARGET=cloudflare)
const isCloudflare = process.env.DEPLOY_TARGET === 'cloudflare';

export default defineConfig({
  output: 'server',
  // Variables leídas en tiempo de ejecución (no se incrustan en el build)
  env: {
    schema: {
      DATABASE_URL:         secret({ default: 'file:./local.db' }),
      DATABASE_AUTH_TOKEN:  secret({ optional: true }),
      BETTER_AUTH_URL:      secret({ default: 'http://localhost:4321' }),
      BETTER_AUTH_SECRET:   secret(),
      // Opcionales: sin ellas no hay login con Google (en local: npm run dev:login)
      GOOGLE_CLIENT_ID:     secret({ optional: true }),
      GOOGLE_CLIENT_SECRET: secret({ optional: true }),
    },
  },
  adapter: isCloudflare
    // Sin servicio de imágenes de Cloudflare (no se usa astro:assets): no requiere binding IMAGES
    ? cloudflare({ imageService: 'passthrough' })
    : node({ mode: 'standalone' }),
  vite: {
    plugins: [tailwindcss()],
    resolve: {
      alias: {
        '@': '/src',
      },
    },
  },
});
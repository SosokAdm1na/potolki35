// @ts-check
import { defineConfig } from 'astro/config';

import tailwindcss from '@tailwindcss/vite';
import node from '@astrojs/node';

// https://astro.build/config
export default defineConfig({
  site: 'https://xn--35-vlcherag2a.xn--p1ai',
  trailingSlash: 'always',
  devToolbar: { enabled: false },
  vite: {
    plugins: [tailwindcss()]
  },

  adapter: node({
    mode: 'standalone'
  })
});
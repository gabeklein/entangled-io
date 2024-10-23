import apiPlugin from '@entangled/vite';
import jsxPlugin from '@expressive/vite-plugin';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [
    jsxPlugin(),
    apiPlugin({
      include: /@example\/(\w+)/,
      baseUrl: "http://localhost:8080"
    })
  ]
})
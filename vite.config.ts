import { sveltekit } from '@sveltejs/kit/vite'
import tailwindcss from '@tailwindcss/vite'
import { svelteTesting } from '@testing-library/svelte/vite'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [tailwindcss(), sveltekit(), svelteTesting()],
  resolve: {
    conditions: ['browser'],
  },
  test: {
    environment: 'jsdom',
    globals: true,
  },
})

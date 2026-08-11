import { defineConfig } from 'vite';

// base: './' makes built asset URLs relative, so the site works when deployed
// under a subpath. Only affects the optional `npm run build` bundle; the
// deployed site is served straight from source and needs no build.
export default defineConfig({
  base: './',
});

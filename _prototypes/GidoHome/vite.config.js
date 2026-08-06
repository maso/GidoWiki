import { defineConfig } from 'vite';

// base: './' makes built asset URLs relative, so the site works when deployed
// under a subpath (e.g. https://<user>.github.io/GidoWiki/_prototypes/GidoHome/dist/).
export default defineConfig({
  base: './',
});

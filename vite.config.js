import fs from 'node:fs';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

/**
 * `import logo from './logo.png?datauri'` -> "data:image/png;base64,...."
 * Reads the file straight from disk so the result is identical in dev, in the production
 * build and in the automated tests (Vitest does not inline image imports on its own).
 * The PDF / Word exporters use this so they never need a network request for the logo.
 */
function dataUriPlugin() {
  const SUFFIX = '?datauri';
  return {
    name: 'sf-data-uri',
    enforce: 'pre',
    async resolveId(source, importer) {
      if (!source.endsWith(SUFFIX)) return null;
      const resolved = await this.resolve(source.slice(0, -SUFFIX.length), importer, { skipSelf: true });
      return resolved ? `${resolved.id}${SUFFIX}` : null;
    },
    load(id) {
      if (!id.endsWith(SUFFIX)) return null;
      const file = id.slice(0, -SUFFIX.length);
      this.addWatchFile(file);
      const ext = file.split('.').pop().toLowerCase();
      const mime = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : ext === 'svg' ? 'image/svg+xml' : `image/${ext}`;
      const base64 = fs.readFileSync(file).toString('base64');
      return `export default ${JSON.stringify(`data:${mime};base64,${base64}`)};`;
    },
  };
}

export default defineConfig({
  plugins: [dataUriPlugin(), react()],
  build: {
    // The PDF / Word / Excel export libraries are large but are loaded on demand.
    chunkSizeWarningLimit: 1500,
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.js',
    css: false,
  },
});

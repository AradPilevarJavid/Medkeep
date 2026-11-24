import { defineConfig } from 'vitest/config';
import type { Plugin } from 'vite';

const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
].join('; ');

/**
 * GitHub Pages cannot send response headers, so the policy is injected into
 * the built HTML only. Development stays unencumbered by Vite's inline HMR
 * helpers, which a strict `style-src 'self'` would block.
 */
function contentSecurityPolicy(): Plugin {
  return {
    name: 'medkeep-csp',
    apply: 'build',
    transformIndexHtml() {
      return [
        {
          tag: 'meta',
          attrs: {
            'http-equiv': 'Content-Security-Policy',
            content: CONTENT_SECURITY_POLICY,
          },
          injectTo: 'head-prepend',
        },
      ];
    },
  };
}

export default defineConfig({
  base: process.env.VITE_BASE ?? '/',
  plugins: [contentSecurityPolicy()],
  build: {
    target: 'es2022',
    cssCodeSplit: false,
    sourcemap: false,
  },
  test: {
    environment: 'jsdom',
    include: ['tests/unit/**/*.test.ts', 'tests/ui/**/*.test.ts', 'tests/types/**/*.test.ts'],
    restoreMocks: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/domain/**/*.ts', 'src/data/**/*.ts', 'src/lib/**/*.ts'],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 75,
        statements: 80,
      },
    },
  },
});

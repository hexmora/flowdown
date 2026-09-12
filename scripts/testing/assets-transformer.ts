import type { createTransformer } from '@swc/jest';

import { transform } from '@svgr/core';
import { transformSync } from '@swc/core';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { compileString } from 'sass';

const prefixPath = fileURLToPath(
  new URL('../../packages/react-presets/src/styles/_prefix.scss', import.meta.url),
);

const transformer: ReturnType<typeof createTransformer> = {
  getCacheKey(source, filename, options) {
    return createHash('sha256')
      .update(source)
      .update(filename)
      .update(options.configString)
      .update(readFileSync(fileURLToPath(import.meta.url)))
      .update(readFileSync(prefixPath))
      .digest('hex');
  },

  process(source, filename) {
    if (filename.endsWith('.svg')) {
      const jsx = transform.sync(
        source,
        {
          plugins: ['@svgr/plugin-jsx'],
          jsxRuntime: 'automatic',
        },
        { filePath: filename },
      );

      return transformSync(jsx, {
        filename,
        jsc: {
          parser: { syntax: 'ecmascript', jsx: true },
          transform: { react: { runtime: 'automatic' } },
        },
        module: { type: 'commonjs' },
      });
    }

    if (filename.endsWith('prefix.module.scss')) {
      const { css } = compileString(source, {
        url: pathToFileURL(filename),
        importers: [
          { findFileUrl: (url) => (url === '@prefix' ? pathToFileURL(prefixPath) : null) },
        ],
      });

      const declarations = css.match(/:export\s*\{([^}]+)\}/)?.[1];

      if (!declarations) {
        throw new Error(`Missing CSS module exports in ${filename}`);
      }

      const values = Object.fromEntries(
        [...declarations.matchAll(/([\w-]+)\s*:\s*([^;]+);/g)].map(([, name, value]) => [
          name,
          value.trim(),
        ]),
      );

      return { code: `module.exports = ${JSON.stringify(values)};` };
    }

    if (/\.module\.(?:css|scss|sass|less)$/.test(filename)) {
      return {
        code: "module.exports = new Proxy({}, { get: (_, key) => key === '__esModule' ? false : key });",
      };
    }

    // Preserve module identity so the SSR regression can reject browser-only CSS imports.
    return { code: 'module.exports = {};' };
  },
};

export default transformer;

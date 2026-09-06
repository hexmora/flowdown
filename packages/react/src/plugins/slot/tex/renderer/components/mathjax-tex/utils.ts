import { liteAdaptor } from 'mathjax-full/js/adaptors/liteAdaptor.js';
import { RegisterHTMLHandler } from 'mathjax-full/js/handlers/html.js';
import { TeX } from 'mathjax-full/js/input/tex.js';
import { AllPackages } from 'mathjax-full/js/input/tex/AllPackages.js';
import { mathjax } from 'mathjax-full/js/mathjax.js';
import { SVG } from 'mathjax-full/js/output/svg.js';
import { SafeHandler } from 'mathjax-full/js/ui/safe/SafeHandler.js';

const adaptor = liteAdaptor();

SafeHandler(RegisterHTMLHandler(adaptor));

const createDocument = () =>
  mathjax.document('', {
    InputJax: new TeX({
      packages: AllPackages.filter((name) => name !== 'noerrors' && name !== 'noundefined').concat(
        'physics',
      ),
      maxBuffer: 32 * 1024,
      maxMacros: 1000,
      macros: {
        equalparallel:
          '{\\lower{2.6pt}{\\arrowvert\\hspace{-4.2pt}\\arrowvert}\\above{-2pt}\\raise{7.5pt}{=}}',
        number: ['{#1}', 1],
        unit: ['{#1}', 1],
        div: '{÷}',
      },
      formatError: (_jax: unknown, error: Error) => {
        throw error;
      },
    }),
    OutputJax: new SVG({ fontCache: 'none' }),
    safeOptions: {
      allow: {
        URLs: 'none',
        classes: 'none',
        cssIDs: 'none',
        styles: 'safe',
      },
    },
  });

export const texToSvg = (tex: string, mode: 'display' | 'inline') => {
  const source = tex.replace(/\p{Cc}/gu, (character) =>
    character === '\n' || character === '\t' ? character : '',
  );

  try {
    // TeX retains user-defined macros, so each formula needs its own parsing context.
    const document = createDocument();
    const node = document.convert(source, {
      display: mode === 'display',
      em: 16,
      ex: 8,
      containerWidth: 80 * 16,
    });

    if (adaptor.tags(node, 'g').some((child) => adaptor.hasAttribute(child, 'data-mjx-error'))) {
      return null;
    }

    return adaptor.outerHTML(node);
  } catch {
    return null;
  }
};

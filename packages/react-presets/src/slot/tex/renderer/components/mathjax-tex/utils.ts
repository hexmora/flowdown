import { MathJaxTexFont } from '@mathjax/mathjax-tex-font/js/svg.js';
import { liteAdaptor } from '@mathjax/src/js/adaptors/liteAdaptor.js';
import { RegisterHTMLHandler } from '@mathjax/src/js/handlers/html.js';
import { TeX } from '@mathjax/src/js/input/tex.js';
import { mathjax } from '@mathjax/src/js/mathjax.js';
import { SVG } from '@mathjax/src/js/output/svg.js';
import { SafeHandler } from '@mathjax/src/js/ui/safe/SafeHandler.js';
import '@mathjax/src/js/input/tex/action/ActionConfiguration.js';
import '@mathjax/src/js/input/tex/ams/AmsConfiguration.js';
import '@mathjax/src/js/input/tex/amscd/AmsCdConfiguration.js';
import '@mathjax/src/js/input/tex/bbox/BboxConfiguration.js';
import '@mathjax/src/js/input/tex/boldsymbol/BoldsymbolConfiguration.js';
import '@mathjax/src/js/input/tex/braket/BraketConfiguration.js';
import '@mathjax/src/js/input/tex/bussproofs/BussproofsConfiguration.js';
import '@mathjax/src/js/input/tex/cancel/CancelConfiguration.js';
import '@mathjax/src/js/input/tex/cases/CasesConfiguration.js';
import '@mathjax/src/js/input/tex/centernot/CenternotConfiguration.js';
import '@mathjax/src/js/input/tex/color/ColorConfiguration.js';
import '@mathjax/src/js/input/tex/colortbl/ColortblConfiguration.js';
import '@mathjax/src/js/input/tex/configmacros/ConfigMacrosConfiguration.js';
import '@mathjax/src/js/input/tex/empheq/EmpheqConfiguration.js';
import '@mathjax/src/js/input/tex/enclose/EncloseConfiguration.js';
import '@mathjax/src/js/input/tex/extpfeil/ExtpfeilConfiguration.js';
import '@mathjax/src/js/input/tex/gensymb/GensymbConfiguration.js';
import '@mathjax/src/js/input/tex/html/HtmlConfiguration.js';
import '@mathjax/src/js/input/tex/mathtools/MathtoolsConfiguration.js';
import '@mathjax/src/js/input/tex/mhchem/MhchemConfiguration.js';
import '@mathjax/src/js/input/tex/newcommand/NewcommandConfiguration.js';
import '@mathjax/src/js/input/tex/physics/PhysicsConfiguration.js';
import '@mathjax/src/js/input/tex/tagformat/TagFormatConfiguration.js';
import '@mathjax/src/js/input/tex/textcomp/TextcompConfiguration.js';
import '@mathjax/src/js/input/tex/textmacros/TextMacrosConfiguration.js';
import '@mathjax/src/js/input/tex/upgreek/UpgreekConfiguration.js';
import '@mathjax/src/js/input/tex/unicode/UnicodeConfiguration.js';
import '@mathjax/src/js/input/tex/verb/VerbConfiguration.js';

const texPackages = [
  'base',
  'action',
  'ams',
  'amscd',
  'bbox',
  'boldsymbol',
  'braket',
  'bussproofs',
  'cancel',
  'cases',
  'centernot',
  'color',
  'colortbl',
  'empheq',
  'enclose',
  'extpfeil',
  'gensymb',
  'html',
  'mathtools',
  'mhchem',
  'newcommand',
  'upgreek',
  'unicode',
  'verb',
  'configmacros',
  'tagformat',
  'textcomp',
  'textmacros',
  'physics',
];

const adaptor = liteAdaptor();

SafeHandler(RegisterHTMLHandler(adaptor));

const createDocument = () =>
  mathjax.document('', {
    InputJax: new TeX({
      packages: texPackages,
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
    // The original TeX font keeps conversion synchronous without dynamic font loading.
    OutputJax: new SVG({ fontCache: 'none', fontData: MathJaxTexFont }),
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

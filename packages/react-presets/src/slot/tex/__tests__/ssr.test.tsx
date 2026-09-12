/** @jest-environment node */

import type { Element } from 'hast';

import { PassThrough } from 'node:stream';
import { renderToPipeableStream } from 'react-dom/server';

import { TexRenderer } from '../renderer';

jest.mock('katex/dist/katex.min.css', () => {
  throw new Error('KaTeX CSS must not be imported during server rendering');
});

const node: Element = {
  type: 'element',
  tagName: 'span',
  properties: {},
  children: [],
};

describe('server math rendering', () => {
  test('resolves lazy KaTeX without importing browser styles', async () => {
    const html = await new Promise<string>((resolve, reject) => {
      const output = new PassThrough();
      let content = '';

      output.setEncoding('utf8');
      output.on('data', (chunk: string) => {
        content += chunk;
      });
      output.on('end', () => resolve(content));
      output.on('error', reject);

      const { pipe } = renderToPipeableStream(
        <TexRenderer
          Raw={null}
          current={node}
          mode="display"
          parents={[]}
          render={() => null}
          tex={'\\frac{1}{2}'}
        />,
        {
          onAllReady: () => pipe(output),
          onError: reject,
        },
      );
    });

    expect(html).toContain('class="katex-display"');
    expect(html).toContain('class="katex"');
    expect(html).toContain('<math');
    expect(html).toContain('<mfrac>');
  });
});

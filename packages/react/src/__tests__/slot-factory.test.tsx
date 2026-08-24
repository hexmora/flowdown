import type { Element } from 'hast';
import type { ComponentProps } from 'react';

import { render, screen } from '@testing-library/react';
import { describe, expect, expectTypeOf, test, vi } from 'vitest';

import type { ParagraphProps } from '../types';

import { createTypeOfSlot, SlotProvider } from '../components';
import { BaseSlotPlugin } from '../plugins/slot';

const paragraphNode: Element = {
  children: [],
  properties: {},
  tagName: 'p',
  type: 'element',
};

const FirstParagraph = ({ children }: ParagraphProps) => <span>first:{children}</span>;

const SecondParagraph = ({ Raw, ...props }: ParagraphProps) => (
  <span data-testid="factory-second">second:[{Raw ? <Raw {...props} /> : props.children}]</span>
);

class FirstParagraphPlugin extends BaseSlotPlugin<'Paragraph'> {
  static readonly key = 'test-factory-first-paragraph';

  readonly Component = FirstParagraph;

  readonly type = 'Paragraph';
}

class SecondParagraphPlugin extends BaseSlotPlugin<'Paragraph'> {
  static readonly key = 'test-factory-second-paragraph';

  readonly Component = SecondParagraph;

  readonly type = 'Paragraph';
}

const Paragraph = createTypeOfSlot('Paragraph');

const paragraph = (
  <Paragraph current={paragraphNode} parents={[]} render={() => null}>
    content
  </Paragraph>
);

const preventExpectedError = (event: ErrorEvent) => event.preventDefault();

describe('createTypeOfSlot', () => {
  test('infers the exact prop contract for the requested slot type', () => {
    expectTypeOf<ComponentProps<typeof Paragraph>>().toEqualTypeOf<ParagraphProps>();
  });

  test('requires a provider when the typed slot is rendered', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    window.addEventListener('error', preventExpectedError);

    try {
      expect(() => render(paragraph)).toThrow(/slot.*(?:provider|context)|context.*required/i);
    } finally {
      window.removeEventListener('error', preventExpectedError);

      consoleError.mockRestore();
    }
  });

  test('renders null when its provider has no plugin for the requested type', () => {
    const view = render(<SlotProvider plugins={[]}>{paragraph}</SlotProvider>);

    expect(view.container).toBeEmptyDOMElement();
  });

  test('uses the existing Raw composition boundary in declaration order', () => {
    render(
      <SlotProvider plugins={[FirstParagraphPlugin, SecondParagraphPlugin]}>
        {paragraph}
      </SlotProvider>,
    );

    expect(screen.getByTestId('factory-second')).toHaveTextContent('second:[first:content]');
  });
});

describe('BaseSlotPlugin', () => {
  test('provides empty config and an idempotent no-op destroy by default', () => {
    const plugin = new FirstParagraphPlugin();

    expect(plugin.config).toEqual({});

    expect(plugin.destroy()).toBeUndefined();

    expect(plugin.destroy()).toBeUndefined();
  });
});

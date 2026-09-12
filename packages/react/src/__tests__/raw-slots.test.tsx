import type {
  AnySlotPluggable,
  HeadingProps,
  ParagraphProps,
  RuntimeSlotProps,
  SlotInputProps,
  SlotPositionType,
} from '@fluxdown/react-presets/base';
import type { Element } from 'hast';
import type { ComponentType } from 'react';

import { createTypeOfSlot, SlotProvider } from '@fluxdown/react-presets/base';
import { PRESET_SLOT_PLUGINS } from '@fluxdown/react-presets/slot';
import { render, screen } from '@testing-library/react';
import { expectTypeOf } from 'expect-type';

import { Fluxdown } from '..';

const node: Element = {
  children: [],
  properties: {},
  tagName: 'p',
  type: 'element',
};

const Paragraph = createTypeOfSlot('Paragraph');

const paragraphProps: SlotInputProps<'Paragraph'> = {
  children: 'content',
  current: node,
  parents: [],
  render: () => null,
};

const createParagraphPlugin = (key: string, Component: ComponentType<ParagraphProps>) => {
  return class ParagraphPlugin {
    static readonly key = key;

    readonly Component = Component;

    readonly config = {};

    readonly type = 'Paragraph';

    destroy() {}
  };
};

const StyledParagraphPlugin = createParagraphPlugin('slot-paragraph', ({ Raw, ...props }) =>
  Raw ? <Raw {...props} className="custom-paragraph" style={{ color: 'red' }} /> : null,
);

const OuterParagraphPlugin = createParagraphPlugin('outer-paragraph', (props) => (
  <section data-testid="outer-paragraph">{props.Raw ? <props.Raw {...props} /> : null}</section>
));

class FirstCodeHeaderPlugin {
  static readonly key = 'test-code-header';

  readonly Component = () => <span>First header</span>;

  readonly config = {};

  readonly type = 'CodeHeader';

  destroy() {}
}

class SecondCodeHeaderPlugin extends FirstCodeHeaderPlugin {
  readonly Component = () => <span>Second header</span>;
}

describe('Raw slots', () => {
  test('requires a nullable Raw on every slot component', () => {
    expectTypeOf<RuntimeSlotProps>().toExtend<{ Raw: unknown }>();

    expectTypeOf<RuntimeSlotProps>().toHaveProperty('Raw').extract<null>().toBeNull();

    expectTypeOf<RuntimeSlotProps>().toHaveProperty('Raw').extract<undefined>().toBeNever();
  });

  test('retains each slot prop contract while excluding recursive Raw props', () => {
    expectTypeOf<ParagraphProps>()
      .toHaveProperty('Raw')
      .branded.toEqualTypeOf<SlotPositionType<SlotInputProps<'Paragraph'>>>();

    expectTypeOf<HeadingProps>()
      .toHaveProperty('Raw')
      .branded.toEqualTypeOf<SlotPositionType<SlotInputProps<'Heading'>>>();

    expectTypeOf<SlotInputProps<'Heading'>>().toHaveProperty('level').toEqualTypeOf<number>();

    expectTypeOf<SlotInputProps<'Paragraph'>>().not.toHaveProperty('Raw');
  });

  test.each(PRESET_SLOT_PLUGINS)('provides the default renderer to an override of %s', (Preset) => {
    const type = new Preset().type;

    const capture = jest.fn();

    class OverrideSlotPlugin {
      static readonly key = `override-${type}`;

      readonly config = {};

      readonly type = type;

      readonly Component = ({ Raw }: { Raw: unknown }) => {
        capture(Raw);

        return null;
      };

      destroy() {}
    }

    const Slot = createTypeOfSlot(type);

    render(
      <SlotProvider plugins={[Preset, OverrideSlotPlugin as AnySlotPluggable]}>
        <Slot {...(paragraphProps as SlotInputProps<typeof type>)} />
      </SlotProvider>,
    );

    expect(capture).toHaveBeenCalledTimes(1);

    expect(capture).toHaveBeenCalledWith(expect.any(Function));
  });

  test('preserves the default renderer when a custom plugin reuses its key', () => {
    const { container } = render(
      <Fluxdown plugins={[{ slots: [StyledParagraphPlugin] }]} text="styled content" />,
    );

    const paragraph = screen.getByText('styled content');

    expect(paragraph).toHaveClass('custom-paragraph');

    expect(paragraph.classList.length).toBeGreaterThan(1);

    expect(paragraph).toHaveStyle({ color: 'rgb(255, 0, 0)' });

    expect(container.querySelector('[raw], [current], [parents], [render]')).toBeNull();
  });

  test('keeps earlier customizations when later overrides invoke Raw with all their props', () => {
    const { container } = render(
      <Fluxdown
        plugins={[{ slots: [StyledParagraphPlugin] }, { slots: [OuterParagraphPlugin] }]}
        text="layered content"
      />,
    );

    const paragraph = screen.getByText('layered content');

    expect(screen.getByTestId('outer-paragraph')).toContainElement(paragraph);

    expect(paragraph).toHaveClass('custom-paragraph');

    expect(paragraph.classList.length).toBeGreaterThan(1);

    expect(container.querySelector('[raw], [current], [parents], [render]')).toBeNull();
  });

  test('resets Raw to null in the first slot layer when an override forwards all props', () => {
    let receivedProps: ParagraphProps | undefined;

    const FirstPlugin = createParagraphPlugin('raw-first', (props) => {
      receivedProps = props;

      return <span>{props.children}</span>;
    });

    render(
      <SlotProvider plugins={[FirstPlugin, OuterParagraphPlugin]}>
        <Paragraph {...paragraphProps} />
      </SlotProvider>,
    );

    expect(screen.getByTestId('outer-paragraph')).toHaveTextContent('content');

    expect(receivedProps).toMatchObject(paragraphProps);

    expect(receivedProps).toHaveProperty('Raw', null);
  });

  test('updates and removes overrides without losing the default renderer', () => {
    const { rerender } = render(
      <Fluxdown plugins={[{ slots: [StyledParagraphPlugin] }]} text="changing content" />,
    );

    expect(screen.getByText('changing content')).toHaveClass('custom-paragraph');

    rerender(<Fluxdown plugins={[{ slots: [OuterParagraphPlugin] }]} text="changing content" />);

    expect(screen.getByTestId('outer-paragraph')).toHaveTextContent('changing content');

    expect(screen.getByText('changing content')).not.toHaveClass('custom-paragraph');

    rerender(<Fluxdown text="changing content" />);

    expect(screen.queryByTestId('outer-paragraph')).not.toBeInTheDocument();

    expect(screen.getByText('changing content').classList.length).toBeGreaterThan(0);
  });

  test.each([
    { plugins: [], description: 'default paragraph' },
    { plugins: [StyledParagraphPlugin], description: 'one paragraph override' },
    {
      plugins: [StyledParagraphPlugin, OuterParagraphPlugin],
      description: 'multiple paragraph overrides',
    },
  ])('preserves $description when another slot changes', ({ plugins }) => {
    const { rerender } = render(
      <Fluxdown
        plugins={[{ slots: [...plugins, FirstCodeHeaderPlugin] }]}
        text="stable paragraph"
      />,
    );

    const paragraph = screen.getByText('stable paragraph');

    rerender(
      <Fluxdown
        plugins={[{ slots: [...plugins, SecondCodeHeaderPlugin] }]}
        text="stable paragraph"
      />,
    );

    expect(screen.getByText('stable paragraph')).toBe(paragraph);
  });

  test.each([
    { plugins: [], description: 'default Raw' },
    { plugins: [StyledParagraphPlugin], description: 'composed Raw' },
  ])('isolates $description between rendered instances', ({ plugins }) => {
    const captured = new Set<SlotPositionType<SlotInputProps<'Paragraph'>>>();

    const CapturePlugin = createParagraphPlugin('capture-raw-instance', ({ Raw, ...props }) => {
      captured.add(Raw);

      return Raw ? <Raw {...props} /> : null;
    });

    render(
      <>
        <Fluxdown plugins={[{ slots: [...plugins, CapturePlugin] }]} text="first" />
        <Fluxdown plugins={[{ slots: [...plugins, CapturePlugin] }]} text="second" />
      </>,
    );

    expect(captured.size).toBe(2);

    for (const Raw of captured) {
      expect(typeof Raw).toBe('function');
    }

    expect(screen.getByText('first')).toBeInTheDocument();

    expect(screen.getByText('second')).toBeInTheDocument();
  });

  test('creates a fresh composition when a slot renderer remounts', () => {
    const capture = jest.fn();

    const CapturePlugin = createParagraphPlugin('capture-remounted-raw', ({ Raw, ...props }) => {
      capture(Raw);

      return Raw ? <Raw {...props} /> : null;
    });

    const view = (key: string) => (
      <Fluxdown key={key} plugins={[{ slots: [CapturePlugin] }]} text="content" />
    );

    const { rerender } = render(view('first'));

    const firstRaw = capture.mock.lastCall?.[0];

    expect(typeof firstRaw).toBe('function');

    rerender(view('second'));

    expect(typeof capture.mock.lastCall?.[0]).toBe('function');

    expect(capture.mock.lastCall?.[0]).not.toBe(firstRaw);

    expect(screen.getByText('content')).toBeInTheDocument();
  });
});

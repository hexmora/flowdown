import type {
  IBlockMeta,
  IRawPatchItem,
  IRawPatchRange,
  IRehypePlugin,
  IRemarkPlugin,
} from '@flowdown/types';
import type { RootContent } from 'hast';

import { isEqual, last, times, uniq } from 'lodash-es';
import {
  BaseStateClosure,
  type IReactiveState,
  type IReadableClosure,
  mapState,
  MutableState,
  ReactiveState,
  type ReadableClosureSource,
  render,
  S,
  toClosure,
} from 'reactive';
import { describe, expect, test, vi } from 'vitest';

import type { HastRoot } from '../../../../typings';
import type { IBlockSection } from '../../../base';

import { BlockCompiler, type BlockCompilerConfig, type BlockRemarksConfig } from '../index';

type SourceInputs<T> = {
  source: IReadableClosure<T>;
};

class Source<T> extends BaseStateClosure<T, SourceInputs<T>> {
  protected render() {
    const { source } = this.inputs;

    return source;
  }
}

const DEFAULT_CONFIG: BlockCompilerConfig = {
  repair: false,
  repairEnding: false,
  footnote: false,
  tex: false,
};

const patch = (key: string, range: IRawPatchRange = 0): IRawPatchItem => ({
  key,
  range,
});

const section = (text: string, patches: IRawPatchItem[] = []): IBlockSection => ({
  text,
  patches,
});

const collectText = (node: HastRoot | RootContent): string => {
  if (node.type === 'text') {
    return node.value;
  }

  if ('children' in node) {
    return node.children.map((child) => collectText(child)).join('');
  }

  return '';
};

const createRemarkAppender = (value: string, run = vi.fn()) => {
  const plugin: IRemarkPlugin = {
    config: {},
    destroy: vi.fn(),
    plugin: () => (tree) => {
      run();

      const lastChild = last(tree.children);

      if (lastChild?.type === 'paragraph') {
        lastChild.children.push({ type: 'text', value });
      } else {
        tree.children.push({
          type: 'paragraph',
          children: [{ type: 'text', value }],
        });
      }
    },
  };

  return { plugin, run };
};

const createRehypeAppender = (value: string, run = vi.fn()) => {
  const plugin: IRehypePlugin = {
    config: {},
    destroy: vi.fn(),
    plugin: () => (tree) => {
      run();
      tree.children.push({ type: 'text', value });
    },
  };

  return { plugin, run };
};

const createPluginDescriptor = <T>(getSource: () => T) => {
  const destroy = vi.fn();

  class Plugin extends BaseStateClosure<T> {
    protected render() {
      return ReactiveState.of(getSource());
    }

    override destroy() {
      if (this.destroyed) {
        return;
      }

      destroy();

      super.destroy();
    }
  }

  return { descriptor: Plugin, destroy };
};

type SetupCompilerParams = {
  sections?: IBlockSection[];

  config?: Partial<BlockCompilerConfig>;

  getRemarks?: (
    config: IReactiveState<BlockRemarksConfig>,
  ) => ReadableClosureSource<IRemarkPlugin[]>;

  getRehypes?: () => ReadableClosureSource<IRehypePlugin[]>;
};

const setupCompiler = ({
  sections: initialSections = [],
  config: initialConfig = {},
  getRemarks: createRemarks,
  getRehypes: createRehypes,
}: SetupCompilerParams = {}) => {
  const sections = MutableState.of(initialSections);
  const config = MutableState.of({ ...DEFAULT_CONFIG, ...initialConfig });
  const remarkConfigs: IReactiveState<BlockRemarksConfig>[] = [];
  const remarks: MutableState<IRemarkPlugin[]>[] = [];
  const rehypes: MutableState<IRehypePlugin[]>[] = [];
  const getRemarks = vi.fn(
    ({ config: configClosure }: { config: IReadableClosure<BlockRemarksConfig> }) => {
      const currentConfig = configClosure.value;

      remarkConfigs.push(currentConfig);

      if (createRemarks) {
        return createRemarks(currentConfig);
      }

      const plugins = MutableState.of<IRemarkPlugin[]>([]);

      remarks.push(plugins);

      return plugins;
    },
  );
  const getRehypes = vi.fn(() => {
    if (createRehypes) {
      return createRehypes();
    }

    const plugins = MutableState.of<IRehypePlugin[]>([]);

    rehypes.push(plugins);

    return plugins;
  });
  const closure = render(
    S([
      BlockCompiler,
      {
        sections,
        config,
        getRemarks,
        getRehypes,
      },
    ]),
  );

  return {
    closure,
    config,
    getRehypes,
    getRemarks,
    rehypes,
    remarkConfigs,
    remarks,
    sections,
  };
};

const getObserverCount = (state: IReactiveState<unknown>) => {
  return (
    state as unknown as {
      subject: { observers: unknown[] };
    }
  ).subject.observers.length;
};

describe('BlockCompiler', () => {
  test('lazily builds blocks from the latest sections and config', () => {
    const harness = setupCompiler({ sections: [section('stale')] });

    harness.sections.next([section('alpha'), section('beta')]);
    harness.config.next({ ...DEFAULT_CONFIG, footnote: true });

    expect(harness.getRemarks).not.toHaveBeenCalled();
    expect(harness.getRehypes).not.toHaveBeenCalled();

    const blocks = harness.closure.value.value;

    expect(blocks.map((block) => collectText(block.value.value))).toEqual(['alpha', 'beta']);
    expect(harness.getRemarks).toHaveBeenCalledTimes(2);
    expect(harness.getRehypes).toHaveBeenCalledTimes(2);
    expect(harness.remarkConfigs.map((state) => state.value.footnote)).toEqual([true, true]);
  });

  test('compiles initial Markdown and exposes complete block state metadata', () => {
    const harness = setupCompiler({
      sections: [section('**bold**'), section(''), section('🙂')],
    });
    const blocks = harness.closure.value.value;

    expect(blocks.map((block) => collectText(block.value.value))).toEqual(['bold', '', '🙂']);
    expect(blocks.map((block) => block.baseLength.value)).toEqual([4, 0, 1]);
    expect(blocks.map((block) => block.length.value)).toEqual([4, 0, 1]);
    expect(blocks.map((block) => block.meta.value)).toEqual([
      {
        key: '1',
        sourceText: '**bold**',
        charStart: 0,
        charEnd: 8,
        currentIndex: 0,
        blockCount: 3,
      },
      {
        key: '2',
        sourceText: '',
        charStart: 8,
        charEnd: 8,
        currentIndex: 1,
        blockCount: 3,
      },
      {
        key: '3',
        sourceText: '🙂',
        charStart: 8,
        charEnd: 10,
        currentIndex: 2,
        blockCount: 3,
      },
    ]);
    expect(uniq(blocks.map((block) => block.meta.value.key))).toHaveLength(3);
  });

  test('accepts direct plugin arrays from factories', () => {
    const remark = createRemarkAppender('|remark');

    const rehype = createRehypeAppender('|rehype');

    const harness = setupCompiler({
      sections: [section('value')],
      getRemarks: () => [remark.plugin],
      getRehypes: () => [rehype.plugin],
    });

    const [block] = harness.closure.value.value;

    expect(collectText(block?.value.value as HastRoot)).toBe('value|remark|rehype');

    expect(remark.run).toHaveBeenCalled();

    expect(rehype.run).toHaveBeenCalled();

    harness.closure.destroy();
  });

  test('combines global config with isolated per-block patches without duplicate updates', () => {
    const harness = setupCompiler({
      sections: [section('a', [patch('a')]), section('b', [patch('b', [1, 2])])],
    });

    expect(harness.closure.value.value).toHaveLength(2);

    expect(harness.remarkConfigs.map((state) => state.value)).toEqual([
      { ...DEFAULT_CONFIG, patches: [patch('a')] },
      { ...DEFAULT_CONFIG, patches: [patch('b', [1, 2])] },
    ]);

    const configUpdates = harness.remarkConfigs.map(() => vi.fn());
    const subscriptions = harness.remarkConfigs.map((state, index) => {
      const next = configUpdates[index];

      expect(next).toBeDefined();

      const subscription = state.subscribe(next);

      next?.mockClear();

      return subscription;
    });

    harness.config.next({ ...DEFAULT_CONFIG, footnote: true });

    expect(configUpdates[0]).toHaveBeenCalledOnce();
    expect(configUpdates[1]).toHaveBeenCalledOnce();
    expect(harness.remarkConfigs.map((state) => state.value.footnote)).toEqual([true, true]);

    configUpdates.forEach((next) => next.mockClear());
    harness.sections.next([section('a', [patch('a')]), section('b', [patch('next')])]);

    expect(configUpdates[0]).not.toHaveBeenCalled();
    expect(configUpdates[1]).toHaveBeenCalledOnce();
    expect(harness.remarkConfigs[1]?.value.patches).toEqual([patch('next')]);

    configUpdates.forEach((next) => next.mockClear());
    harness.config.next({ ...DEFAULT_CONFIG, footnote: true });
    harness.sections.next([section('a', [patch('a')]), section('b', [patch('next')])]);

    expect(configUpdates[0]).not.toHaveBeenCalled();
    expect(configUpdates[1]).not.toHaveBeenCalled();

    subscriptions.forEach((subscription) => subscription.unsubscribe());
  });

  test('enables ending repair only for the last block as the list changes', () => {
    const harness = setupCompiler({
      sections: [section('a'), section('b'), section('c')],
      config: { repairEnding: true },
    });

    expect(harness.closure.value.value).toHaveLength(3);

    expect(harness.remarkConfigs.map((state) => state.value.repairEnding)).toEqual([
      false,
      false,
      true,
    ]);

    const updates = harness.remarkConfigs.map(() => vi.fn());
    const completes = harness.remarkConfigs.map(() => vi.fn());

    harness.remarkConfigs.forEach((state, index) => {
      state.subscribe({ next: updates[index], complete: completes[index] });
      updates[index]?.mockClear();
    });

    harness.sections.next([section('a'), section('b'), section('c'), section('d')]);

    expect(harness.remarkConfigs.map((state) => state.value.repairEnding)).toEqual([
      false,
      false,
      false,
      true,
    ]);
    expect(updates[0]).not.toHaveBeenCalled();
    expect(updates[1]).not.toHaveBeenCalled();
    expect(updates[2]).toHaveBeenCalledOnce();

    updates.forEach((next) => next.mockClear());
    harness.sections.next([section('a'), section('b')]);

    expect(harness.remarkConfigs[0]?.value.repairEnding).toBe(false);
    expect(harness.remarkConfigs[1]?.value.repairEnding).toBe(true);
    expect(updates[0]).not.toHaveBeenCalled();
    expect(updates[1]).toHaveBeenCalledOnce();
    expect(completes[2]).toHaveBeenCalledOnce();
    expect(harness.remarkConfigs[2]?.closed).toBe(true);
    expect(harness.remarkConfigs[3]?.closed).toBe(true);

    updates.forEach((next) => next.mockClear());
    harness.config.next({ ...DEFAULT_CONFIG, repairEnding: false });

    expect(harness.remarkConfigs[0]?.value.repairEnding).toBe(false);
    expect(harness.remarkConfigs[1]?.value.repairEnding).toBe(false);
    expect(updates[0]).not.toHaveBeenCalled();
    expect(updates[1]).toHaveBeenCalledOnce();

    harness.config.complete();

    expect(completes[2]).toHaveBeenCalledOnce();
    expect(harness.remarkConfigs[2]?.closed).toBe(true);
    expect(harness.remarkConfigs[3]?.closed).toBe(true);
  });

  test('publishes one final HAST and one consistent metadata snapshot for a text and patch update', () => {
    const patched = createRemarkAppender('|patched').plugin;
    const harness = setupCompiler({
      sections: [section('old')],
      getRemarks: (config) => {
        return mapState(
          config,
          (currentConfig) => (currentConfig.patches.length > 0 ? [patched] : []),
          isEqual,
        );
      },
    });
    const [block] = harness.closure.value.value;

    expect(block).toBeDefined();

    const values = vi.fn();
    const metas = vi.fn();

    block?.value.subscribe(values);
    block?.meta.subscribe(metas);
    values.mockClear();
    metas.mockClear();

    harness.sections.next([section('new text', [patch('cursor')])]);

    expect(values).toHaveBeenCalledOnce();
    expect(collectText(values.mock.calls[0]?.[0] as HastRoot)).toBe('new text|patched');
    expect(metas).toHaveBeenCalledOnce();
    expect(metas).toHaveBeenCalledWith({
      key: '1',
      sourceText: 'new text',
      charStart: 0,
      charEnd: 8,
      currentIndex: 0,
      blockCount: 1,
    });
  });

  test('updates text and ending-repair status as one block context snapshot', () => {
    const ending = createRemarkAppender('|ending').plugin;
    const compile = createRehypeAppender('');
    const harness = setupCompiler({
      sections: [section('old'), section('tail')],
      config: { repairEnding: true },
      getRemarks: (config) => {
        return mapState(
          config,
          (currentConfig) => (currentConfig.repairEnding ? [ending] : []),
          isEqual,
        );
      },
      getRehypes: () => ReactiveState.of([compile.plugin]),
    });
    const first = harness.closure.value.value[0];

    expect(first).toBeDefined();
    expect(collectText(first?.value.value as HastRoot)).toBe('old');

    const values = vi.fn();
    const metas = vi.fn();
    const metaAtValueEmission: IBlockMeta[] = [];

    first?.value.subscribe((value) => {
      values(value);

      if (first) {
        metaAtValueEmission.push(first.meta.value);
      }
    });
    first?.meta.subscribe(metas);
    values.mockClear();
    metas.mockClear();
    metaAtValueEmission.splice(0);
    compile.run.mockClear();

    harness.sections.next([section('new first')]);

    expect(values).toHaveBeenCalledOnce();
    expect(collectText(values.mock.calls[0]?.[0] as HastRoot)).toBe('new first|ending');
    expect(compile.run).toHaveBeenCalledOnce();
    expect(metas).toHaveBeenCalledOnce();
    expect(metaAtValueEmission).toEqual([
      {
        key: '1',
        sourceText: 'new first',
        charStart: 0,
        charEnd: 9,
        currentIndex: 0,
        blockCount: 1,
      },
    ]);
    expect(first?.meta.value).toEqual({
      key: '1',
      sourceText: 'new first',
      charStart: 0,
      charEnd: 9,
      currentIndex: 0,
      blockCount: 1,
    });
  });

  test('reuses block objects while content and cumulative offsets update independently', () => {
    const harness = setupCompiler({ sections: [section('aa'), section('bb')] });
    const initialBlocks = harness.closure.value.value;
    const [first, second] = initialBlocks;

    expect(first).toBeDefined();
    expect(second).toBeDefined();

    const outerNext = vi.fn();
    const firstValueNext = vi.fn();
    const secondValueNext = vi.fn();
    const firstMetaNext = vi.fn();
    const secondMetaNext = vi.fn();

    harness.closure.value.subscribe(outerNext);
    first?.value.subscribe(firstValueNext);
    second?.value.subscribe(secondValueNext);
    first?.meta.subscribe(firstMetaNext);
    second?.meta.subscribe(secondMetaNext);
    outerNext.mockClear();
    firstValueNext.mockClear();
    secondValueNext.mockClear();
    firstMetaNext.mockClear();
    secondMetaNext.mockClear();

    harness.sections.next([section('longer'), section('bb')]);

    const nextBlocks = harness.closure.value.value;

    expect(nextBlocks).toBe(initialBlocks);
    expect(nextBlocks[0]).toBe(first);
    expect(nextBlocks[1]).toBe(second);
    expect(outerNext).not.toHaveBeenCalled();
    expect(firstValueNext).toHaveBeenCalledOnce();
    expect(secondValueNext).not.toHaveBeenCalled();
    expect(firstMetaNext).toHaveBeenCalledOnce();
    expect(secondMetaNext).toHaveBeenCalledOnce();
    expect(first?.meta.value).toEqual({
      key: '1',
      sourceText: 'longer',
      charStart: 0,
      charEnd: 6,
      currentIndex: 0,
      blockCount: 2,
    });
    expect(second?.meta.value).toEqual({
      key: '2',
      sourceText: 'bb',
      charStart: 6,
      charEnd: 8,
      currentIndex: 1,
      blockCount: 2,
    });
    expect(harness.getRemarks).toHaveBeenCalledTimes(2);
    expect(harness.getRehypes).toHaveBeenCalledTimes(2);
  });

  test('does not recompile blocks when only their offsets or list metadata change', () => {
    const compile = vi.fn();
    const plugin: IRehypePlugin = {
      config: {},
      destroy: vi.fn(),
      plugin: () => (tree) => {
        compile(collectText(tree));
      },
    };
    const harness = setupCompiler({
      sections: [section('first'), section('second')],
      getRehypes: () => [plugin],
    });

    expect(harness.closure.value.value).toHaveLength(2);
    compile.mockClear();

    harness.sections.next([section('longer first'), section('second')]);

    expect(compile).toHaveBeenCalledOnce();
    expect(compile).toHaveBeenCalledWith('longer first');
    compile.mockClear();

    harness.sections.next([section('longer first'), section('second'), section('third')]);

    expect(uniq(compile.mock.calls.map(([text]) => text))).toEqual(['third']);
    compile.mockClear();

    harness.sections.next([section('longer first'), section('second')]);

    expect(compile).not.toHaveBeenCalled();

    harness.closure.destroy();
  });

  test('isolates per-block remarks and rehypes', () => {
    const harness = setupCompiler({ sections: [section('a'), section('b')] });
    const [first, second] = harness.closure.value.value;

    expect(first).toBeDefined();
    expect(second).toBeDefined();

    const firstNext = vi.fn();
    const secondNext = vi.fn();
    const outerNext = vi.fn();

    first?.value.subscribe(firstNext);
    second?.value.subscribe(secondNext);
    harness.closure.value.subscribe(outerNext);
    firstNext.mockClear();
    secondNext.mockClear();
    outerNext.mockClear();

    harness.remarks[0]?.next([createRemarkAppender('|remark').plugin]);

    expect(collectText(first?.value.value as HastRoot)).toBe('a|remark');
    expect(first?.length.value).toBe(8);
    expect(firstNext).toHaveBeenCalledOnce();
    expect(secondNext).not.toHaveBeenCalled();
    expect(outerNext).not.toHaveBeenCalled();

    firstNext.mockClear();
    harness.rehypes[0]?.next([createRehypeAppender('|rehype').plugin]);

    expect(collectText(first?.value.value as HastRoot)).toBe('a|remark|rehype');
    expect(collectText(second?.value.value as HastRoot)).toBe('b');
    expect(first?.length.value).toBe(15);
    expect(second?.length.value).toBe(1);
    expect(firstNext).toHaveBeenCalledOnce();
    expect(secondNext).not.toHaveBeenCalled();
    expect(outerNext).not.toHaveBeenCalled();
  });

  test('appends, truncates, clears, and regrows with monotonic keys and child teardown', () => {
    const harness = setupCompiler({ sections: [section('a'), section('b')] });
    const initialBlocks = harness.closure.value.value;
    const [first, second] = initialBlocks;

    expect(collectText(first?.value.value as HastRoot)).toBe('a');

    const outerNext = vi.fn();
    const secondComplete = vi.fn();

    harness.closure.value.subscribe(outerNext);
    second?.value.subscribe({ complete: secondComplete });
    outerNext.mockClear();

    harness.sections.next([section('a'), section('b'), section('c')]);

    const appendedBlocks = harness.closure.value.value;
    const third = appendedBlocks[2];

    expect(appendedBlocks[0]).toBe(first);
    expect(appendedBlocks[1]).toBe(second);
    expect(appendedBlocks.map((block) => block.meta.value.key)).toEqual(['1', '2', '3']);
    expect(harness.getRemarks).toHaveBeenCalledTimes(3);
    expect(harness.getRehypes).toHaveBeenCalledTimes(3);

    const thirdComplete = vi.fn();

    third?.value.subscribe({ complete: thirdComplete });
    harness.sections.next([section('a')]);

    expect(harness.closure.value.value).toEqual([first]);
    expect(secondComplete).toHaveBeenCalledOnce();
    expect(thirdComplete).toHaveBeenCalledOnce();
    expect(second?.value.closed).toBe(true);
    expect(third?.value.closed).toBe(true);
    expect(harness.remarks[1]?.closed).toBe(false);
    expect(harness.rehypes[0]?.closed).toBe(false);

    harness.sections.next([]);

    expect(first?.value.closed).toBe(true);
    expect(harness.closure.value.value).toEqual([]);

    harness.sections.next([section('new')]);

    const [regrown] = harness.closure.value.value;

    expect(regrown?.meta.value.key).toBe('4');
    expect(collectText(regrown?.value.value as HastRoot)).toBe('new');
    expect(outerNext).toHaveBeenCalledTimes(4);
    expect(harness.getRemarks).toHaveBeenCalledTimes(4);
    expect(harness.getRehypes).toHaveBeenCalledTimes(4);
  });

  test('destroy is idempotent while producer completion closes the derived graph', () => {
    const harness = setupCompiler({ sections: [section('a')] });
    const [block] = harness.closure.value.value;

    expect(block).toBeDefined();

    const outerComplete = vi.fn();
    const blockComplete = vi.fn();

    harness.closure.value.subscribe({ complete: outerComplete });
    block?.value.subscribe({ complete: blockComplete });

    harness.closure.destroy();
    harness.closure.destroy();

    expect(outerComplete).toHaveBeenCalledOnce();
    expect(blockComplete).toHaveBeenCalledOnce();
    expect(harness.closure.value.closed).toBe(true);
    expect(block?.value.closed).toBe(true);
    expect(harness.remarkConfigs[0]?.closed).toBe(true);
    expect(harness.sections.closed).toBe(false);
    expect(harness.config.closed).toBe(false);
    expect(harness.remarks[0]?.closed).toBe(false);
    expect(harness.rehypes[0]?.closed).toBe(false);

    const remarkFactoryCalls = harness.getRemarks.mock.calls.length;
    const rehypeFactoryCalls = harness.getRehypes.mock.calls.length;

    harness.sections.complete();
    harness.config.complete();
    harness.remarks[0]?.complete();
    harness.rehypes[0]?.complete();

    expect(harness.getRemarks).toHaveBeenCalledTimes(remarkFactoryCalls);
    expect(harness.getRehypes).toHaveBeenCalledTimes(rehypeFactoryCalls);
    expect(harness.remarkConfigs[0]?.closed).toBe(true);
    expect(harness.sections.closed).toBe(true);
    expect(harness.config.closed).toBe(true);
    expect(harness.remarks[0]?.closed).toBe(true);
    expect(harness.rehypes[0]?.closed).toBe(true);
  });

  test('disconnects inputs before child completion callbacks can update them during destroy', () => {
    const sharedRemarks = MutableState.of<IRemarkPlugin[]>([]);
    const sharedRehypes = MutableState.of<IRehypePlugin[]>([]);
    const harness = setupCompiler({
      sections: [section('first')],
      getRemarks: (blockConfig) => {
        void blockConfig.value;

        return sharedRemarks;
      },
      getRehypes: () => sharedRehypes,
    });
    const [block] = harness.closure.value.value;

    block?.value.subscribe({
      complete: () => {
        harness.sections.next([section('first'), section('must not be compiled')]);
      },
    });

    harness.closure.destroy();

    expect(harness.getRemarks).toHaveBeenCalledOnce();
    expect(harness.getRehypes).toHaveBeenCalledOnce();
    expect(getObserverCount(harness.sections)).toBe(0);
    expect(getObserverCount(harness.config)).toBe(0);
    expect(getObserverCount(sharedRemarks)).toBe(0);
    expect(getObserverCount(sharedRehypes)).toBe(0);
    expect(harness.sections.closed).toBe(false);
    expect(harness.config.closed).toBe(false);
    expect(sharedRemarks.closed).toBe(false);
    expect(sharedRehypes.closed).toBe(false);
  });

  test('destroys block contexts after the section source errors', () => {
    const harness = setupCompiler({ sections: [section('a')] });
    const [block] = harness.closure.value.value;
    const error = vi.fn();
    const blockComplete = vi.fn();
    const reason = new Error('failed');

    harness.closure.value.subscribe({ error });
    block?.value.subscribe({ complete: blockComplete });
    harness.sections.error(reason);

    expect(error).toHaveBeenCalledOnce();
    expect(error).toHaveBeenCalledWith(reason);
    expect(() => harness.closure.destroy()).not.toThrow();
    expect(blockComplete).toHaveBeenCalledOnce();
    expect(block?.value.closed).toBe(true);
    expect(harness.remarkConfigs[0]?.closed).toBe(true);
    expect(harness.config.closed).toBe(false);
    expect(harness.remarks[0]?.closed).toBe(false);
    expect(harness.rehypes[0]?.closed).toBe(false);
  });

  test('destroy before initialization cannot create a reactive graph later', () => {
    const harness = setupCompiler({ sections: [section('never compiled')] });

    harness.closure.destroy();
    harness.closure.destroy();

    expect(() => harness.closure.value).toThrowError('Cannot set up a destroyed state closure.');
    expect(harness.getRemarks).not.toHaveBeenCalled();
    expect(harness.getRehypes).not.toHaveBeenCalled();

    harness.sections.next([section('still ignored'), section('also ignored')]);

    expect(harness.getRemarks).not.toHaveBeenCalled();
    expect(harness.getRehypes).not.toHaveBeenCalled();
  });

  test('keeps identity attached to positions during a middle insertion', () => {
    const harness = setupCompiler({
      sections: [section('first'), section('middle'), section('last')],
    });
    const previous = harness.closure.value.value;

    harness.sections.next([
      section('first'),
      section('inserted'),
      section('middle'),
      section('last'),
    ]);

    const current = harness.closure.value.value;

    expect(current.slice(0, 3)).toEqual(previous);
    expect(current.map((block) => block.meta.value.key)).toEqual(['1', '2', '3', '4']);
    expect(current.map((block) => block.meta.value.sourceText)).toEqual([
      'first',
      'inserted',
      'middle',
      'last',
    ]);
    expect(previous[2]?.meta.value.sourceText).toBe('middle');
    expect(current[3]).not.toBe(previous[2]);
  });

  test('suppresses deep-equal section and config updates across every public state', () => {
    const harness = setupCompiler({ sections: [section('a', [patch('cursor', [0, 1])])] });
    const [block] = harness.closure.value.value;

    expect(block).toBeDefined();

    const outerNext = vi.fn();
    const valueNext = vi.fn();
    const metaNext = vi.fn();
    const remarksConfigNext = vi.fn();

    harness.closure.value.subscribe(outerNext);
    block?.value.subscribe(valueNext);
    block?.meta.subscribe(metaNext);
    harness.remarkConfigs[0]?.subscribe(remarksConfigNext);
    outerNext.mockClear();
    valueNext.mockClear();
    metaNext.mockClear();
    remarksConfigNext.mockClear();

    harness.sections.next([section('a', [patch('cursor', [0, 1])])]);
    harness.config.next({ ...DEFAULT_CONFIG });

    expect(outerNext).not.toHaveBeenCalled();
    expect(valueNext).not.toHaveBeenCalled();
    expect(metaNext).not.toHaveBeenCalled();
    expect(remarksConfigNext).not.toHaveBeenCalled();
    expect(harness.getRemarks).toHaveBeenCalledOnce();
    expect(harness.getRehypes).toHaveBeenCalledOnce();
  });

  test('does not create plugin graphs for an empty list until a block is added', () => {
    const harness = setupCompiler();

    expect(harness.closure.value.value).toEqual([]);

    harness.config.next({ ...DEFAULT_CONFIG, tex: true });

    expect(harness.getRemarks).not.toHaveBeenCalled();
    expect(harness.getRehypes).not.toHaveBeenCalled();

    harness.sections.next([section('now present')]);

    expect(harness.getRemarks).toHaveBeenCalledOnce();
    expect(harness.getRehypes).toHaveBeenCalledOnce();
    expect(harness.remarkConfigs[0]?.value.tex).toBe(true);
  });

  test('accepts fixed plugin states from factories', () => {
    const remark = createRemarkAppender('|remark').plugin;
    const rehype = createRehypeAppender('|rehype').plugin;
    const harness = setupCompiler({
      sections: [section('text')],
      getRemarks: () => ReactiveState.of([remark]),
      getRehypes: () => ReactiveState.of([rehype]),
    });
    const [block] = harness.closure.value.value;

    expect(collectText(block?.value.value as HastRoot)).toBe('text|remark|rehype');
  });

  test('destroys plugin descriptors whose value cannot be read', () => {
    let remarksConfig: IReactiveState<BlockRemarksConfig> | undefined;
    const remarks = createPluginDescriptor<IRemarkPlugin[]>(() => {
      void remarksConfig?.value;

      throw new Error('Failed to read remarks.');
    });
    const harness = setupCompiler({
      sections: [section('text')],
      getRemarks: (config) => {
        remarksConfig = config;

        return remarks.descriptor;
      },
    });

    expect(() => harness.closure.value).toThrowError('Failed to read remarks.');
    expect(remarks.destroy).toHaveBeenCalledOnce();
    expect(remarksConfig?.closed).toBe(true);
    expect(getObserverCount(harness.config)).toBe(0);

    harness.closure.destroy();

    expect(remarks.destroy).toHaveBeenCalledOnce();
  });

  test('destroys owned plugin descriptors when block setup fails', () => {
    const failure = new Error('Failed to compile remarks.');
    const throwingRemark: IRemarkPlugin = {
      config: {},
      destroy: vi.fn(),
      plugin: () => {
        throw failure;
      },
    };
    const remarks = createPluginDescriptor<IRemarkPlugin[]>(() => [throwingRemark]);
    const rehypes = createPluginDescriptor<IRehypePlugin[]>(() => []);
    const harness = setupCompiler({
      sections: [section('text')],
      getRemarks: () => remarks.descriptor,
      getRehypes: () => rehypes.descriptor,
    });

    expect(() => harness.closure.value).toThrow(failure);
    expect(remarks.destroy).toHaveBeenCalledOnce();
    expect(rehypes.destroy).toHaveBeenCalledOnce();
    expect(harness.remarkConfigs[0]?.closed).toBe(true);

    harness.closure.destroy();

    expect(remarks.destroy).toHaveBeenCalledOnce();
    expect(rehypes.destroy).toHaveBeenCalledOnce();
  });

  test('destroys plugin descriptors from earlier blocks when the same render pass fails', () => {
    const firstRemarks = createPluginDescriptor<IRemarkPlugin[]>(() => []);
    const failedRemarks = createPluginDescriptor<IRemarkPlugin[]>(() => {
      throw new Error('Failed to read the next remarks.');
    });
    const rehypes = createPluginDescriptor<IRehypePlugin[]>(() => []);
    let remarkIndex = 0;
    const harness = setupCompiler({
      sections: [section('first'), section('second')],
      getRemarks: () => {
        return remarkIndex++ === 0 ? firstRemarks.descriptor : failedRemarks.descriptor;
      },
      getRehypes: () => rehypes.descriptor,
    });

    expect(() => harness.closure.value).toThrowError('Failed to read the next remarks.');
    expect(firstRemarks.destroy).toHaveBeenCalledOnce();
    expect(failedRemarks.destroy).toHaveBeenCalledOnce();
    expect(rehypes.destroy).toHaveBeenCalledTimes(2);
    expect(harness.remarkConfigs.every(({ closed }) => closed)).toBe(true);

    harness.closure.destroy();

    expect(firstRemarks.destroy).toHaveBeenCalledOnce();
    expect(failedRemarks.destroy).toHaveBeenCalledOnce();
    expect(rehypes.destroy).toHaveBeenCalledTimes(2);
  });

  test('releases failed append graphs while retaining existing blocks until destroy', () => {
    const source = MutableState.of<IRemarkPlugin[]>([]);
    const existingRemarks = new Source({ source: toClosure(source) });
    const existingDestroy = vi.spyOn(existingRemarks, 'destroy');
    const appendedRemarks = createPluginDescriptor<IRemarkPlugin[]>(() => []);
    const failure = new Error('Failed to read appended remarks.');
    const failedRemarks = createPluginDescriptor<IRemarkPlugin[]>(() => {
      throw failure;
    });
    const rehypes = createPluginDescriptor<IRehypePlugin[]>(() => []);
    const harness = setupCompiler({
      sections: [section('existing')],
      getRemarks: vi
        .fn<() => ReadableClosureSource<IRemarkPlugin[]>>()
        .mockReturnValueOnce(existingRemarks)
        .mockReturnValueOnce(appendedRemarks.descriptor)
        .mockReturnValue(failedRemarks.descriptor),
      getRehypes: () => rehypes.descriptor,
    });
    const output = harness.closure.value;
    const [block] = output.value;
    const error = vi.fn();

    output.subscribe({ error });
    harness.sections.next([section('existing'), section('appended'), section('failed')]);

    expect(error).toHaveBeenCalledOnce();
    expect(error).toHaveBeenCalledWith(failure);
    expect(appendedRemarks.destroy).toHaveBeenCalledOnce();
    expect(failedRemarks.destroy).toHaveBeenCalledOnce();
    expect(harness.remarkConfigs.slice(1).every(({ closed }) => closed)).toBe(true);
    expect(existingDestroy).not.toHaveBeenCalled();
    expect(rehypes.destroy).toHaveBeenCalledTimes(2);
    expect(block?.value.closed).toBe(false);

    source.next([createRemarkAppender('|updated').plugin]);

    expect(collectText(block?.value.value as HastRoot)).toBe('existing|updated');

    harness.closure.destroy();

    expect(existingDestroy).toHaveBeenCalledOnce();
    expect(rehypes.destroy).toHaveBeenCalledTimes(3);
    expect(appendedRemarks.destroy).toHaveBeenCalledOnce();
    expect(failedRemarks.destroy).toHaveBeenCalledOnce();
    expect(block?.value.closed).toBe(true);
    expect(harness.remarkConfigs.every(({ closed }) => closed)).toBe(true);
    expect(getObserverCount(source)).toBe(0);
    expect(source.closed).toBe(false);
  });

  test('owns readable closures returned by plugin factories and detaches their sources', () => {
    const remark = createRemarkAppender('|remark').plugin;
    const rehype = createRehypeAppender('|rehype').plugin;
    const remarkSource = MutableState.of<IRemarkPlugin[]>([remark]);
    const rehypeSource = MutableState.of<IRehypePlugin[]>([rehype]);

    const remarkOwner = new Source({ source: toClosure(remarkSource) });

    const rehypeOwner = new Source({ source: toClosure(rehypeSource) });

    const harness = setupCompiler({
      sections: [section('text')],
      getRemarks: () => remarkOwner,
      getRehypes: () => rehypeOwner,
    });

    expect(collectText(harness.closure.value.value[0]?.value.value as HastRoot)).toBe(
      'text|remark|rehype',
    );
    expect(getObserverCount(remarkSource)).toBe(1);
    expect(getObserverCount(rehypeSource)).toBe(1);

    harness.closure.destroy();

    expect(remarkOwner.value.closed).toBe(true);
    expect(rehypeOwner.value.closed).toBe(true);
    expect(getObserverCount(remarkOwner.value)).toBe(0);
    expect(getObserverCount(rehypeOwner.value)).toBe(0);
    expect(getObserverCount(remarkSource)).toBe(0);
    expect(getObserverCount(rehypeSource)).toBe(0);

    remarkOwner.destroy();
    rehypeOwner.destroy();

    expect(remarkSource.closed).toBe(false);
    expect(rehypeSource.closed).toBe(false);
    expect(getObserverCount(remarkSource)).toBe(0);
    expect(getObserverCount(rehypeSource)).toBe(0);
  });

  test('releases every removed block plugin subscription under sustained list changes', () => {
    const run = vi.fn();
    const remark = createRemarkAppender('|remark', run).plugin;
    const sharedRemarks = MutableState.of<IRemarkPlugin[]>([remark]);
    const sharedRehypes = MutableState.of<IRehypePlugin[]>([]);
    const initialSections = times(100, (index) => section(`block-${index}`));
    const harness = setupCompiler({
      sections: initialSections,
      getRemarks: () => sharedRemarks,
      getRehypes: () => sharedRehypes,
    });

    expect(harness.closure.value.value).toHaveLength(100);
    expect(getObserverCount(sharedRemarks)).toBe(100);
    expect(getObserverCount(sharedRehypes)).toBe(100);

    harness.sections.next(initialSections.slice(0, 10));

    expect(harness.closure.value.value).toHaveLength(10);
    expect(getObserverCount(sharedRemarks)).toBe(10);
    expect(getObserverCount(sharedRehypes)).toBe(10);

    const runsBeforePluginUpdate = run.mock.calls.length;

    sharedRemarks.next([remark]);

    expect(run.mock.calls.length - runsBeforePluginUpdate).toBe(10);

    harness.closure.destroy();

    expect(getObserverCount(sharedRemarks)).toBe(0);
    expect(getObserverCount(sharedRehypes)).toBe(0);
    expect(harness.config.closed).toBe(false);
    expect(sharedRemarks.closed).toBe(false);
    expect(sharedRehypes.closed).toBe(false);
  });

  test('retains a forked block graph after its section and compiler are removed', () => {
    const remarks = MutableState.of<IRemarkPlugin[]>([]);
    const rehypes = MutableState.of<IRehypePlugin[]>([]);
    const harness = setupCompiler({
      sections: [section('text')],
      getRemarks: () => remarks,
      getRehypes: () => rehypes,
    });
    const [block] = harness.closure.value.value;
    const fork = block?.fork();

    expect(collectText(block?.value.value as HastRoot)).toBe('text');
    expect(collectText(fork?.value.value as HastRoot)).toBe('text');

    harness.sections.next([]);
    harness.closure.destroy();

    expect(block?.value.closed).toBe(true);
    expect(fork?.value.closed).toBe(false);

    remarks.next([createRemarkAppender('|remark').plugin]);
    rehypes.next([createRehypeAppender('|rehype').plugin]);

    expect(collectText(fork?.value.value as HastRoot)).toBe('text|remark|rehype');

    fork?.destroy();

    expect(harness.remarkConfigs[0]?.closed).toBe(true);
    expect(getObserverCount(harness.config)).toBe(0);
    expect(getObserverCount(remarks)).toBe(0);
    expect(getObserverCount(rehypes)).toBe(0);
    expect(harness.config.closed).toBe(false);
    expect(remarks.closed).toBe(false);
    expect(rehypes.closed).toBe(false);
  });

  test('retains a shared generated closure until its last block releases it', () => {
    const source = MutableState.of<IRemarkPlugin[]>([]);
    const remarks = new Source({ source: toClosure(source) });
    const harness = setupCompiler({
      sections: [section('first'), section('second')],
      getRemarks: () => remarks,
    });

    expect(harness.closure.value.value).toHaveLength(2);

    harness.sections.next([section('first')]);

    expect(remarks.value.closed).toBe(false);

    source.next([createRemarkAppender('|updated').plugin]);

    expect(collectText(harness.closure.value.value[0]?.value.value as HastRoot)).toBe(
      'first|updated',
    );

    harness.sections.next([]);

    expect(remarks.value.closed).toBe(true);
    expect(getObserverCount(source)).toBe(0);
    expect(source.closed).toBe(false);

    harness.closure.destroy();
  });
});

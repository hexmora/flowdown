import type { SmoothSchedulerClass, SmoothTickerClass } from '@flowdown/core-presets/mapper';
import type { IBlockMeta, IBlockState } from '@flowdown/types';
import type { Element, ElementContent, RootContent, Text } from 'hast';

import { Smooth } from '@flowdown/core-presets/mapper';
import { first, last } from 'lodash-es';
import { MutableState, render, S } from 'reactive';

import type { HastRoot } from '../../typings';

import { BlockItem } from '../../states';
import { DoubleStepSmoothScheduler, FakeSmoothTicker, StepSmoothScheduler } from '../utils/smooth';

export class PrimarySmoothTicker extends FakeSmoothTicker {
  static instances: PrimarySmoothTicker[] = [];

  constructor() {
    super();

    PrimarySmoothTicker.instances.push(this);
  }
}

export class SecondarySmoothTicker extends FakeSmoothTicker {
  static instances: SecondarySmoothTicker[] = [];

  constructor() {
    super();

    SecondarySmoothTicker.instances.push(this);
  }
}

export const resetSmoothTests = () => {
  PrimarySmoothTicker.instances = [];

  SecondarySmoothTicker.instances = [];

  StepSmoothScheduler.instances = [];

  DoubleStepSmoothScheduler.instances = [];
};

export const root = (children: RootContent[] = []): HastRoot => ({ type: 'root', children });

export const text = (value: string): Text => ({ type: 'text', value });

export const element = (tagName: string, children: ElementContent[] = []): Element => ({
  type: 'element',
  tagName,
  properties: {},
  children,
});

export const paragraph = (value: string) => root([element('p', [text(value)])]);

export const collectText = (node: HastRoot | RootContent): string => {
  if (node.type === 'text') {
    return node.value;
  }

  if ('children' in node) {
    return node.children.map(collectText).join('');
  }

  return '';
};

export const createBlock = (key: string, value: HastRoot, currentIndex = 0, blockCount = 1) => {
  const source = MutableState.of(value);

  const meta = MutableState.of<IBlockMeta>({
    key,
    currentIndex,
    blockCount,
    sourceText: collectText(value),
    charStart: 0,
    charEnd: collectText(value).length,
  });

  const block = render(S([BlockItem, { source, meta }]));

  return { block, source, meta };
};

export const observerCount = (state: object) => {
  return (state as { subject: { observers: unknown[] } }).subject.observers.length;
};

export const latest = <T>(instances: T[]): T => {
  const instance = last(instances);

  if (!instance) {
    throw new Error('Expected a constructed test instance.');
  }

  return instance;
};

export const firstBlock = (blocks: IBlockState<HastRoot>[]) => {
  const block = first(blocks);

  if (!block) {
    throw new Error('Expected a visible block.');
  }

  return block;
};

export const setupSmooth = (initialBlocks: IBlockState<HastRoot>[] = [], initialEnabled = true) => {
  const source = MutableState.of(initialBlocks);

  const enabled = MutableState.of(initialEnabled);

  const ticker = MutableState.of<SmoothTickerClass>(PrimarySmoothTicker);

  const scheduler = MutableState.of<SmoothSchedulerClass>(StepSmoothScheduler);

  const state = render(S([Smooth<HastRoot>, { source, enabled, ticker, scheduler }]));

  return { state, source, enabled, ticker, scheduler };
};

export const visibleText = (blocks: IBlockState<HastRoot>[]) => {
  return blocks.map((block) => collectText(block.value.value));
};

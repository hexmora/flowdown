import type { ComponentProps } from 'react';

import { keys } from 'lodash-es';
import { describe, expect, expectTypeOf, test } from 'vitest';

import type { FlowdownProps } from '../types';

import * as ReactEntry from '..';

describe('package exports', () => {
  test('keeps the root runtime surface focused on Flowdown', () => {
    expect(keys(ReactEntry)).toEqual(['Flowdown']);
  });

  test('exposes Flowdown with its public prop contract', () => {
    type RootExport = keyof typeof ReactEntry;
    type PublicProps = ComponentProps<typeof ReactEntry.Flowdown>;

    expectTypeOf<RootExport>().toEqualTypeOf<'Flowdown'>();
    expectTypeOf<PublicProps>().toMatchTypeOf<FlowdownProps>();
    expectTypeOf<FlowdownProps>().toMatchTypeOf<PublicProps>();
  });
});

import { describe, expect, test } from 'vitest';

import { Playground } from '../../components/playground';
import meta, { Patch } from '../index.stories';

describe('Playground story', () => {
  test('uses the Playground component in a full-screen Storybook canvas', () => {
    expect(meta.component).toBe(Playground);

    expect(meta.title).toBe('Playgrounds');

    expect(meta.parameters).toMatchObject({ layout: 'fullscreen' });

    expect(Patch.render).toBeTypeOf('function');
  });
});

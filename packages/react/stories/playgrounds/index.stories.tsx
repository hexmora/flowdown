import type { Meta, StoryObj } from '@storybook/react-vite';

import { PatchPlayground } from '../components/patch-playground';
import { Playground } from '../components/playground';
import { SmoothStreamingPlayground } from '../components/smooth-streaming-playground';
import { STORY_MARKDOWN } from './consts';

const meta = {
  component: Playground,
  parameters: {
    layout: 'fullscreen',
  },
  title: 'Playgrounds',
} satisfies Meta<typeof Playground>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    initialText: STORY_MARKDOWN,
  },
};

export const Patch: Story = {
  render: () => <PatchPlayground />,
};

export const SmoothStreaming: Story = {
  render: () => <SmoothStreamingPlayground text={STORY_MARKDOWN} />,
};

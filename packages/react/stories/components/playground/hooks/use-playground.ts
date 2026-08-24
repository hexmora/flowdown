import { useEffect, useState } from 'react';

import type { PlaygroundProps, PlaygroundSetting } from '../type';

import { DEFAULT_MARKDOWN, DEFAULT_PLAYGROUND_SETTINGS } from '../consts';

export const usePlayground = ({ autoPlay = false, initialText }: PlaygroundProps) => {
  const resetValue = initialText ?? DEFAULT_MARKDOWN;

  const [text, setText] = useState(resetValue);

  const [playbackText, setPlaybackText] = useState(resetValue);

  const [playbackMode, setPlaybackMode] = useState(autoPlay && resetValue.length > 0);

  const [paused, setPaused] = useState(false);

  const [cursor, setCursor] = useState(0);

  const [speed, setSpeed] = useState(20);

  const [chunkSize, setChunkSize] = useState(1);

  const [config, setConfig] = useState(DEFAULT_PLAYGROUND_SETTINGS);

  const complete = playbackMode && cursor >= playbackText.length;

  const stopped = paused || complete;

  const previewText = playbackMode ? playbackText.slice(0, cursor) : text;

  const progress = playbackText.length === 0 ? 0 : (cursor / playbackText.length) * 100;

  useEffect(() => {
    if (!playbackMode || paused || complete) {
      return;
    }

    const timer = window.setInterval(() => {
      setCursor((current) => Math.min(current + chunkSize, playbackText.length));
    }, 1000 / speed);

    return () => window.clearInterval(timer);
  }, [chunkSize, complete, paused, playbackMode, playbackText.length, speed]);

  const handlePlay = () => {
    if (text.length === 0) {
      return;
    }

    setPlaybackText(text);

    setCursor(0);

    setPaused(false);

    setPlaybackMode(true);
  };

  const handleBackToEditor = () => {
    setPlaybackMode(false);

    setPaused(false);
  };

  const handlePause = () => {
    if (complete) {
      return;
    }

    setPaused((current) => !current);
  };

  const handleStepBackward = () => {
    setPaused(true);

    setCursor((current) => Math.max(0, current - 1));
  };

  const handleStepForward = () => {
    setPaused(true);

    setCursor((current) => Math.min(playbackText.length, current + 1));
  };

  const handleReplay = () => {
    if (playbackText.length === 0) {
      return;
    }

    setCursor(0);

    setPaused(false);
  };

  const handleResetSettings = () => {
    setConfig(DEFAULT_PLAYGROUND_SETTINGS);
  };

  const handleResetText = () => {
    setText(resetValue);

    if (!playbackMode) {
      return;
    }

    setPlaybackText(resetValue);

    setCursor(0);

    setPaused(true);
  };

  const handleProgress = (value: number) => {
    setPaused(true);

    setCursor(Math.round((value / 100) * playbackText.length));
  };

  const handleSetting = (setting: PlaygroundSetting, enabled: boolean) => {
    setConfig((current) => ({ ...current, [setting]: enabled }));
  };

  const status = playbackMode
    ? complete
      ? 'Complete'
      : paused
        ? 'Paused'
        : 'Playing'
    : 'Static mode';

  return {
    chunkSize,
    complete,
    config,
    cursor,
    handleBackToEditor,
    handlePause,
    handlePlay,
    handleProgress,
    handleReplay,
    handleResetSettings,
    handleResetText,
    handleSetting,
    handleStepBackward,
    handleStepForward,
    paused,
    playbackMode,
    playbackText,
    previewText,
    progress,
    setChunkSize,
    setSpeed,
    setText,
    speed,
    status,
    stopped,
    text,
  };
};

// oxlint-disable-next-line unicorn/prefer-set-has -- Fixed lookup tables use arrays by convention.
const HIDDEN_TAG_NAMES = ['script', 'style', 'template'];

const SEGMENTER =
  typeof Intl === 'undefined' || typeof Intl.Segmenter !== 'function'
    ? null
    : new Intl.Segmenter(undefined, {
        granularity: 'grapheme',
      });

export const getTextUnits = function* (value: string): Generator<string> {
  if (!SEGMENTER) {
    yield* value;
    return;
  }

  for (const { segment } of SEGMENTER.segment(value)) {
    yield segment;
  }
};

export const isHiddenTagName = (tagName: string) => {
  return HIDDEN_TAG_NAMES.includes(tagName.toLowerCase());
};

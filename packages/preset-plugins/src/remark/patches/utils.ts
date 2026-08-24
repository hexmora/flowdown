import type { IRawPatchItem } from '@flowdown/types';
import type { ListItem, Nodes, Parent, Root, RootContent, Text } from 'mdast';
import type { Point, Position, Node as UnistNode } from 'unist';

import { isMdastParent } from '@flowdown/utils';
import { first, isArray, isSafeInteger, last } from 'lodash-es';
import { fromMarkdown } from 'mdast-util-from-markdown';

import type { ParserPatch } from '../../typings';
import type {
  MappedTextPatch,
  MappedTextPoint,
  NormalizedPatch,
  ParentPatchTarget,
  TextPatch,
  TextPatchTarget,
  TextReplacement,
  TextSourceMap,
} from './type';

import {
  LIST_ADJACENT_GAP_PATTERN,
  MARKDOWN_DECODE_SENTINEL,
  PARSER_PATCH_ELEMENT,
  PARSER_PATCH_MARKER,
  PARSER_PATCH_TYPE,
} from './consts';

type OffsetRange = [number, number];

type ParentCandidate = {
  depth: number;

  index: number;

  parent: Parent;
};

const getOffsets = (node: UnistNode): OffsetRange | undefined => {
  const start = node.position?.start.offset;
  const end = node.position?.end.offset;

  if (typeof start !== 'number' || typeof end !== 'number') {
    return undefined;
  }

  return [start, end];
};

const normalizePatch = (
  item: IRawPatchItem | undefined,
  order: number,
): NormalizedPatch | undefined => {
  if (!item || typeof item.key !== 'string') {
    return undefined;
  }

  const range = item.range;

  if (typeof range !== 'number' && (!isArray(range) || range.length !== 2)) {
    return undefined;
  }

  const start = typeof range === 'number' ? range : isArray(range) ? first(range) : undefined;
  const end = typeof range === 'number' ? range : isArray(range) ? last(range) : undefined;

  if (
    !isSafeInteger(start) ||
    !isSafeInteger(end) ||
    start === undefined ||
    end === undefined ||
    start < 0 ||
    start > end
  ) {
    return undefined;
  }

  return { end, item, order, start };
};

const patchesConflict = (left: NormalizedPatch, right: NormalizedPatch): boolean => {
  const leftIsPoint = left.start === left.end;
  const rightIsPoint = right.start === right.end;

  if (leftIsPoint && rightIsPoint) {
    return false;
  }

  if (leftIsPoint) {
    return right.start <= left.start && left.start < right.end;
  }

  if (rightIsPoint) {
    return left.start <= right.start && right.start < left.end;
  }

  return right.start < left.end;
};

const normalizePatches = (patches: IRawPatchItem[]): NormalizedPatch[] => {
  const normalized: NormalizedPatch[] = [];

  patches.forEach((item, order) => {
    const patch = normalizePatch(item, order);

    if (patch) {
      normalized.push(patch);
    }
  });

  // oxlint-disable-next-line unicorn/no-array-sort -- The array is locally owned.
  const ordered = normalized.sort(
    (left, right) => left.start - right.start || left.end - right.end || left.order - right.order,
  );
  const filtered: NormalizedPatch[] = [];

  for (const patch of ordered) {
    const previous = last(filtered);

    if (!previous || !patchesConflict(previous, patch)) {
      filtered.push(patch);
    }
  }

  return filtered;
};

const createParserPatch = (patch: NormalizedPatch, replacement?: string): ParserPatch => {
  const hProperties: ParserPatch['data']['hProperties'] = {
    dataParserPatch: PARSER_PATCH_MARKER,
    dataPatchKey: patch.item.key,
  };

  if (replacement !== undefined) {
    hProperties.dataPatchText = replacement;
  }

  return {
    type: PARSER_PATCH_TYPE,
    data: {
      key: patch.item.key,
      hName: PARSER_PATCH_ELEMENT,
      hProperties,
    },
  };
};

const collectNodes = (root: Root): Nodes[] => {
  const nodes: Nodes[] = [];
  const pending: Nodes[] = [root];

  while (pending.length > 0) {
    const node = pending.pop();

    if (!node) {
      continue;
    }

    nodes.push(node);

    if (!isMdastParent(node) || !isArray(node.children)) {
      continue;
    }

    for (let index = node.children.length - 1; index >= 0; index -= 1) {
      const child = node.children[index];

      if (child) {
        pending.push(child);
      }
    }
  }

  return nodes;
};

const decodeMarkdownText = (value: string): string | undefined => {
  try {
    const root = fromMarkdown(`${MARKDOWN_DECODE_SENTINEL}${value}${MARKDOWN_DECODE_SENTINEL}`);
    const pending: Nodes[] = [root];
    const values: string[] = [];

    while (pending.length > 0) {
      const node = pending.pop();

      if (!node) {
        continue;
      }

      if (node.type === 'text') {
        values.push(node.value);
        continue;
      }

      if (!isMdastParent(node) || !isArray(node.children)) {
        continue;
      }

      for (let index = node.children.length - 1; index >= 0; index -= 1) {
        const child = node.children[index];

        if (child) {
          pending.push(child);
        }
      }
    }

    return values.join('').slice(MARKDOWN_DECODE_SENTINEL.length, -MARKDOWN_DECODE_SENTINEL.length);
  } catch {
    return undefined;
  }
};

const createTextSourceMap = (node: Text, source: string): TextSourceMap | undefined => {
  const offsets = getOffsets(node);

  if (!offsets) {
    return undefined;
  }

  const [start, end] = offsets;

  if (source.length >= end) {
    const raw = source.slice(start, end);

    if (raw === node.value) {
      return { boundaries: new Map(), end, identity: true, raw, start };
    }

    if (decodeMarkdownText(raw) === node.value) {
      return { boundaries: new Map(), end, identity: false, raw, start };
    }

    return undefined;
  }

  if (end - start === node.value.length) {
    return { boundaries: new Map(), end, identity: true, start };
  }

  return undefined;
};

const getTextSourceMap = (
  node: Text,
  source: string,
  maps: Map<Text, TextSourceMap | null>,
): TextSourceMap | undefined => {
  if (!maps.has(node)) {
    maps.set(node, createTextSourceMap(node, source) ?? null);
  }

  return maps.get(node) ?? undefined;
};

const mapTextBoundary = (
  node: Text,
  offset: number,
  source: string,
  maps: Map<Text, TextSourceMap | null>,
): number | undefined => {
  const sourceMap = getTextSourceMap(node, source, maps);

  if (!sourceMap || offset < sourceMap.start || sourceMap.end < offset) {
    return undefined;
  }

  const localOffset = offset - sourceMap.start;

  if (sourceMap.identity) {
    return localOffset;
  }

  const cached = sourceMap.boundaries.get(localOffset);

  if (cached !== undefined) {
    return cached ?? undefined;
  }

  if (!sourceMap.raw) {
    return undefined;
  }

  const prefix = decodeMarkdownText(sourceMap.raw.slice(0, localOffset));
  const suffix = decodeMarkdownText(sourceMap.raw.slice(localOffset));
  const decodedOffset =
    prefix !== undefined && suffix !== undefined && prefix + suffix === node.value
      ? prefix.length
      : null;

  sourceMap.boundaries.set(localOffset, decodedOffset);

  return decodedOffset ?? undefined;
};

const mapTextPatch = (
  node: Text,
  patch: NormalizedPatch,
  source: string,
  maps: Map<Text, TextSourceMap | null>,
): TextPatch | undefined => {
  const decodedStart = mapTextBoundary(node, patch.start, source, maps);
  const decodedEnd = mapTextBoundary(node, patch.end, source, maps);

  if (decodedStart === undefined || decodedEnd === undefined || decodedStart > decodedEnd) {
    return undefined;
  }

  return { ...patch, decodedEnd, decodedStart };
};

const findTextForReplacement = (
  nodes: Nodes[],
  patch: NormalizedPatch,
  source: string,
  maps: Map<Text, TextSourceMap | null>,
): MappedTextPatch | undefined => {
  for (const node of nodes) {
    if (node.type !== 'text') {
      continue;
    }

    const offsets = getOffsets(node);

    if (!offsets || patch.start < offsets[0] || offsets[1] < patch.end) {
      continue;
    }

    const mappedPatch = mapTextPatch(node, patch, source, maps);

    if (mappedPatch) {
      return { node, patch: mappedPatch };
    }
  }

  return undefined;
};

const findTextForPoint = (
  nodes: Nodes[],
  offset: number,
  source: string,
  maps: Map<Text, TextSourceMap | null>,
): MappedTextPoint | null | undefined => {
  let startMatch: MappedTextPoint | undefined;

  for (const node of nodes) {
    const offsets = getOffsets(node);

    if (!offsets) {
      continue;
    }

    const [start, end] = offsets;

    if (start < offset && offset < end && !isMdastParent(node)) {
      if (node.type !== 'text') {
        return null;
      }

      const decodedOffset = mapTextBoundary(node, offset, source, maps);

      return decodedOffset === undefined ? null : { decodedOffset, node };
    }

    if (node.type !== 'text') {
      continue;
    }

    const decodedOffset = mapTextBoundary(node, offset, source, maps);

    if (decodedOffset === undefined) {
      continue;
    }

    if (end === offset) {
      return { decodedOffset, node };
    }

    if (!startMatch && start === offset) {
      startMatch = { decodedOffset, node };
    }
  }

  return startMatch;
};

const canContainParserPatch = (parent: Parent): boolean => {
  return [
    'root',
    'blockquote',
    'footnoteDefinition',
    'listItem',
    'paragraph',
    'heading',
    'delete',
    'emphasis',
    'link',
    'linkReference',
    'strong',
    'tableCell',
  ].includes(parent.type);
};

const isNestedPhrasingBoundary = (
  parent: Parent,
  offset: number,
  [start, end]: OffsetRange,
): boolean => {
  const isNestedPhrasing =
    parent.type === 'delete' ||
    parent.type === 'emphasis' ||
    parent.type === 'link' ||
    parent.type === 'linkReference' ||
    parent.type === 'strong';

  return isNestedPhrasing && (offset === start || offset === end);
};

const getGapIndex = (parent: Parent, offset: number): number | undefined => {
  const parentOffsets = getOffsets(parent);

  if (!parentOffsets || offset < parentOffsets[0] || parentOffsets[1] < offset) {
    return undefined;
  }

  if (isNestedPhrasingBoundary(parent, offset, parentOffsets)) {
    return undefined;
  }

  let nextGapIndex = 0;

  for (let index = 0; index < parent.children.length; index += 1) {
    const child = parent.children[index];

    if (!child) {
      continue;
    }

    const childOffsets = getOffsets(child);

    if (!childOffsets) {
      continue;
    }

    const [start, end] = childOffsets;

    if (offset <= start) {
      return index;
    }

    if (offset < end) {
      return undefined;
    }

    nextGapIndex = index + 1;
  }

  return nextGapIndex;
};

const findFinalListItem = (node: RootContent): ListItem | undefined => {
  if (node.type === 'listItem') {
    return node;
  }

  if (node.type !== 'list') {
    return undefined;
  }

  return last(node.children);
};

const getListGapOwner = (node: RootContent): Parent | undefined => {
  const item = findFinalListItem(node);
  const finalChild = last(item?.children);

  return finalChild?.type === 'paragraph' ? finalChild : item;
};

const getListGapCandidate = (
  parent: Parent,
  gapIndex: number,
  offset: number,
  source: string,
  depth: number,
): ParentCandidate | undefined => {
  const previous = parent.children[gapIndex - 1];

  if (!previous) {
    return undefined;
  }

  const previousOffsets = getOffsets(previous);

  if (
    !previousOffsets ||
    !LIST_ADJACENT_GAP_PATTERN.test(source.slice(previousOffsets[1], offset))
  ) {
    return undefined;
  }

  const owner =
    parent.type === 'listItem' && previous.type === 'paragraph'
      ? previous
      : previous.type === 'list' || previous.type === 'listItem'
        ? getListGapOwner(previous)
        : undefined;

  if (!owner) {
    return undefined;
  }

  return {
    depth: depth + 1,
    index: owner.children.length,
    parent: owner,
  };
};

const findParentForPoint = (
  root: Root,
  offset: number,
  source: string,
): ParentCandidate | undefined => {
  const pending: { depth: number; node: Nodes }[] = [{ depth: 0, node: root }];
  let result: ParentCandidate | undefined;

  while (pending.length > 0) {
    const frame = pending.pop();

    if (!frame) {
      continue;
    }

    const { depth, node } = frame;

    if (!isMdastParent(node) || !isArray(node.children)) {
      continue;
    }

    const gapIndex = getGapIndex(node, offset);

    if (gapIndex !== undefined) {
      const listCandidate = getListGapCandidate(node, gapIndex, offset, source, depth);
      const candidate =
        listCandidate ??
        (canContainParserPatch(node) ? { depth, index: gapIndex, parent: node } : undefined);

      if (candidate && (!result || result.depth < candidate.depth)) {
        result = candidate;
      }
    }

    for (let index = node.children.length - 1; index >= 0; index -= 1) {
      const child = node.children[index];

      if (child) {
        pending.push({ depth: depth + 1, node: child });
      }
    }
  }

  return result;
};

const addTextPatch = (targets: TextPatchTarget[], node: Text, patch: TextPatch): void => {
  let target = targets.find((item) => item.node === node);

  if (!target) {
    target = { node, patches: [] };
    targets.push(target);
  }

  target.patches.push(patch);
};

const addParentPatch = (
  targets: ParentPatchTarget[],
  candidate: ParentCandidate,
  patch: ParserPatch,
): void => {
  let target = targets.find(
    (item) => item.parent === candidate.parent && item.index === candidate.index,
  );

  if (!target) {
    target = { index: candidate.index, parent: candidate.parent, patches: [] };
    targets.push(target);
  }

  target.patches.push(patch);
};

const pointAtOffset = (source: string, offset: number): Point => {
  let line = 1;
  let column = 1;

  for (let index = 0; index < offset; index += 1) {
    const character = source[index];

    if (character === '\r' && source[index + 1] === '\n') {
      index += 1;
      line += 1;
      column = 1;
    } else if (character === '\r' || character === '\n') {
      line += 1;
      column = 1;
    } else {
      column += 1;
    }
  }

  return { column, line, offset };
};

const pointFromText = (node: Text, offset: number): Point | undefined => {
  const position = node.position;
  const startOffset = position?.start.offset;
  const endOffset = position?.end.offset;

  if (!position || typeof startOffset !== 'number' || typeof endOffset !== 'number') {
    return undefined;
  }

  if (offset === startOffset) {
    return { ...position.start };
  }

  if (offset === endOffset) {
    return { ...position.end };
  }

  if (
    position.start.line === position.end.line &&
    position.end.column - position.start.column === endOffset - startOffset
  ) {
    return {
      line: position.start.line,
      column: position.start.column + offset - startOffset,
      offset,
    };
  }

  return undefined;
};

const createTextPosition = (
  node: Text,
  start: number,
  end: number,
  source: string,
): Position | undefined => {
  if (source.length >= end) {
    return {
      start: pointAtOffset(source, start),
      end: pointAtOffset(source, end),
    };
  }

  const startPoint = pointFromText(node, start);
  const endPoint = pointFromText(node, end);

  return startPoint && endPoint ? { start: startPoint, end: endPoint } : undefined;
};

const createText = (
  node: Text,
  value: string,
  start: number,
  end: number,
  source: string,
): Text => {
  const text: Text = { type: 'text', value };
  const position = createTextPosition(node, start, end, source);

  if (position) {
    text.position = position;
  }

  return text;
};

const replaceText = (target: TextPatchTarget, source: string): RootContent[] => {
  const offsets = getOffsets(target.node);

  if (!offsets) {
    return [target.node];
  }

  const result: RootContent[] = [];
  let decodedCursor = 0;
  let sourceCursor = offsets[0];

  for (const patch of target.patches) {
    if (
      patch.start < sourceCursor ||
      patch.decodedStart < decodedCursor ||
      patch.decodedEnd < patch.decodedStart ||
      target.node.value.length < patch.decodedEnd
    ) {
      continue;
    }

    const prefix = target.node.value.slice(decodedCursor, patch.decodedStart);

    if (prefix.length > 0) {
      result.push(createText(target.node, prefix, sourceCursor, patch.start, source));
    }

    result.push(createParserPatch(patch, patch.replacement));
    decodedCursor = patch.decodedEnd;
    sourceCursor = patch.end;
  }

  const suffix = target.node.value.slice(decodedCursor);

  if (suffix.length > 0) {
    result.push(createText(target.node, suffix, sourceCursor, offsets[1], source));
  }

  return result;
};

const applyTargets = (
  root: Root,
  textTargets: TextPatchTarget[],
  parentTargets: ParentPatchTarget[],
  source: string,
): void => {
  const textReplacements: TextReplacement[] = textTargets.map((target) => ({
    node: target.node,
    replacements: replaceText(target, source),
  }));
  const parents: Parent[] = [];

  for (const node of collectNodes(root)) {
    if (!isMdastParent(node) || !isArray(node.children)) {
      continue;
    }

    for (const target of textTargets) {
      if (node.children.some((child) => child === target.node)) {
        if (!parents.includes(node)) {
          parents.push(node);
        }
      }
    }
  }

  for (const target of parentTargets) {
    if (!parents.includes(target.parent)) {
      parents.push(target.parent);
    }
  }

  for (const parent of parents) {
    const nextChildren: RootContent[] = [];

    for (let index = 0; index <= parent.children.length; index += 1) {
      for (const target of parentTargets) {
        if (target.parent === parent && target.index === index) {
          nextChildren.push(...target.patches);
        }
      }

      const child = parent.children[index];

      if (!child) {
        continue;
      }

      const replacement = textReplacements.find((item) => item.node === child);

      nextChildren.push(...(replacement?.replacements ?? [child]));
    }

    parent.children = nextChildren;
  }
};

export const applyPatches = (root: Root, patches: IRawPatchItem[], source: string): void => {
  const nodes = collectNodes(root);
  const textTargets: TextPatchTarget[] = [];
  const parentTargets: ParentPatchTarget[] = [];
  const textSourceMaps = new Map<Text, TextSourceMap | null>();

  for (const patch of normalizePatches(patches)) {
    if (patch.start < patch.end) {
      const mapped = findTextForReplacement(nodes, patch, source, textSourceMaps);

      if (!mapped) {
        continue;
      }

      addTextPatch(textTargets, mapped.node, {
        ...mapped.patch,
        replacement: mapped.node.value.slice(mapped.patch.decodedStart, mapped.patch.decodedEnd),
      });
      continue;
    }

    const text = findTextForPoint(nodes, patch.start, source, textSourceMaps);

    if (text === null) {
      continue;
    }

    if (text) {
      addTextPatch(textTargets, text.node, {
        ...patch,
        decodedEnd: text.decodedOffset,
        decodedStart: text.decodedOffset,
      });
      continue;
    }

    const parent = findParentForPoint(root, patch.start, source);

    if (parent) {
      addParentPatch(parentTargets, parent, createParserPatch(patch));
    }
  }

  applyTargets(root, textTargets, parentTargets, source);
};

import type { Schema as SanitizationSchema } from 'hast-util-sanitize';

import { defaultsBy } from '@flowdown/utils';
import { concat, isArray, uniq } from 'lodash-es';
import { defaultSchema } from 'rehype-sanitize';

export interface CreateSchemaParams {
  allowedTags?: string[] | boolean;

  allowedProtocols?: string[];

  fallback?: SanitizationSchema;
}

const DEFAULT_ALLOWED_TAGS = ['u', 'br', 'a', 'span', 'em'];

const DEFAULT_ALLOWED_ATTRS = [
  'dataParserPatch',
  'dataPatchKey',
  'dataPatchText',
  'dataType',
  'style',
  'className',
];

export const createSchema = ({
  allowedTags,
  allowedProtocols,
  fallback,
}: CreateSchemaParams): SanitizationSchema => {
  const extraTags = isArray(allowedTags) ? allowedTags : [];

  const initialSchema = fallback ?? defaultSchema;

  const spanAttrs = uniq([...(initialSchema.attributes?.span ?? []), ...DEFAULT_ALLOWED_ATTRS]);

  const hrefProtocols = uniq(concat(initialSchema.protocols?.href ?? [], allowedProtocols ?? []));

  const srcProtocols = uniq(concat(initialSchema.protocols?.src ?? [], ['data']));

  const aAttrs = uniq([...(initialSchema.attributes?.a ?? []), 'href', 'title']);

  const codeAttrs = uniq([...(initialSchema.attributes?.code ?? []), 'dataMeta']);

  const tagNames = uniq(concat(initialSchema.tagNames ?? [], DEFAULT_ALLOWED_TAGS, extraTags));

  const attributes = defaultsBy(
    {
      span: spanAttrs,
      a: aAttrs,
      code: codeAttrs,
    },
    initialSchema.attributes ?? {},
  );

  const protocols = defaultsBy(
    {
      href: hrefProtocols,
      src: srcProtocols,
    },
    initialSchema.protocols ?? {},
  );

  return defaultsBy<SanitizationSchema>({ tagNames, attributes, protocols }, initialSchema);
};

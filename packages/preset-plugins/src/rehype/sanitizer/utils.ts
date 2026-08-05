import { defaultsPartial, type ExcludeNil } from '@flowdown/utils';
import { concat, isArray, uniq } from 'lodash-es';
import { defaultSchema } from 'rehype-sanitize';

import type { SanitizationSchema } from '../../typings';

export interface CreateSchemaParams {
  allowedTags?: string[] | boolean;

  allowedProtocols?: string[];

  fallback?: SanitizationSchema;
}

type ProtocolsSchema = ExcludeNil<SanitizationSchema['protocols']>;

type AttributesSchema = ExcludeNil<SanitizationSchema['attributes']>;

type AttributeDefinition = AttributesSchema[string][number];

const DEFAULT_ALLOWED_TAGS = ['u', 'br', 'a', 'span', 'em'];

const DEFAULT_ALLOWED_ATTRS: AttributeDefinition[] = [
  'dataParserPatch',
  'dataParserKey',
  'dataParserText',
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

  const spanAttrs: AttributeDefinition[] = uniq([
    ...(initialSchema.attributes?.span ?? []),
    ...DEFAULT_ALLOWED_ATTRS,
  ]);

  const hrefProtocols = uniq(concat(initialSchema.protocols?.href ?? [], allowedProtocols ?? []));

  const srcProtocols = uniq(concat(initialSchema.protocols?.src ?? [], ['data']));

  const aAttrs: AttributeDefinition[] = uniq([
    ...(initialSchema.attributes?.a ?? []),
    'href',
    'title',
  ]);

  const codeAttrs: AttributeDefinition[] = uniq([
    ...(initialSchema.attributes?.code ?? []),
    'dataMeta',
  ]);

  const tagNames = uniq(concat(initialSchema.tagNames ?? [], DEFAULT_ALLOWED_TAGS, extraTags));

  const attributes = defaultsPartial<AttributesSchema>(
    {
      span: spanAttrs,
      a: aAttrs,
      code: codeAttrs,
    },
    initialSchema.attributes ?? {},
  );

  const protocols = defaultsPartial<ProtocolsSchema>(
    {
      href: hrefProtocols,
      src: srcProtocols,
    },
    initialSchema.protocols ?? {},
  );

  return defaultsPartial<SanitizationSchema>({ tagNames, attributes, protocols }, initialSchema);
};

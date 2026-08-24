import type { Element } from 'hast';

export type PatchElement = Element & {
  properties: {
    dataParserPatch: '1';

    dataPatchKey: string;

    dataPatchText?: unknown;
  };
};

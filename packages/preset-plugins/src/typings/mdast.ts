import type { Properties } from 'hast';
import type { Node, Data as UnistData } from 'unist';

export interface ParserPatchProperties extends Properties {
  dataParserPatch: '1';

  dataPatchKey: string;

  dataPatchText?: string;
}

export interface ParserPatchData extends UnistData {
  key: string;

  hName: 'span';

  hProperties: ParserPatchProperties;
}

export interface ParserPatch extends Node {
  type: 'parserPatch';

  data: ParserPatchData;
}

export type PandocMathMode = 'display' | 'inline';

export interface PandocMathData {
  mode: PandocMathMode;
}

declare module 'mdast' {
  interface Data {
    pandocMath?: PandocMathData;
  }

  interface BlockContentMap {
    parserPatch: ParserPatch;
  }

  interface PhrasingContentMap {
    parserPatch: ParserPatch;
  }

  interface RootContentMap {
    parserPatch: ParserPatch;
  }
}

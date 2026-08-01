export interface ParsedHtmlTag {
  closing: boolean;
  name: string;
  normalizedName: string;
  selfClosing: boolean;
}

export interface OpenHtmlTag {
  name: string;
  normalizedName: string;
}

export const normalizePublicUrl = (
  value: string | undefined,
  { allowHash = false, allowMailto = false } = {},
) => {
  const source = value?.trim();

  if (!source) {
    return undefined;
  }

  if (source.startsWith('#')) {
    return allowHash ? source : undefined;
  }

  const scheme = /^([a-z][a-z\d+.-]*):/i.exec(source)?.[1]?.toLowerCase();

  if (!scheme) {
    try {
      const resolved = new URL(source, 'https://fluxdown.invalid');

      if (resolved.protocol !== 'https:') {
        return undefined;
      }

      return source;
    } catch {
      return undefined;
    }
  }

  if (scheme !== 'http' && scheme !== 'https' && !(allowMailto && scheme === 'mailto')) {
    return undefined;
  }

  try {
    const url = new URL(source);

    if (
      url.protocol !== 'http:' &&
      url.protocol !== 'https:' &&
      !(allowMailto && url.protocol === 'mailto:')
    ) {
      return undefined;
    }

    return source;
  } catch {
    return undefined;
  }
};

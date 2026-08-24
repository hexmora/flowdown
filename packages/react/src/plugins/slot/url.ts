export const normalizePublicUrl = (
  value: string | undefined,
  { allowHash = false, forceHttps = true } = {},
) => {
  const source = value?.trim();

  if (!source) {
    return undefined;
  }

  if (source.startsWith('#')) {
    return allowHash ? source : undefined;
  }

  if (source.startsWith('//')) {
    return `https:${source}`;
  }

  const scheme = /^([a-z][a-z\d+.-]*):/i.exec(source)?.[1]?.toLowerCase();

  if (!scheme) {
    try {
      const resolved = new URL(source, 'https://flowdown.invalid');

      if (resolved.protocol !== 'https:') {
        return undefined;
      }

      return source;
    } catch {
      return undefined;
    }
  }

  if (scheme !== 'http' && scheme !== 'https') {
    return undefined;
  }

  try {
    const url = new URL(source);

    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return undefined;
    }

    if (forceHttps && url.protocol === 'http:') {
      return source.replace(/^http:/i, 'https:');
    }

    return source;
  } catch {
    return undefined;
  }
};

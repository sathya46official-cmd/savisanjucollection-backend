const API_URL = process.env.API_URL || 'http://localhost:5000';

export function resolveImageUrl(url: string | null | undefined): string | null {
  if (!url) return url ?? null;
  if (url.startsWith('http')) return url;

  // image_url is sometimes stored as a JSON-stringified array
  if (url.startsWith('[')) {
    try {
      const parsed = JSON.parse(url) as (string | null)[];
      return JSON.stringify(parsed.map((u) => (u ? resolveImageUrl(u) : u)));
    } catch {
      // fall through to single URL handling
    }
  }

  return `${API_URL}${url.startsWith('/') ? '' : '/'}${url}`;
}

export function resolveVariantUrls(variant: any): any {
  if (!variant) return variant;
  return { ...variant, image_url: resolveImageUrl(variant.image_url) };
}

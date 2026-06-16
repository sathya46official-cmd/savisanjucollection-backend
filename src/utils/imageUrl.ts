const API_URL = process.env.API_URL || 'http://localhost:5000';

function resolveSingleUrl(url: string): string {
  if (url.startsWith('http')) return url;
  return `${API_URL}${url.startsWith('/') ? '' : '/'}${url}`;
}

export function resolveImageUrl(url: string | null | undefined): string | null {
  if (!url) return url ?? null;

  // image_url is stored as a JSON-stringified array: '["/uploads/products/..."]'
  if (url.startsWith('[')) {
    try {
      const parsed = JSON.parse(url) as (string | null)[];
      const resolved = parsed.map((u) => (u ? resolveSingleUrl(u) : null)).filter(Boolean);
      return resolved[0] ?? null;
    } catch {
      // fall through
    }
  }

  if (url.startsWith('http')) return url;
  return resolveSingleUrl(url);
}

export function resolveVariantUrls(variant: any): any {
  if (!variant) return variant;
  return { ...variant, image_url: resolveImageUrl(variant.image_url) };
}

const API_URL = process.env.API_URL || 'http://localhost:5000';

export function resolveImageUrl(url: string | null | undefined): string | null {
  if (!url) return url ?? null;
  if (url.startsWith('http')) return url;
  return `${API_URL}${url.startsWith('/') ? '' : '/'}${url}`;
}

export function resolveVariantUrls(variant: any): any {
  if (!variant) return variant;
  return { ...variant, image_url: resolveImageUrl(variant.image_url) };
}

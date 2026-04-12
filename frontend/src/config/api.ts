const RAW_API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:3322').replace(/\/$/, '');
const API_SUFFIX_PATTERN = /\/(?:api(?:\/api)?(?:\/v\d+)?)$/;
const matchedSuffix = RAW_API_URL.match(API_SUFFIX_PATTERN)?.[0];

// API_ORIGIN is used for non-API assets like /uploads.
export const API_ORIGIN = matchedSuffix ? RAW_API_URL.slice(0, -matchedSuffix.length) : RAW_API_URL;

// API_PREFIX supports both /api and versioned prefixes like /api/v1/v1.
export const API_PREFIX = matchedSuffix || '/api/v1';

// Backward-compatible alias for existing code that appends /api/v1/... manually.
export const API_BASE_URL = API_ORIGIN;

export function buildApiUrl(path: string): string {
	const normalizedPath = path.startsWith('/') ? path : `/${path}`;
	return `${API_ORIGIN}${API_PREFIX}${normalizedPath}`;
}

const RAW_API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:3322').replace(/\/$/, '');
const API_SUFFIX_PATTERN = /\/(?:api(?:\/api)?(?:\/v\d+)?)$/;
const VERSION_SUFFIX_PATTERN = /\/v\d+$/;
const matchedSuffix = RAW_API_URL.match(API_SUFFIX_PATTERN)?.[0];

// API_ORIGIN is the host/root used for API requests.
export const API_ORIGIN = matchedSuffix ? RAW_API_URL.slice(0, -matchedSuffix.length) : RAW_API_URL;

// Keep reverse-proxy path segments (e.g. /api, /api/api) and strip only API version suffix.
export const ASSET_BASE_URL = RAW_API_URL.replace(VERSION_SUFFIX_PATTERN, '');

// API_PREFIX supports both /api and versioned prefixes like /api/v1/v1.
export const API_PREFIX = matchedSuffix || '/api/v1';

// Backward-compatible alias for existing code that appends /api/v1/... manually.
export const API_BASE_URL = API_ORIGIN;

export function buildApiUrl(path: string): string {
	const normalizedPath = path.startsWith('/') ? path : `/${path}`;
	return `${API_ORIGIN}${API_PREFIX}${normalizedPath}`;
}

function getApiUploadsBase(baseUrl: string): string {
	if (/\/api(?:\/api)?$/.test(baseUrl)) {
		return baseUrl;
	}
	return `${baseUrl}/api`;
}

function rewriteUploadsPath(pathname: string, baseUrl: string): string {
	if (!pathname.startsWith('/uploads/')) {
		return pathname;
	}
	const uploadsBase = getApiUploadsBase(baseUrl);
	return `${uploadsBase}${pathname}`;
}

export function resolveAssetUrl(pathOrUrl?: string | null): string | null {
	if (!pathOrUrl) return null;
	if (pathOrUrl.startsWith('http://') || pathOrUrl.startsWith('https://')) {
		try {
			const url = new URL(pathOrUrl);
			if (url.pathname.startsWith('/uploads/')) {
				const uploadsBase = getApiUploadsBase(url.origin);
				return `${uploadsBase}${url.pathname}${url.search}${url.hash}`;
			}
		} catch {
			return pathOrUrl;
		}
		return pathOrUrl;
	}
	const normalizedPath = pathOrUrl.startsWith('/') ? pathOrUrl : `/${pathOrUrl}`;
	return rewriteUploadsPath(normalizedPath, ASSET_BASE_URL);
}

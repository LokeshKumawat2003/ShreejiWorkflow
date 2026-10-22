export function isValidPhone(value: string) {
	const phone = value.trim();
	return !phone || (/^\+?[0-9(). -]{7,30}$/.test(phone) && (phone.match(/\d/g) || []).length >= 7);
}

export function isValidEmail(value: string) {
	return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

/** Adds https:// when the scheme is missing; returns null for an unusable URL. */
export function normalizeWebsite(value: string) {
	const trimmed = value.trim();
	if (!trimmed) return '';
	const candidate = /^[a-z][a-z\d+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
	try {
		const url = new URL(candidate);
		if (!['http:', 'https:'].includes(url.protocol) || !url.hostname.includes('.')) return null;
		return candidate;
	} catch {
		return null;
	}
}

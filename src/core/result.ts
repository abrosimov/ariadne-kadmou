/** The outcome of reading something that may be malformed: its value, or why not. */
export type Result<T> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly reason: string };

export function ok<T>(value: T): Result<T> {
	return { ok: true, value };
}

export function fail(reason: string): Result<never> {
	return { ok: false, reason };
}

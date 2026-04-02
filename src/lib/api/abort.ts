const abortRegistry = new Map<string, AbortController>();

export function beginAbortableRequest(key: string): AbortSignal {
	const previous = abortRegistry.get(key);
	if (previous) {
		previous.abort();
	}

	const next = new AbortController();
	abortRegistry.set(key, next);
	return next.signal;
}

export function abortRequest(key: string): void {
	const current = abortRegistry.get(key);
	if (current) {
		current.abort();
		abortRegistry.delete(key);
	}
}

export function clearAbortRequest(key: string): void {
	abortRegistry.delete(key);
}

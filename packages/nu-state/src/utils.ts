export function isNonPrimitive(val: unknown): val is object {
	return val != null && (typeof val === "object" || typeof val === "function");
}

export function defaultEquals<T>(a: T, b: T): boolean {
	return a === b || (a !== a && b !== b);
}

import { listener as makeListener, Listener } from "./listener";

export function reaction<T>(
	track: () => T,
	callback: (a: T, listener: Listener) => void
): () => void {
	let value: T;

	const listener = makeListener(() => {
		const newValue = listener.track(track);

		if (newValue !== value) {
			value = newValue;
			callback(value, listener);
		}
	});

	value = listener.track(track);

	return function (): void {
		listener.dispose();
	};
}

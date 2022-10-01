import { listener as makeListener, Listener } from "./listener";

export function effect(callback: (t: Listener) => void): () => void {
	const boundCallback: () => void = () => callback.call(null, listener);

	const listener = makeListener(() => {
		listener.track(boundCallback);
	});

	listener.track(boundCallback);

	return function (): void {
		listener.dispose();
	};
}

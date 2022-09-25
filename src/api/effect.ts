import { listener as makeListener, Listener } from "./listener";
import { Graph } from "./graph";

export function effect(
	callback: (t: Listener) => void,
	opts?: { graph?: Graph }
): () => void {
	const boundCallback: () => void = () => callback.call(null, listener);

	const listener = makeListener(() => {
		listener.track(boundCallback);
	}, opts);

	listener.track(boundCallback);

	return function (): void {
		listener.dispose();
	};
}

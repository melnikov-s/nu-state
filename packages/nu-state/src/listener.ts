import { ListenerNode } from "nu-reactive-graph";

export type Listener = {
	dispose: () => void;
	start: () => void;
	end: () => void;
	track: <T>(trackFn: () => T) => T;
	isDisposed: boolean;
	callback(listener: Listener): void;
};

export function listener(callback: (listener: Listener) => void): Listener {
	return new ListenerNode(callback);
}

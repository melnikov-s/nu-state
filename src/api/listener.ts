import { ListenerNode } from "../core/nodes/listener";

export type Listener = {
	dispose: () => void;
	track: <T>(trackFn: () => T) => T;
	isDisposed: boolean;
};

export function listener(callback: (listener: Listener) => void): Listener {
	return new ListenerNode(callback);
}

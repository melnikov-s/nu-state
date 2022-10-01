import { runObserver, remove, startObserver, endObserver } from "../graph";
import { Listener, ObservableNode, nodeTypes } from "../types";

export class ListenerNode implements Listener {
	readonly nodeType = nodeTypes.listener;
	readonly observing: Set<ObservableNode> = new Set();
	private disposed = false;

	constructor(public callback: (listener: ListenerNode) => void) {}

	get isDisposed(): boolean {
		return this.disposed;
	}

	dispose(): void {
		this.disposed = true;
		remove(this);
	}

	react(): void {
		if (!this.disposed) {
			this.callback.call(null, this);
		}
	}

	start(): void {
		startObserver(this);
	}

	end(): void {
		endObserver(this);
	}

	track<T>(trackFn: () => T): T {
		return runObserver(this, trackFn);
	}
}

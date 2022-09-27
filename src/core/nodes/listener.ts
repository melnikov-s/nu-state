import { runObserver, remove } from "../graph";
import { Listener, ObservableNode, nodeTypes } from "../types";

export class ListenerNode implements Listener {
	readonly nodeType = nodeTypes.listener;
	readonly observing: Set<ObservableNode> = new Set();
	private disposed = false;

	constructor(readonly callback: (listener: ListenerNode) => void) {}

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

	track<T>(trackFn: () => T): T {
		return runObserver(this, trackFn);
	}
}

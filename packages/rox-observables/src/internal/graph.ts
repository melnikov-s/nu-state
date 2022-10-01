export type AtomNode = {
	reportObserved(): void;
	reportChanged(): void;
};

export type Graph = {
	batch<T extends (...args: any[]) => any>(fn: T): ReturnType<T>;
	runInAction<T extends (...args: any[]) => any>(fn: T): ReturnType<T>;
	isTracking(): boolean;
	onObservedStateChange(
		node: unknown,
		callback: (observing: boolean) => void
	): () => void;
	createAtom(): AtomNode;
	createComputed<T extends (...args: any[]) => any>(
		fn: T,
		context: unknown
	): T | { get(): ReturnType<T> };
};

const defaultGraph: Partial<Graph> = {
	batch(fn) {
		return fn();
	},
	createComputed(fn, context) {
		return fn.call(context);
	},
	runInAction(fn) {
		return this.batch!(fn);
	},
	isTracking() {
		return true;
	},
	onObservedStateChange() {
		return () => {};
	},
};

export function createGraph(newGraph: Partial<Graph>): Graph {
	return Object.assign({}, defaultGraph, newGraph) as Graph;
}

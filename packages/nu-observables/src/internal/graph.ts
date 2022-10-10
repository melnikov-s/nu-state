export type AtomNode = {
	reportObserved(): void;
	reportChanged(val?: unknown): void;
	node?: unknown;
};

export type SignalNode<T> = {
	reportObserved(): void;
	reportChanged(val: T): void;
	node?: unknown;
};

export type ComputedNode<T> = {
	get(): T;
	node?: unknown;
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
	createSignal<T>(initialValue: T): SignalNode<T>;
	createComputed<T extends (...args: any[]) => any>(
		fn: T,
		context: unknown
	): ComputedNode<ReturnType<T>>;
	effect(callback: () => void): () => void;
	enforceActions(enforce: boolean): void;
	isInAction(): boolean;
};

const defaultGraph: Partial<Graph> = {
	batch(fn) {
		return fn();
	},
	createComputed(fn, context) {
		return {
			get: () => fn.call(context),
		};
	},
	createSignal<T>(): SignalNode<T> {
		return this.createAtom!();
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
	effect(fn) {
		fn();
		return () => {};
	},
	enforceActions() {},
	isInAction() {
		return false;
	},
};

export function hasGraphFeature(graph: Graph, feature: keyof Graph): boolean {
	return graph[feature] !== defaultGraph[feature];
}

export function createGraph(newGraph: Partial<Graph>): Graph {
	return Object.assign({}, defaultGraph, newGraph) as Graph;
}

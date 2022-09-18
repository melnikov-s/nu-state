import CoreGraph, { ObservableNode } from "../core/graph";
import { getAdministration, isObservable } from "../observables/utils/lookup";
import AtomNode from "../core/nodes/atom";
import ComputedNode from "../core/nodes/computed";
import Signal from "../observables/signal";

const nodeMap = new WeakMap();

export function setNode(value: object, node: object): void {
	nodeMap.set(value, node);
}

export function getNode(value: object): any {
	return nodeMap.get(value);
}

export type Graph = {
	enforceActions: (enforce: boolean) => void;
	isInAction: () => boolean;
	isInBatch: () => boolean;
	isObserved: (node: ObservableNode) => boolean;
	isTracking: () => boolean;
	runInAction: <T>(fn: () => T) => T;
	batch: <T>(fn: () => T) => T;
	startAction: () => void;
	endAction: () => void;
	startBatch: () => void;
	endBatch: () => void;
	untracked: <T>(fn: () => T) => T;
	onReactionsComplete: (callback: () => void) => () => void;
	task<T>(promise: Promise<T>): Promise<T>;
};

export default function makeGraph(): Graph {
	return new CoreGraph();
}

let defaultGraph: Graph;

export function getDefaultGraph(): Graph {
	return (defaultGraph = defaultGraph ?? makeGraph());
}

export function setDefaultGraph(graph: Graph): void {
	defaultGraph = graph;
}

export function resolveGraph(graph: Graph | null | undefined): CoreGraph {
	return (graph ?? getDefaultGraph()) as CoreGraph;
}

export function enforceActions(enforce: boolean): void {
	return getDefaultGraph().enforceActions(enforce);
}

export function isObserved(
	observable: object,
	{ graph = defaultGraph } = {}
): boolean {
	const target = getNode(observable) ?? observable;

	if (target instanceof AtomNode || target instanceof ComputedNode) {
		return graph.isObserved(target as ObservableNode);
	} else if (target instanceof Signal) {
		return graph.isObserved(target.atom);
	} else if (isObservable(target)) {
		const adm = getAdministration(target as object);
		return graph.isObserved(adm.atom);
	}

	return false;
}

export function isInAction(): boolean {
	return getDefaultGraph().isInAction();
}

export function isInBatch(): boolean {
	return getDefaultGraph().isInBatch();
}

export function isTracking(): boolean {
	return getDefaultGraph().isTracking();
}

export function batch<T>(fn: () => T): T {
	return getDefaultGraph().batch(fn);
}

export function runInAction<T>(fn: () => T): T {
	return getDefaultGraph().runInAction(fn);
}

export function task<T>(promise: Promise<T>): Promise<T> {
	return getDefaultGraph().task(promise);
}

export function untracked<T>(fn: () => T): T {
	return getDefaultGraph().untracked(fn);
}

export function source<T extends object>(obj: T): T {
	const adm = getAdministration(obj);
	return adm?.source;
}

export function reportChanged<T extends object>(obj: T): T {
	const adm = getAdministration(obj);
	if (!adm) {
		throw new Error(`reportChanged called on an invalid object`);
	}
	adm.reportChanged();

	return obj;
}

export function reportObserved<T extends object>(
	obj: T,
	opts?: { deep?: boolean }
): T {
	const adm = getAdministration(obj);
	if (!adm) {
		throw new Error(`reportObserved called on an invalid object`);
	}
	adm.reportObserved(opts?.deep);

	return obj;
}

export function onReactionsComplete(callback: () => void): () => void {
	return getDefaultGraph().onReactionsComplete(callback);
}

type KeyType<T> = T extends Set<infer R>
	? R
	: T extends Map<infer K, unknown>
	? K
	: T extends WeakSet<infer R>
	? R
	: T extends WeakMap<infer K, unknown>
	? K
	: string | number | symbol;

export function onObservedStateChange<T extends object>(
	obj: T,
	key: KeyType<T>,
	callback: (observing: boolean) => void
): () => void;
export function onObservedStateChange<T extends object>(
	obj: T,
	callback: (observing: boolean) => void
): () => void;
export function onObservedStateChange<T extends object>(
	obj: T,
	keyOrCallback: unknown | (() => void),
	callback?: (observing: boolean) => void
): () => void {
	const target = getNode(obj) ?? obj;

	const cb =
		typeof keyOrCallback === "function"
			? (keyOrCallback as () => void)
			: callback!;
	const key = callback ? keyOrCallback : undefined;

	if (
		target instanceof Signal ||
		target instanceof ComputedNode ||
		target instanceof AtomNode
	) {
		if (key) {
			throw new Error(
				`onObservedStateChange key param not supported for observable box or computed value`
			);
		}

		return target.graph.onObservedStateChange(
			(target as any).atom || (target as any),
			cb
		);
	}

	if (!isObservable(target)) {
		throw new Error(
			`onObservedStateChange can only be called on observable values`
		);
	}

	const adm = getAdministration(target);

	return adm.onObservedStateChange(cb, key as PropertyKey);
}

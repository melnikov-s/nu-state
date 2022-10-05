import {
	createGraph,
	getObservable,
	getObservableClassInstance,
	getSource,
	getAdministration,
} from "../src";
import {
	AtomNode,
	ComputedNode,
	batch,
	runInAction,
	isTracking,
	onObservedStateChange,
	ListenerNode,
} from "rox-core";

export { isInAction, enforceActions, runInAction } from "rox-core";

export const graph = createGraph({
	createAtom() {
		return new AtomNode();
	},
	createComputed(fn, context) {
		return new ComputedNode(fn, undefined, false, context);
	},
	batch,
	runInAction(fn) {
		return runInAction(fn, false);
	},
	isTracking,
	onObservedStateChange,
});

export function observable<T>(obj: T): T {
	return getObservable(obj, graph);
}

export function source<T>(obj: T): T {
	return getSource(obj);
}

export function computed<T>(fn: () => T) {
	const computedNode = new ComputedNode(fn);

	const computed = computedNode.get.bind(computedNode);

	return computed;
}

export function effect(callback: () => void): () => void {
	const boundCallback: () => void = () => callback.call(null, listener);

	const listener = new ListenerNode(() => {
		listener.track(boundCallback);
	});

	listener.track(boundCallback);

	return function (): void {
		listener.dispose();
	};
}

export function reaction<T>(
	track: () => T,
	callback: (a: T) => void
): () => void {
	let value: T;

	const listener = new ListenerNode(() => {
		const newValue = listener.track(track);

		if (newValue !== value) {
			value = newValue;
			callback(value);
		}
	});

	value = listener.track(track);

	return function (): void {
		listener.dispose();
	};
}

export class Observable {
	constructor() {
		return getObservableClassInstance(this, graph);
	}
}

export function reportChanged<T extends object>(obj: T): T {
	const adm = getAdministration(obj);
	adm.reportChanged();

	return obj;
}

export function reportObserved<T extends object>(
	obj: T,
	opts?: { deep?: boolean }
): T {
	const adm = getAdministration(obj);

	adm.reportObserved(opts?.deep);

	return obj;
}

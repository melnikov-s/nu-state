import {
	getObservable,
	getObservableClassInstance,
	getSource,
	getAdministration,
	getTestGraph,
} from "nu-observables";

export function observable<T>(obj: T): T {
	return getObservable(obj, getTestGraph());
}

export function source<T>(obj: T): T {
	return getSource(obj);
}

export function computed<T>(fn: () => T) {
	const computedNode = getTestGraph().createComputed(fn, null);

	const computed = computedNode.get.bind(computedNode);

	return computed;
}

export function effect(callback: () => void): () => void {
	return getTestGraph().effect(callback);
}

export function reaction<T>(
	track: () => T,
	callback: (value: T) => void
): () => void {
	let value: T;
	let prevValue: T;
	let firstRun = true;

	return getTestGraph().effect(() => {
		value = track();
		if (!firstRun) {
			if (value !== prevValue) {
				callback(value);
			}
		}
		prevValue = value;
		firstRun = false;
	});
}

export function isInAction() {
	return getTestGraph().isInAction();
}

export function runInAction<T>(fn: () => T) {
	return getTestGraph().runInAction(fn);
}

export function enforceActions(enforce: boolean) {
	return getTestGraph().enforceActions(enforce);
}
export class Observable {
	constructor() {
		return getObservableClassInstance(this, getTestGraph());
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

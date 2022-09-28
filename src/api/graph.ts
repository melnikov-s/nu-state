import { getAdministration, isObservable } from "../observables/utils/lookup";
import { AtomNode } from "../core/nodes/atom";
import { ComputedNode } from "../core/nodes/computed";
import { Signal } from "../observables/signal";
import {
	onObservedStateChange as coreOnObservedStateChange,
	isObserved as coreIsObserved,
} from "../core/graph";

const nodeMap = new WeakMap();

export {
	runInAction,
	batch,
	isInAction,
	isInBatch,
	isTracking,
	task,
	untracked,
	enforceActions,
	onReactionsComplete,
} from "../core/graph";

export { isObservable, getSource as source } from "../observables/utils/lookup";

export function setNode(value: object, node: object): void {
	nodeMap.set(value, node);
}

export function getNode(value: object): any {
	return nodeMap.get(value);
}

export function isObserved(observable: object): boolean {
	const target = getNode(observable) ?? observable;

	if (target instanceof AtomNode || target instanceof ComputedNode) {
		return coreIsObserved(target);
	} else if (target instanceof Signal) {
		return coreIsObserved(target.atom);
	} else if (isObservable(target)) {
		const adm = getAdministration(target as object);
		return coreIsObserved(adm.atom);
	}

	return false;
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

		return coreOnObservedStateChange(
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

import { Graph } from "./graph";
import { CollectionAdministration } from "../collection";
import { ObjectAdministration } from "../object";
import { ArrayAdministration } from "../array";
import { DateAdministration } from "../date";
import { Administration } from "./Administration";
import { isPlainObject } from "./utils";

const administrationMap: WeakMap<object, Administration> = new WeakMap();

export function getAdministration<T extends object>(
	obj: T
): T extends Set<infer S>
	? CollectionAdministration<S>
	: T extends Map<infer K, infer V>
	? CollectionAdministration<K, V>
	: T extends Array<infer R>
	? ArrayAdministration<R>
	: T extends Date
	? DateAdministration
	: ObjectAdministration<any> {
	return administrationMap.get(obj as object)! as ReturnType<
		typeof getAdministration
	>;
}

const actionsMap: WeakMap<Function, Function> = new WeakMap();

export function getSource<T>(obj: T): T {
	const adm = getAdministration(obj as object);

	return adm ? (adm.source as unknown as T) : obj;
}

export function getAction<T extends Function>(fn: T, graph: Graph): T {
	let action = actionsMap.get(fn);

	if (!action) {
		action = function (this: unknown, ...args: unknown[]): unknown {
			if (new.target) {
				return new (fn as any)(...args);
			}

			return graph.runInAction(() => fn.apply(this, args));
		};

		actionsMap.set(fn, action);
	}

	return action as T;
}

export function throwObservablesOnSource(): never {
	throw new Error(
		"observables on source objects are not allowed! Be sure to use `source(observable)` to convert to source object before creating a new observable"
	);
}

export function getObservableClassInstance<T extends object>(
	value: T,
	graph: Graph
): T {
	const adm = new ObjectAdministration(value, graph);
	return adm.proxy as unknown as T;
}

export function getObservable<T>(
	value: T,
	graph: Graph,
	ensureSource: boolean = true
): T {
	if (!value) {
		return value;
	}

	const adm = getAdministration(value);

	if (adm) {
		if (adm.graph !== graph) {
			throw new Error("observables can only exists on a single graph");
		}

		if (process.env.NODE_ENV !== "production") {
			if (ensureSource && adm.proxy === value) {
				throwObservablesOnSource();
			}
		}
		return adm.proxy as unknown as T;
	}

	if (
		(typeof value === "object" || typeof value === "function") &&
		!Object.isFrozen(value)
	) {
		const obj = value as unknown as object;

		let Adm: new (obj: any, graph: Graph) => Administration =
			ObjectAdministration;

		if (Array.isArray(obj)) {
			Adm = ArrayAdministration;
		} else if (obj instanceof Map || obj instanceof WeakMap) {
			Adm = CollectionAdministration;
		} else if (obj instanceof Set || obj instanceof WeakSet) {
			Adm = CollectionAdministration;
		} else if (obj instanceof Date) {
			Adm = DateAdministration;
		} else if (!isPlainObject(value)) {
			return value;
		}

		const adm = new Adm(obj, graph);
		administrationMap.set(adm.proxy, adm);
		administrationMap.set(adm.source, adm);
		return adm.proxy as unknown as T;
	}

	return value;
}

export function isObservable(obj: unknown): boolean {
	const adm = getAdministration(obj as object);
	return !!(adm && adm.proxy === obj);
}

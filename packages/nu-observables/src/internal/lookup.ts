import { Graph } from "./graph";
import { CollectionAdministration } from "../collection";
import { ObjectAdministration } from "../object";
import { ArrayAdministration } from "../array";
import { DateAdministration } from "../date";
import { Administration } from "./Administration";
import { isPlainObject } from "./utils";

type AdministrationType = {
	object: typeof ObjectAdministration;
	collection: typeof CollectionAdministration;
	date: typeof DateAdministration;
	array: typeof ArrayAdministration;
};

const administrationMap: WeakMap<object, Administration> = new WeakMap();
const administrationTypeMap: WeakMap<
	Graph,
	Partial<AdministrationType>
> = new WeakMap();

const defaultAdministrationTypes = {
	object: ObjectAdministration,
	date: DateAdministration,
	array: ArrayAdministration,
	collection: CollectionAdministration,
};

export function setAdministrationType(
	admType: Partial<AdministrationType>,
	graph: Graph
): void {
	if (administrationTypeMap.get(graph)) {
		throw new Error("Administration type already set for this graph");
	}

	administrationTypeMap.set(graph, admType);
}

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
	const ObjectAdm =
		administrationTypeMap.get(graph)?.object ?? ObjectAdministration;
	const adm = new ObjectAdm(value, graph);
	administrationMap.set(adm.source, adm);
	return adm.proxy as unknown as T;
}

export function getObservableIfExists<T>(value: T): T | undefined {
	const adm = getAdministration(value as object);
	if (adm) {
		return adm.proxy;
	}

	return undefined;
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
	const admTypes = administrationTypeMap.get(graph);

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
			admTypes?.object ?? defaultAdministrationTypes.object;

		if (Array.isArray(obj)) {
			Adm = admTypes?.array ?? defaultAdministrationTypes.array;
		} else if (obj instanceof Map || obj instanceof WeakMap) {
			Adm = admTypes?.collection ?? defaultAdministrationTypes.collection;
		} else if (obj instanceof Set || obj instanceof WeakSet) {
			Adm = admTypes?.collection ?? defaultAdministrationTypes.collection;
		} else if (obj instanceof Date) {
			Adm = admTypes?.date ?? defaultAdministrationTypes.date;
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

export function getInternalNode(obj: object, key?: PropertyKey): any {
	const adm = getAdministration(obj);

	if (!adm) {
		throw new Error(
			"`getInternalNode` expected an observable object. Received: " + typeof obj
		);
	}

	return adm.getNode(key);
}

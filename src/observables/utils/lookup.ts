import Graph from "../../core/graph";
import { MapAdministration } from "../map";
import { SetAdministration } from "../set";
import { ObjectAdministration } from "../object";
import { ArrayAdministration } from "../array";
import { DateAdministration } from "../date";
import Administration, { getAdministration as getAdm } from "./Administration";
import { isPlainObject } from "../../utils";

export function getAdministration<T extends object>(
	obj: T
): T extends Set<infer S>
	? SetAdministration<S>
	: T extends Map<infer K, infer V>
	? MapAdministration<K, V>
	: T extends Array<infer R>
	? ArrayAdministration<R>
	: T extends Date
	? DateAdministration
	: ObjectAdministration<any> {
	return getAdm(obj)! as ReturnType<typeof getAdministration>;
}

const actionsMap: WeakMap<Function, Function> = new WeakMap();

export function source<T>(obj: T): T {
	const adm = getAdm(obj);

	return adm ? (adm.source as unknown as T) : obj;
}

export function getAction<T extends Function>(fn: T, graph: Graph): T {
	let action = actionsMap.get(fn);

	if (!action) {
		action = function (this: unknown, ...args: unknown[]): unknown {
			if (new.target) {
				return new (fn as any)(...args);
			}

			return graph.runInAction(() => fn.apply(this, args), false);
		};

		actionsMap.set(fn, action);
	}

	return action as T;
}

export function getObservable<T>(
	value: T,
	graph: Graph,
	observeClass: boolean = false
): T {
	const adm = getAdm(value);

	if (adm) {
		if (adm.graph !== graph) {
			throw new Error("observables can only exists on a single graph");
		}

		return adm.proxy as unknown as T;
	}

	if (!value) {
		return value;
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
			Adm = MapAdministration;
		} else if (obj instanceof Set || obj instanceof WeakSet) {
			Adm = SetAdministration;
		} else if (obj instanceof Date) {
			Adm = DateAdministration;
		} else if (!observeClass && !isPlainObject(value)) {
			return value;
		}

		const adm = new Adm(obj, graph);
		return adm.proxy as unknown as T;
	}

	return value;
}

export function isObservable(obj: unknown): boolean {
	const adm = getAdm(obj);
	return !!(adm && adm.proxy === obj);
}

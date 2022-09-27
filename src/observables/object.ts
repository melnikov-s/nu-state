import { AtomNode } from "../core/nodes/atom";
import {
	batch,
	onObservedStateChange,
	isTracking,
	runInAction,
} from "../core/graph";
import { getObservable, getSource, getAction } from "./utils/lookup";
import {
	isPropertyKey,
	getPropertyDescriptor,
	PropertyType,
	getPropertyType,
} from "../utils";
import { Administration, getAdministration } from "./utils/Administration";
import { AtomMap } from "./utils/AtomMap";
import { ComputedNode } from "../core/nodes/computed";

export class ObjectAdministration<T extends object> extends Administration<T> {
	keysAtom: AtomNode;
	hasMap: AtomMap<PropertyKey>;
	valuesMap: AtomMap<PropertyKey>;
	computedMap!: Map<PropertyKey, ComputedNode<T[keyof T]>>;
	types: Map<PropertyKey, PropertyType>;

	constructor(source: T = {} as T) {
		super(source);
		this.keysAtom = new AtomNode();
		this.hasMap = new AtomMap(true);
		this.valuesMap = new AtomMap();
		this.types = new Map();

		if (typeof source === "function") {
			this.proxyTraps.construct = (_, args) =>
				this.proxyConstruct(args) as object;
			this.proxyTraps.apply = (_, thisArg, args) =>
				this.proxyApply(thisArg, args);
		}

		this.proxyTraps.get = (_, name) => this.proxyGet(name as keyof T);
		this.proxyTraps.set = (_, name, value) =>
			this.proxySet(name as keyof T, value);
		this.proxyTraps.has = (_, name) => this.proxyHas(name as keyof T);
		this.proxyTraps.deleteProperty = (_, name) =>
			this.proxyDeleteProperty(name as keyof T);
		this.proxyTraps.ownKeys = () => this.proxyOwnKeys();
	}

	private proxyConstruct(
		args: unknown[]
	): T extends new (args: unknown[]) => unknown ? InstanceType<T> : never {
		const instance = Reflect.construct(this.source as Function, args);

		return getObservable(instance);
	}

	private proxyApply(
		thisArg: unknown,
		args: unknown[]
	): T extends (args: unknown[]) => unknown ? ReturnType<T> : never {
		return batch(() => Reflect.apply(this.source as Function, thisArg, args));
	}

	private proxyHas(name: keyof T): boolean {
		if (!(name in Object.prototype) && isPropertyKey(name))
			return this.has(name);
		return Reflect.has(this.source, name);
	}

	private proxyGet(name: keyof T): unknown {
		if (
			!(name in Object.prototype) &&
			isPropertyKey(name) &&
			(typeof this.source !== "function" || name !== "prototype")
		) {
			return this.read(name);
		}

		return Reflect.get(this.source, name, this.proxy);
	}

	private proxySet(name: keyof T, value: T[keyof T]): boolean {
		if (!isPropertyKey(name)) return false;

		this.write(name, value);

		return true;
	}

	private proxyDeleteProperty(name: keyof T): boolean {
		if (!isPropertyKey(name)) return false;
		this.remove(name);
		return true;
	}

	private proxyOwnKeys(): (string | symbol)[] {
		this.keysAtom.reportObserved();
		return Reflect.ownKeys(this.source);
	}

	private get(key: PropertyKey): T[keyof T] {
		return Reflect.get(this.source, key, this.proxy);
	}

	private set(key: PropertyKey, value: T[keyof T]): void {
		batch(() => {
			Reflect.set(this.source, key, value, this.proxy);
		});
	}

	private getComputed(key: keyof T): ComputedNode<T[keyof T]> {
		if (!this.computedMap) this.computedMap = new Map();
		let computedNode = this.computedMap.get(key);
		if (!computedNode) {
			const descriptor = getPropertyDescriptor(this.source, key)!;
			if (typeof descriptor?.get !== "function") {
				throw new Error("computed values are only supported on getters");
			}
			computedNode = new ComputedNode(
				descriptor.get,
				undefined,
				false,
				this.proxy
			);

			this.computedMap.set(key, computedNode);
		}

		return computedNode;
	}

	private getType(key: keyof T): PropertyType {
		let type = this.types.get(key);

		if (!type) {
			type = getPropertyType(key, this.source);
			this.types.set(key, type);
		}

		return type;
	}

	protected reportObserveDeep(): void {
		Object.getOwnPropertyNames(this.source).forEach((name) => {
			const result = this.read(name as keyof T);
			getAdministration(result)?.reportObserved();
		});
	}

	onObservedStateChange(
		callback: (observing: boolean) => void,
		key: keyof T | undefined
	): () => void {
		if (key == null) {
			return onObservedStateChange(this.atom, callback);
		}

		const type = this.getType(key);

		switch (type) {
			case "action": {
				throw new Error(`onObservedStatChange not supported on actions`);
			}
			case "observable": {
				const atom = this.valuesMap.getOrCreate(key);
				return onObservedStateChange(atom, callback);
			}
			case "computed": {
				const computed = this.getComputed(key);
				return onObservedStateChange(computed, callback);
			}
		}
	}

	read(key: keyof T): unknown {
		const type = this.getType(key);

		switch (type) {
			case "observable":
			case "action": {
				if (key in this.source) {
					this.valuesMap.reportObserved(key);
				} else if (isTracking()) {
					this.hasMap.reportObserved(key);
				}

				this.atom.reportObserved();

				if (type === "observable") {
					return getObservable(this.get(key));
				}

				return getAction(this.get(key) as unknown as Function);
			}
			case "computed": {
				const computedNode = this.getComputed(key);

				return computedNode.get();
			}
			default:
				throw new Error(`unknown type passed to configure`);
		}
	}

	write(key: keyof T, newValue: T[keyof T]): void {
		const type = this.getType(key);

		// if this property is a setter
		if (type === "computed") {
			runInAction(() => this.set(key, newValue));
			return;
		}

		const had = key in this.source;
		const oldValue: T[keyof T] = this.get(key);
		const targetValue = getSource(newValue);

		if (!had || oldValue !== targetValue) {
			this.set(key, targetValue);

			batch(() => {
				this.flushChange();
				if (!had) {
					this.keysAtom.reportChanged();
					this.hasMap.reportChanged(key);
				}

				this.valuesMap.reportChanged(key);
			});
		}
	}

	has(key: keyof T): boolean {
		if (isTracking()) {
			this.hasMap.reportObserved(key);
			this.atom.reportObserved();
		}

		return key in this.source;
	}

	remove(key: keyof T): void {
		if (!(key in this.source)) return;

		delete this.source[key];
		batch(() => {
			this.flushChange();
			this.valuesMap.reportChanged(key);
			this.keysAtom.reportChanged();
			this.hasMap.reportChanged(key);

			this.valuesMap.delete(key);
		});
	}
}

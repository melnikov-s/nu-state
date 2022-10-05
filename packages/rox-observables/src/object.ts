import { AtomNode, ComputedNode, Graph } from "./internal/graph";
import {
	getObservable,
	getSource,
	getAction,
	throwObservablesOnSource,
	isObservable,
	getAdministration,
} from "./internal/lookup";
import {
	isPropertyKey,
	getPropertyDescriptor,
	PropertyType,
	getPropertyType,
	resolveNode,
} from "./internal/utils";
import { Administration } from "./internal/Administration";
import { AtomMap, SignalMap } from "./internal/NodeMap";

export class ObjectAdministration<T extends object> extends Administration<T> {
	keysAtom: AtomNode;
	hasMap: AtomMap<PropertyKey>;
	valuesMap: SignalMap<PropertyKey>;
	computedMap!: Map<PropertyKey, ComputedNode<T[keyof T]>>;
	types: Map<PropertyKey, PropertyType>;

	constructor(source: T = {} as T, graph: Graph) {
		super(source, graph);
		this.keysAtom = graph.createAtom();
		this.hasMap = new AtomMap(graph, true);
		this.valuesMap = new SignalMap(graph);
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

		if (process.env.NODE_ENV !== "production") {
			Object.getOwnPropertyNames(source).forEach((name) => {
				const type = this.getType(name as keyof T);
				if (type === "observable" && isObservable(source[name])) {
					throwObservablesOnSource();
				}
			});
		}
	}

	private proxyConstruct(
		args: unknown[]
	): T extends new (args: unknown[]) => unknown ? InstanceType<T> : never {
		const instance = Reflect.construct(this.source as Function, args);

		return getObservable(instance, this.graph);
	}

	private proxyApply(
		thisArg: unknown,
		args: unknown[]
	): T extends (args: unknown[]) => unknown ? ReturnType<T> : never {
		return this.graph.batch(() =>
			Reflect.apply(this.source as Function, thisArg, args)
		);
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
		this.graph.batch(() => {
			this.keysAtom.reportObserved();
			this.atom.reportObserved();
		});

		return Reflect.ownKeys(this.source);
	}

	private get(key: PropertyKey): T[keyof T] {
		return Reflect.get(this.source, key, this.proxy);
	}

	private set(key: PropertyKey, value: T[keyof T]): void {
		this.graph.batch(() => {
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
			computedNode = this.graph.createComputed(descriptor.get, this.proxy);

			this.computedMap.set(key, computedNode);
		}

		return computedNode;
	}

	private callComputed(key: keyof T): T[keyof T] {
		const computedNode = this.getComputed(key);

		return computedNode.get();
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
			const value = this.source[name];
			if (value && typeof value === "object") {
				getAdministration(getObservable(value, this.graph))?.reportObserved();
			}
		});
	}

	getNode(key?: keyof T): unknown {
		if (!key) {
			return this.atom;
		}

		const type = this.getType(key);

		if (type === "computed") {
			return resolveNode(this.getComputed(key));
		}

		return resolveNode(this.valuesMap.getOrCreate(key, this.source[key]));
	}

	onObservedStateChange(
		callback: (observing: boolean) => void,
		key: keyof T | undefined
	): () => void {
		if (key == null) {
			return this.graph.onObservedStateChange(
				this.atom.node ?? this.atom,
				callback
			);
		}

		const type = this.getType(key);

		switch (type) {
			case "action": {
				throw new Error(`onObservedStatChange not supported on actions`);
			}
			case "observable": {
				const atom = this.valuesMap.getOrCreate(key, this.source[key]);
				return this.graph.onObservedStateChange(
					atom.node ?? this.atom,
					callback
				);
			}
			case "computed": {
				const computed = this.getComputed(key);
				return this.graph.onObservedStateChange(
					computed.node ?? this.atom,
					callback
				);
			}
		}
	}

	read(key: keyof T): unknown {
		const type = this.getType(key);

		switch (type) {
			case "observable":
			case "action": {
				if (key in this.source) {
					this.valuesMap.reportObserved(key, this.source[key]);
				} else if (this.graph.isTracking()) {
					this.hasMap.reportObserved(key);
				}

				this.atom.reportObserved();

				if (type === "observable") {
					return getObservable(this.get(key), this.graph);
				}

				return getAction(this.get(key) as unknown as Function, this.graph);
			}
			case "computed": {
				return this.callComputed(key);
			}
			default:
				throw new Error(`unknown type passed to configure`);
		}
	}

	write(key: keyof T, newValue: T[keyof T]): void {
		const type = this.getType(key);

		// if this property is a setter
		if (type === "computed") {
			this.graph.runInAction(() => this.set(key, newValue));
			return;
		}

		const had = key in this.source;
		const oldValue: T[keyof T] = this.get(key);
		const targetValue = getSource(newValue);

		if (!had || oldValue !== targetValue) {
			this.set(key, targetValue);

			this.graph.batch(() => {
				this.flushChange();
				if (!had) {
					this.keysAtom.reportChanged();
					this.hasMap.reportChanged(key);
				}
				this.valuesMap.reportChanged(key, newValue);
			});
		}
	}

	has(key: keyof T): boolean {
		if (this.graph.isTracking()) {
			this.hasMap.reportObserved(key);
			this.atom.reportObserved();
		}

		return key in this.source;
	}

	remove(key: keyof T): void {
		if (!(key in this.source)) return;

		delete this.source[key];
		this.graph.batch(() => {
			this.flushChange();
			this.valuesMap.reportChanged(key, undefined);
			this.keysAtom.reportChanged();
			this.hasMap.reportChanged(key);

			this.valuesMap.delete(key);
		});
	}
}

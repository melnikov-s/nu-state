import { batch, onObservedStateChange } from "../../core/graph";
import { AtomNode } from "../../core/nodes/atom";
import { AtomMap } from "./AtomMap";

const administrationMap: WeakMap<object, Administration> = new WeakMap();

export function getAdministration(obj: unknown): Administration | undefined {
	return administrationMap.get(obj as object);
}

let circularRefSet: WeakSet<object> | null = null;

export class Administration<T extends object = object> {
	readonly proxy: T;
	readonly source: T;
	readonly atom: AtomNode;
	readonly proxyTraps: ProxyHandler<T> = {
		preventExtensions(): boolean {
			throw new Error(`observable objects cannot be frozen`);
			return false;
		},
	};
	protected valuesMap?: AtomMap<unknown>;
	private forceObservedAtoms?: AtomNode[];

	constructor(source: T) {
		this.atom = new AtomNode();
		this.source = source;
		this.proxy = new Proxy(this.source, this.proxyTraps) as T;
		administrationMap.set(this.proxy, this);
		administrationMap.set(this.source, this);
	}

	protected flushChange(): void {
		if (this.forceObservedAtoms?.length) {
			batch(() => {
				for (let i = 0; i < this.forceObservedAtoms!.length; i++) {
					this.forceObservedAtoms![i].reportChanged();
				}
			});
			this.forceObservedAtoms = undefined;
		}
	}

	reportChanged(): void {
		this.atom.reportChanged();
	}

	protected reportObserveDeep(): void {}

	reportObserved(deep = true): void {
		const entry = circularRefSet == null;
		if (entry) {
			circularRefSet = new WeakSet();
		} else if (circularRefSet!.has(this)) {
			return;
		}

		circularRefSet!.add(this);

		const atom = new AtomNode();
		if (!this.forceObservedAtoms) {
			this.forceObservedAtoms = [];
		}
		this.forceObservedAtoms.push(atom);
		atom.reportObserved();
		if (deep) {
			this.reportObserveDeep();
		}

		if (entry) {
			circularRefSet = null;
		}
	}

	onObservedStateChange(
		callback: (observing: boolean) => void,
		key: unknown
	): () => void {
		let atom = this.atom;

		if (key) {
			if (!this.valuesMap) {
				throw new Error(
					"onObservedStateChange with key not supported on this type."
				);
			}

			atom = this.valuesMap.getOrCreate(key);
		}
		return onObservedStateChange(atom, callback);
	}
}

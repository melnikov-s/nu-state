import { AtomNode, Graph } from "./graph";
import { AtomMap } from "./AtomMap";

let circularRefSet: WeakSet<object> | null = null;

export class Administration<T extends object = object> {
	readonly proxy: T;
	readonly source: T;
	readonly atom: AtomNode;
	readonly graph: Graph;
	readonly proxyTraps: ProxyHandler<T> = {
		preventExtensions(): boolean {
			throw new Error(`observable objects cannot be frozen`);
			return false;
		},
	};
	protected valuesMap?: AtomMap<unknown>;
	private forceObservedAtoms?: AtomNode[];

	constructor(source: T, graph: Graph) {
		this.graph = graph;
		this.atom = graph.createAtom();
		this.source = source;
		this.proxy = new Proxy(this.source, this.proxyTraps) as T;
	}

	protected flushChange(): void {
		if (this.forceObservedAtoms?.length) {
			this.graph.batch(() => {
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

		const atom = this.graph.createAtom();
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
		return this.graph.onObservedStateChange(atom, callback);
	}
}

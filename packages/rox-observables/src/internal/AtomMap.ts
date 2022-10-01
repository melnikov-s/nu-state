import { Graph, AtomNode } from "./graph";
import { isNonPrimitive } from "./utils";

export class AtomMap<K> {
	private map: Map<unknown, AtomNode> | undefined;
	private weakMap: WeakMap<object, AtomNode> | undefined;
	private readonly clearOnUnobserved: boolean;
	private readonly graph: Graph;

	constructor(graph: Graph, clearOnUnobserved: boolean = false) {
		this.graph = graph;
		this.clearOnUnobserved = clearOnUnobserved;
	}

	get(key: unknown): AtomNode | undefined {
		return isNonPrimitive(key) ? this.weakMap?.get(key) : this.map?.get(key);
	}

	delete(key: K): void {
		isNonPrimitive(key) ? this.weakMap?.delete(key) : this.map?.delete(key);
	}

	getOrCreate(key: K): AtomNode {
		let entry: AtomNode | undefined = this.get(key);

		if (!entry) {
			if (isNonPrimitive(key)) {
				this.weakMap = this.weakMap ?? new WeakMap();

				entry = this.graph.createAtom();

				this.weakMap.set(key, entry);
			} else {
				this.map = this.map ?? new Map();

				entry = this.graph.createAtom();
				if (this.clearOnUnobserved) {
					const unsub = this.graph.onObservedStateChange(entry, (observing) => {
						if (!observing) {
							this.map?.delete(key);
							unsub();
						}
					});
				}

				this.map.set(key, entry);
			}
		}

		return entry;
	}

	reportObserved(key: K): void {
		if (this.graph.isTracking()) {
			this.getOrCreate(key).reportObserved();
		}
	}

	reportChanged(key: K): void {
		return this.get(key)?.reportChanged();
	}
}

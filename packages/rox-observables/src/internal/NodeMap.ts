import { Graph, AtomNode, SignalNode } from "./graph";
import { isNonPrimitive } from "./utils";

class NodeMap<
	K = unknown,
	GraphNode extends AtomNode | SignalNode<unknown> =
		| AtomNode
		| SignalNode<unknown>
> {
	private map: Map<unknown, GraphNode> | undefined;
	private weakMap: WeakMap<object, GraphNode> | undefined;
	private readonly clearOnUnobserved: boolean;
	protected readonly graph: Graph;

	constructor(graph: Graph, clearOnUnobserved: boolean = false) {
		this.graph = graph;
		this.clearOnUnobserved = clearOnUnobserved;
	}

	protected createNode(_initialValue?: unknown): GraphNode {
		return {} as GraphNode;
	}

	get(key: unknown): GraphNode | undefined {
		return isNonPrimitive(key) ? this.weakMap?.get(key) : this.map?.get(key);
	}

	delete(key: K): void {
		isNonPrimitive(key) ? this.weakMap?.delete(key) : this.map?.delete(key);
	}

	add(key: K, atom: GraphNode): void {
		isNonPrimitive(key)
			? this.weakMap?.set(key, atom)
			: this.map?.set(key, atom);
	}

	getOrCreate(key: K, value?: unknown): GraphNode {
		let entry: GraphNode | undefined = this.get(key);

		if (!entry) {
			if (isNonPrimitive(key)) {
				this.weakMap = this.weakMap ?? new WeakMap();

				entry = this.createNode(value);

				this.weakMap.set(key, entry);
			} else {
				this.map = this.map ?? new Map();

				entry = this.createNode(value);
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

	reportObserved(key: K, value?: unknown): void {
		if (this.graph.isTracking()) {
			this.getOrCreate(key, value).reportObserved();
		}
	}

	reportChanged(key: K, value?: unknown): void {
		return this.get(key)?.reportChanged(value);
	}
}

export class AtomMap<K = unknown> extends NodeMap<K, AtomNode> {
	protected createNode(): AtomNode {
		return this.graph.createAtom();
	}
}

export class SignalMap<K = unknown, V = unknown> extends NodeMap<
	K,
	SignalNode<V>
> {
	protected createNode(initialValue?: unknown): SignalNode<V> {
		return this.graph.createSignal(initialValue);
	}
}

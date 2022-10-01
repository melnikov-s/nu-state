import { isObserved, reportChanged, reportObserved } from "../graph";
import { Atom, ObserverNode, nodeTypes } from "../types";

export class AtomNode<T = unknown> implements Atom<T> {
	readonly nodeType = nodeTypes.atom;
	readonly observers: Set<ObserverNode> = new Set();

	constructor(private readonly comparator?: (a: T) => boolean) {}

	reportChanged(value?: T): void {
		if (isObserved(this)) {
			reportChanged(this, value);
		}
	}

	reportObserved(): boolean {
		reportObserved(this);

		return isObserved(this);
	}

	equals(value: T): boolean {
		return this.comparator ? this.comparator(value) : false;
	}
}

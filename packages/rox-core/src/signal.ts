import { AtomNode } from "./nodes/atom";
import { isObserved } from "./graph";
import { defaultEquals } from "./utils";

export class Signal<T> {
	value: T;
	atom: AtomNode<T>;
	comparator: typeof defaultEquals;

	constructor(value: T, comparator: typeof defaultEquals = defaultEquals) {
		this.value = value;
		this.comparator = comparator;
		this.atom = new AtomNode(this.equals.bind(this));
	}

	equals(value: T): boolean {
		return this.comparator(this.value, value);
	}

	get(): T {
		this.atom.reportObserved();

		return this.value;
	}

	set(newValue: T): T {
		if (this.value !== newValue) {
			// if no one is observing us and we can perform the write silently
			if (!isObserved(this.atom)) {
				this.value = newValue;
			} else {
				const oldValue = this.value;
				this.value = newValue;
				this.atom.reportChanged(oldValue);
			}
		}

		return this.value;
	}
}

import { AtomNode, Graph } from "./internal/graph";
import {
	getAdministration,
	getObservable,
	getSource,
	isObservable,
	throwObservablesOnSource,
} from "./internal/lookup";
import { Administration } from "./internal/Administration";
import { SignalMap } from "./internal/NodeMap";
import { resolveNode } from "./internal/utils";

export class ArrayAdministration<T> extends Administration<T[]> {
	valuesMap: SignalMap<number>;
	keysAtom: AtomNode;

	static proxyTraps: ProxyHandler<Array<unknown>> = {
		get(target, name) {
			const adm = getAdministration(target);
			if (name === "length") {
				return adm.getArrayLength();
			}

			if (typeof name === "number") {
				return adm.get(name);
			}

			if (typeof name === "string" && String(parseInt(name)) === name) {
				return adm.get(parseInt(name));
			}

			if (arrayMethods.hasOwnProperty(name)) {
				return arrayMethods[name as keyof typeof arrayMethods];
			}

			return adm.source[name];
		},

		set(target, name, value) {
			const adm = getAdministration(target);

			if (name === "length") {
				adm.setArrayLength(value as number);
			} else if (typeof name === "number") {
				adm.set(name, value);
			} else if (typeof name === "string" && String(parseInt(name)) === name) {
				adm.set(parseInt(name), value);
			} else {
				adm.source[name] = value;
			}

			return true;
		},
	};

	constructor(source: T[] = [], graph: Graph) {
		super(source, graph);
		this.valuesMap = new SignalMap(this.graph);
		this.keysAtom = graph.createAtom();

		if (process.env.NODE_ENV !== "production") {
			for (let i = 0; i < this.source.length; i++) {
				if (isObservable(this.source[i])) {
					throwObservablesOnSource();
				}
			}
		}
	}

	protected reportObserveDeep(): void {
		for (let i = 0; i < this.source.length; i++) {
			const value = this.source[i];
			if (value && typeof value === "object") {
				getAdministration(getObservable(value, this.graph))?.reportObserved();
			}
		}
	}

	getNode(key?: number): unknown {
		if (key == null) {
			return this.atom;
		}

		return resolveNode(this.valuesMap.getOrCreate(key, this.source[key]));
	}

	get(index: number): T | undefined {
		this.atom.reportObserved();
		this.valuesMap.reportObserved(index, this.source[index]);

		return getObservable(this.source[index], this.graph);
	}

	set(index: number, newValue: T): void {
		const values = this.source;
		const targetValue = getSource(newValue);

		if (index < values.length) {
			// update at index in range
			const oldValue = values[index];

			const changed = targetValue !== oldValue;
			if (changed) {
				values[index] = targetValue;
				this.onArrayChanged(false, index, 1);
			}
		} else if (index === values.length) {
			// add a new item
			this.spliceWithArray(index, 0, [newValue]);
		} else {
			// out of bounds
			throw new Error(
				`Index out of bounds, ${index} is larger than ${values.length}`
			);
		}
	}

	getArrayLength(): number {
		this.atom.reportObserved();
		this.keysAtom.reportObserved();
		return this.source.length;
	}

	setArrayLength(newLength: number): void {
		if (typeof newLength !== "number" || newLength < 0)
			throw new Error("Out of range: " + newLength);
		const currentLength = this.source.length;
		if (newLength === currentLength) return;
		else if (newLength > currentLength) {
			const newItems = new Array(newLength - currentLength);
			for (let i = 0; i < newLength - currentLength; i++)
				newItems[i] = undefined;
			this.spliceWithArray(currentLength, 0, newItems);
		} else this.spliceWithArray(newLength, currentLength - newLength);
	}

	spliceWithArray(index: number, deleteCount?: number, newItems?: T[]): T[] {
		const length = this.source.length;
		const newTargetItems: T[] = [];

		if (newItems) {
			for (let i = 0; i < newItems.length; i++) {
				newTargetItems[i] = getSource(newItems[i]);
			}
		}

		if (index === undefined) index = 0;
		else if (index > length) index = length;
		else if (index < 0) index = Math.max(0, length + index);

		if (arguments.length === 1) deleteCount = length - index;
		else if (deleteCount === undefined || deleteCount === null) deleteCount = 0;
		else deleteCount = Math.max(0, Math.min(deleteCount, length - index));

		const res = this.spliceItemsIntoValues(index, deleteCount, newTargetItems);

		if (deleteCount !== 0 || newTargetItems.length !== 0) {
			this.onArrayChanged(
				length !== this.source.length,
				index,
				Math.max(deleteCount ?? 0, newItems?.length ?? 0)
			);
		}

		return res;
	}

	spliceItemsIntoValues(
		index: number,
		deleteCount: number,
		newItems: T[]
	): T[] {
		return this.source.splice.apply(
			this.source,
			([index, deleteCount] as any).concat(newItems)
		);
	}

	onArrayChanged(lengthChanged = false, index?: number, count?: number): void {
		this.graph.batch(() => {
			if (lengthChanged) {
				this.keysAtom.reportChanged();
			}
			if (index == null) {
				this.atom.reportChanged();
			} else {
				for (let i = index; i < index + count!; i++) {
					this.valuesMap.reportChanged(i, this.source[i]);
				}
			}
			this.flushChange();
		});
	}
}

const arrayMethods: any = {
	fill<T>(
		this: T[],
		value: T,
		start?: number | undefined,
		end?: number | undefined
	): T[] {
		const adm = getAdministration(this);
		const oldLength = adm.source.length;
		adm.source.fill(value, start, end);
		adm.onArrayChanged(oldLength !== adm.source.length, start, end);

		return this;
	},

	splice<T>(
		this: T[],
		index: number,
		deleteCount?: number,
		...newItems: T[]
	): T[] {
		const adm = getAdministration(this);
		switch (arguments.length) {
			case 0:
				return [];
			case 1:
				return adm.spliceWithArray(index);
			case 2:
				return adm.spliceWithArray(index, deleteCount);
		}
		return adm.spliceWithArray(index, deleteCount, newItems);
	},

	push<T>(this: T[], ...items: T[]): number {
		const adm = getAdministration(this);
		adm.spliceWithArray(adm.source.length, 0, items);
		return adm.source.length;
	},

	pop<T>(this: T[]): T {
		return this.splice(
			Math.max(getAdministration(this).source.length - 1, 0),
			1
		)[0];
	},

	shift<T>(this: T[]): T {
		return this.splice(0, 1)[0];
	},

	unshift<T>(this: T[], ...items: T[]): number {
		const adm = getAdministration(this);
		adm.spliceWithArray(0, 0, items);
		return adm.source.length;
	},

	reverse<T>(this: T[]): T[] {
		const adm = getAdministration(this);

		adm.source.reverse();

		adm.onArrayChanged(false, 0, adm.source.length);

		return this;
	},

	sort<T>(this: T[], compareFn?: ((a: T, b: T) => number) | undefined): T[] {
		const adm = getAdministration(this);
		adm.onArrayChanged();

		adm.source.sort(
			compareFn &&
				((a, b) =>
					compareFn(getObservable(a, adm.graph), getObservable(b, adm.graph)))
		);

		return this;
	},
};

["join", "toString", "toLocaleString"].forEach((method) => {
	if (Array.prototype.hasOwnProperty(method)) {
		arrayMethods[method] = function (this: unknown[]): unknown {
			const adm = getAdministration(this);
			adm.reportObserved(false);
			const sourceArr = getSource(this);

			return sourceArr[method].apply(sourceArr, arguments);
		};
	}
});

["indexOf", "includes", "lastIndexOf"].forEach((method) => {
	if (Array.prototype.hasOwnProperty(method)) {
		arrayMethods[method] = function (this: unknown[]): unknown {
			const adm = getAdministration(this);
			adm.reportObserved(false);
			const source = getSource(arguments[0]);
			const sourceArr = getSource(this);
			const args = arguments.length === 1 ? [source] : [source, arguments[1]];

			return adm.source[method].apply(sourceArr, args);
		};
	}
});

["slice", "concat", "flat", "copyWithin"].forEach((method) => {
	if (Array.prototype.hasOwnProperty(method)) {
		arrayMethods[method] = function (this: unknown[]): unknown {
			const adm = getAdministration(this);
			adm.reportObserved(false);

			return getObservable(
				adm.source[method].apply(adm.source, arguments),
				adm.graph
			);
		};
	}
});

["every", "forEach", "map", "flatMap", "findIndex", "some"].forEach(
	(method) => {
		if (Array.prototype.hasOwnProperty(method)) {
			arrayMethods[method] = function (
				this: unknown[],
				callback: Function,
				thisArg: unknown
			): unknown {
				const adm = getAdministration(this);
				adm.reportObserved(false);

				return adm.source[method]((element: unknown, index: number) => {
					return callback.call(
						thisArg,
						element && typeof element === "object"
							? getObservable(element, adm.graph)
							: element,
						index,
						this
					);
				});
			};
		}
	}
);

["filter", "find"].forEach((method) => {
	if (Array.prototype.hasOwnProperty(method)) {
		arrayMethods[method] = function (
			this: unknown[],
			callback: Function,
			thisArg: unknown
		): unknown {
			const adm = getAdministration(this);
			adm.reportObserved(false);

			return getObservable(
				adm.source[method]((element: unknown, index: number) => {
					return callback.call(
						thisArg,
						element && typeof element === "object"
							? getObservable(element, adm.graph)
							: element,
						index,
						this
					);
				}),
				adm.graph
			);
		};
	}
});

["reduce", "reduceRight"].forEach((method) => {
	if (Array.prototype.hasOwnProperty(method)) {
		arrayMethods[method] = function (this: unknown[]): unknown {
			const adm = getAdministration(this);
			adm.reportObserved(false);

			const callback = arguments[0];
			arguments[0] = (
				accumulator: unknown,
				currentValue: unknown,
				index: number
			) => {
				return callback(
					accumulator,
					getObservable(currentValue, adm.graph),
					index,
					this
				);
			};
			return adm.source[method].apply(adm.source, arguments);
		};
	}
});

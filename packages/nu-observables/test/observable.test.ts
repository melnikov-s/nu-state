import {
	getInternalNode,
	getObservable,
	getObservableClassInstance,
	ObjectAdministration,
	CollectionAdministration,
	ArrayAdministration,
	setAdministrationType,
	getTestGraph,
} from "nu-observables";

import {
	observable,
	effect,
	source,
	reportObserved,
	reportChanged,
} from "./utils";

test("reportObserved returns observable", () => {
	const o = observable({});
	expect(reportObserved(o)).toBe(o);
});

test("reportObserved on object", () => {
	const o = observable({ value: 1, newV: { value: 1 } });
	let count = 0;
	effect(() => {
		reportObserved(o);
		count++;
	});

	o.newV;

	o.value = o.value;
	expect(count).toBe(1);
	o.value++;
	expect(count).toBe(2);
});

test("reportObserved on array", () => {
	const o = observable([1, 2, 3]);
	let count = 0;
	effect(() => {
		reportObserved(o);
		count++;
	});

	o[0] = o[0];
	expect(count).toBe(1);
	o.push(4);
	expect(count).toBe(2);
	o.reverse();
	expect(count).toBe(3);
	o.fill(0, 1, 3);
	expect(count).toBe(4);
});

test("reportObserved on map", () => {
	const o = observable(new Map([[1, 1]]));
	let count = 0;
	effect(() => {
		reportObserved(o);
		count++;
	});

	o.set(1, 1);
	expect(count).toBe(1);
	o.set(2, 1);
	expect(count).toBe(2);
});

test("reportObserved on set", () => {
	const o = observable(new Set([1, 2, 3]));
	let count = 0;
	effect(() => {
		reportObserved(o);
		count++;
	});

	o.add(1);
	expect(count).toBe(1);
	o.add(4);
	expect(count).toBe(2);
	o.delete(2);
	expect(count).toBe(3);
});

test("reportObserved on object (deep)", () => {
	const ob = observable({ value: 1 });
	const o = observable({
		value: {
			innerValue: 1,
			get double() {
				return ob.value * 2;
			},
			undef: undefined,
		},
	});
	let count = 0;
	effect(() => {
		reportObserved(o, { deep: true });
		count++;
	});

	o.value.innerValue = o.value.innerValue;
	expect(count).toBe(1);
	o.value.innerValue++;
	expect(count).toBe(2);
	ob.value = 2;
	expect(count).toBe(2);
	const value = o.value;
	delete o.value;
	expect(count).toBe(3);
	value.innerValue++;
	expect(count).toBe(3);
});

test("reportObserved on object (not deep)", () => {
	const o = observable({
		value: {
			innerValue: 1,
		},
	});
	let count = 0;
	effect(() => {
		reportObserved(o);
		count++;
	});

	o.value.innerValue++;
	expect(count).toBe(1);
	o.value = { innerValue: 2 };
	expect(count).toBe(2);
});

test("reportObserved on object (deep + circular ref)", () => {
	const ref = { value: 1, ref: null };
	const o = observable({
		value: {
			ref,
			innerValue: 1,
		},
	});
	observable(ref).ref = o.value;

	let count = 0;
	effect(() => {
		reportObserved(o, { deep: true });
		count++;
	});

	o.value.innerValue = o.value.innerValue;
	expect(count).toBe(1);
	o.value.innerValue++;
	expect(count).toBe(2);
});

test("reportObserved on map (deep)", () => {
	const refA = observable({ value: 1 });
	const refB = observable({ value: 1 });
	const o = observable(
		new Map([
			[1, source(refA)],
			[2, source(refB)],
		])
	);
	let count = 0;
	effect(() => {
		reportObserved(o, { deep: true });
		count++;
	});

	refA.value++;
	expect(count).toBe(2);
	refB.value++;
	expect(count).toBe(3);
	o.delete(2);
	expect(count).toBe(4);
	refB.value++;
	expect(count).toBe(4);
});

test("reportObserved on set (deep)", () => {
	const refA = observable({ value: 1 });
	const refB = observable({ value: 1 });
	const o = observable(new Set([refA, refB].map(source)));
	let count = 0;
	effect(() => {
		reportObserved(o, { deep: true });
		count++;
	});

	refA.value++;
	expect(count).toBe(2);
	refB.value++;
	expect(count).toBe(3);
	o.delete(refA);
	expect(count).toBe(4);
	refA.value++;
	expect(count).toBe(4);
});

test("reportObserved on array (deep)", () => {
	const refA = observable({ value: 1 });
	const refB = observable({ value: 1 });
	const o = observable([refA, refB].map(source));
	let count = 0;
	effect(() => {
		reportObserved(o, { deep: true });
		count++;
	});

	refA.value++;
	expect(count).toBe(2);
	refB.value++;
	expect(count).toBe(3);
	o.pop();
	expect(count).toBe(4);
	refB.value++;
	expect(count).toBe(4);
});

test("reportChanged on object", () => {
	const o = observable({ value: 1 });
	let count = 0;
	effect(() => {
		o.value;
		count++;
	});

	reportChanged(o);
	expect(count).toBe(2);
});

test("reportChanged on array", () => {
	const o = observable([1, 2, 3]);
	let count = 0;
	effect(() => {
		o.length;
		count++;
	});

	reportChanged(o);
	expect(count).toBe(2);
});

test("reportChanged on map", () => {
	const o = observable(new Map());
	let count = 0;
	effect(() => {
		o.has(1);
		count++;
	});

	reportChanged(o);
	expect(count).toBe(2);
});

test("reportChanged on set", () => {
	const o = observable(new Set());
	let count = 0;
	effect(() => {
		o.has(1);
		count++;
	});

	reportChanged(o);
	expect(count).toBe(2);
});

test("can set a custom administration for object", () => {
	let count = 0;
	class CustomObjectAdministration<
		T extends object
	> extends ObjectAdministration<T> {
		static proxyTraps: ProxyHandler<object> = {
			...ObjectAdministration.proxyTraps,
			get(...args) {
				count++;
				return ObjectAdministration.proxyTraps.get(...args);
			},
		};
	}

	const newGraph = { ...getTestGraph() };

	setAdministrationType({ object: CustomObjectAdministration }, newGraph);

	const oA = getObservable({ value: 0 }, getTestGraph());
	oA.value;
	expect(count).toBe(0);
	const oB = getObservable({ value: { value: 0 } }, newGraph);
	const inner = oB.value;
	expect(count).toBe(1);
	inner.value;
	expect(count).toBe(2);
});

test("can set a custom administration for class", () => {
	let ran = false;
	class CustomObjectAdministration<
		T extends object
	> extends ObjectAdministration<T> {
		static proxyTraps: ProxyHandler<object> = {
			...ObjectAdministration.proxyTraps,
			get(...args) {
				ran = true;
				return ObjectAdministration.proxyTraps.get(...args);
			},
		};
	}

	const newGraph = { ...getTestGraph() };
	setAdministrationType({ object: CustomObjectAdministration }, newGraph);

	class Observable {
		value = 0;

		constructor() {
			return getObservableClassInstance(this, newGraph);
		}
	}

	const o = new Observable();
	o.value;
	expect(ran).toBe(true);
});

test("can set a custom administration for array", () => {
	let ran = false;
	class CustomArrayAdministration<T> extends ArrayAdministration<T> {
		static proxyTraps: ProxyHandler<Array<any>> = {
			...ObjectAdministration.proxyTraps,
			get(...args) {
				ran = true;
				return ArrayAdministration.proxyTraps.get(...args);
			},
		};
	}

	const newGraph = { ...getTestGraph() };

	setAdministrationType({ array: CustomArrayAdministration }, newGraph);

	const oA = getObservable([0], getTestGraph());
	oA[0];
	expect(ran).toBe(false);
	const oB = getObservable([0], newGraph);
	oB[0];
	expect(ran).toBe(true);
});

test("can set a custom administration for collection", () => {
	let ran = false;
	class CustomCollectionAdministration extends CollectionAdministration<any> {
		static proxyTraps: ProxyHandler<Map<any, any>> = {
			...ObjectAdministration.proxyTraps,
			get(...args) {
				ran = true;
				return CollectionAdministration.proxyTraps.get(...args);
			},
		};
	}

	const newGraph = { ...getTestGraph() };

	setAdministrationType(
		{ collection: CustomCollectionAdministration },
		newGraph
	);

	const oA = getObservable(new Map(), getTestGraph());
	oA.has(0);
	expect(ran).toBe(false);
	const oB = getObservable(new Map(), newGraph);
	oB.has(0);
	expect(ran).toBe(true);
});

test("prevent setting administration types multiple times on the same graph", () => {
	const newGraph = { ...getTestGraph() };
	setAdministrationType({}, newGraph);
	expect(() => setAdministrationType({}, newGraph)).toThrowError(
		"Administration type already set for this graph"
	);
});

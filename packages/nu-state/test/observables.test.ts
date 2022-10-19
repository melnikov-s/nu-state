import { getAdministration, getInternalNode } from "nu-observables";
import { effect, observable } from "../src";

test("[mobx-test] cleanup", function () {
	const x = observable(new Map(Object.entries({ a: 1 })));

	let aValue;
	const disposer = effect(function () {
		aValue = x.get("a");
	});

	const adm = getAdministration(x);

	let observableNode = (adm as any).valuesMap.get("a");

	expect(aValue).toBe(1);
	expect(observableNode.observers.size).toBe(1);
	expect((adm.hasMap.get("a") as any).observers.size).toBe(1);

	expect(x.delete("a")).toBe(true);
	expect(x.delete("not-existing")).toBe(false);

	expect(aValue).toBe(undefined);
	expect(observableNode.observers.size).toBe(0);
	expect((adm.hasMap.get("a") as any).observers.size).toBe(1);

	x.set("a", 2);
	observableNode = (adm as any).valuesMap.get("a");

	expect(aValue).toBe(2);
	expect(observableNode.observers.size).toBe(1);
	expect((adm.hasMap.get("a") as any).observers.size).toBe(1);

	disposer();
	expect(aValue).toBe(2);
	expect(observableNode.observers.size).toBe(0);
	expect((adm.hasMap as any).map.has("a")).toBe(false);
});

test("get node from observable object", () => {
	const o = observable({ value: 0 });
	let count = 0;

	effect(() => {
		Object.keys(o);
		count++;
	});

	const node = getInternalNode(o);

	node.reportChanged();
	expect(count).toBe(2);
});

test("get key node from observable object", () => {
	const o = observable({ value: 0 });
	let count = 0;

	effect(() => {
		o.value;
		count++;
	});

	const node = getInternalNode(o, "value");

	node.reportChanged();
	expect(count).toBe(2);
});

test("get key computed node from observable object", () => {
	const o = observable({
		value: 1,
		get double() {
			return o.value * 2;
		},
	});

	const node = getInternalNode(o, "double");

	expect(node.get()).toBe(2);
});

test("get node from observable array", () => {
	const o = observable([1, 2, 3]);
	let count = 0;

	effect(() => {
		o.length;
		count++;
	});

	const node = getInternalNode(o);

	node.reportChanged();
	expect(count).toBe(2);
});

test("get index node from observable array", () => {
	const o = observable([1, 2, 3]);
	let count = 0;

	effect(() => {
		o[0];
		count++;
	});

	let node = getInternalNode(o, 1);

	node.reportChanged();
	expect(count).toBe(1);

	node = getInternalNode(o, 0);
	node.reportChanged();
	expect(count).toBe(2);
});

test("get node from observable collection", () => {
	const o = observable(new Set([1, 2, 3]));
	let count = 0;

	effect(() => {
		o.size;
		count++;
	});

	const node = getInternalNode(o);

	node.reportChanged();
	expect(count).toBe(2);
});

test("get index node from observable collection", () => {
	const o = observable(
		new Map([
			[0, 0],
			[1, 1],
		])
	);
	let count = 0;

	effect(() => {
		o.get(0);
		count++;
	});

	let node = getInternalNode(o, 1);

	node.reportChanged();
	expect(count).toBe(1);

	node = getInternalNode(o, 0);
	node.reportChanged();
	expect(count).toBe(2);
});

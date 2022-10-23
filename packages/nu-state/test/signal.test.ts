import { effect, reaction, computed, signal } from "../src";

test("can read observable box value", () => {
	const [getA] = signal(1);
	expect(getA()).toBe(1);
});

test("can set an observable box value", () => {
	const [getA, setA] = signal(0);
	setA(1);
	expect(getA()).toBe(1);
});

test("can react to an observable change", () => {
	const [getA, setA] = signal(0);
	let count = 0;
	reaction(
		() => getA(),
		() => count++
	);
	expect(count).toBe(0);
	setA(1);
	expect(count).toBe(1);
});

test("does not trigger a reaction for same value", () => {
	const value = {};
	const [getA, setA] = signal(value);
	let count = 0;
	reaction(
		() => getA(),
		() => count++
	);
	setA(value);
	expect(count).toBe(0);
	setA({});
	expect(count).toBe(1);
});

test("accepts a comparator function", () => {
	let countEquals = 0;
	let countReaction = 0;

	const equals = (a, b) => {
		countEquals++;
		return a.prop === b.prop;
	};

	const [get, set] = signal({ prop: 0 }, { equals });
	expect(countEquals).toBe(0);

	effect(() => {
		get();
		countReaction++;
	});

	expect(countEquals).toBe(0);
	expect(countReaction).toBe(1);
	set({ prop: 0 });
	expect(countEquals).toBe(1);
	expect(countReaction).toBe(1);
	set({ prop: 1 });
	expect(countEquals).toBe(2);
	expect(countReaction).toBe(2);
});

test("[mobx-test] nested observables", () => {
	const [factor, setFactor] = signal(0);
	const [price, setPrice] = signal(100);
	let totalCalcs = 0;
	let innerCalcs = 0;

	const total = computed(function () {
		totalCalcs += 1; // outer observable shouldn't recalc if inner observable didn't publish a real change
		return (
			price() *
			computed(function () {
				innerCalcs += 1;
				return factor() % 2 === 0 ? 1 : 3;
			})()
		);
	});

	const b = [];

	effect(() => b.push(total()));

	setPrice(150);
	setFactor(7); // triggers innerCalc twice, because changing the outcome triggers the outer calculation which recreates the inner calculation
	setFactor(5); // doesn't trigger outer calc
	setFactor(3); // doesn't trigger outer calc
	setFactor(4); // triggers innerCalc twice
	setPrice(20);

	expect(b).toEqual([100, 150, 450, 150, 20]);
	expect(innerCalcs).toBe(9);
	expect(totalCalcs).toBe(5);
});

test("[mobx-test] multiple view dependencies", function () {
	let bCalcs = 0;
	let dCalcs = 0;
	const [getA] = signal(1);
	const b = computed(function () {
		bCalcs++;
		return 2 * getA();
	});
	const [getD, setD] = signal(2);
	const d = computed(function () {
		dCalcs++;
		return 3 * getD();
	});

	let zwitch = true;
	const buffer = [];
	let fCalcs = 0;
	const dis = effect(function () {
		fCalcs++;
		if (zwitch) buffer.push(b() + d());
		else buffer.push(d() + b());
	});

	zwitch = false;
	setD(3);
	expect(bCalcs).toBe(1);
	expect(dCalcs).toBe(2);
	expect(fCalcs).toBe(2);
	expect(buffer).toEqual([8, 11]);

	setD(4);
	expect(bCalcs).toBe(1);
	expect(dCalcs).toBe(3);
	expect(fCalcs).toBe(3);
	expect(buffer).toEqual([8, 11, 14]);

	dis();
	setD(5);
	expect(bCalcs).toBe(1);
	expect(dCalcs).toBe(3);
	expect(fCalcs).toBe(3);
	expect(buffer).toEqual([8, 11, 14]);
});

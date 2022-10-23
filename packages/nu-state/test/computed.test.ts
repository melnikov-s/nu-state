import {
	observable,
	reaction,
	runInAction,
	effect,
	computed,
	isObserved,
	onObservedStateChange,
	signal,
	getInternalComputedNode,
} from "../src";

test("can return a computed value", () => {
	const [get] = signal(1);
	const c = computed(() => get() * 2);
	expect(c()).toEqual(2);
});

test("can update automatically", () => {
	const [get, set] = signal(1);
	const c = computed(() => get() * 2);
	set(10);
	expect(c()).toEqual(20);
	set(1);
	expect(c()).toEqual(2);
});

test("will run each time when not listened to", () => {
	let count = 0;
	const [get] = signal(1);
	const c = computed(() => {
		count++;
		return get();
	});
	expect(count).toBe(0);
	c();
	expect(count).toBe(1);
	c();
	expect(count).toBe(2);
	c();
	expect(count).toBe(3);
});

test("will only used cached value when listened to", () => {
	let count = 0;
	const [get] = signal(1);
	const c = computed(() => {
		count++;
		return get();
	});
	const u = reaction(
		() => c(),
		() => {}
	);

	expect(count).toBe(1);
	c();
	expect(count).toBe(1);
	c();
	expect(count).toBe(1);

	u();
	c();
	expect(count).toBe(2);
});

test("will only used cached value when listened to (deep)", () => {
	let count = 0;
	const [get] = signal(1);
	const c1 = computed(() => {
		count++;
		return get();
	});
	const c2 = computed(() => {
		return c1();
	});

	const u = reaction(
		() => c2(),
		() => {}
	);

	expect(count).toBe(1);
	c1();
	expect(count).toBe(1);
	c1();
	expect(count).toBe(1);

	u();
	c1();
	expect(count).toBe(2);
});

test("will clear cached value when there are no listeners", () => {
	let countC = 0;
	let countA = 0;

	const [get, set] = signal(1);
	const c = computed(() => {
		countC++;
		return get();
	});

	let u = effect(() => c());
	expect(countC).toBe(1);
	const u2 = effect(() => c());
	c();
	expect(countC).toBe(1);
	u2();
	u();
	u = effect(() => {
		c();
		countA++;
	});
	expect(countC).toBe(2);
	expect(countA).toBe(1);

	set(2);
	expect(countC).toBe(3);
	expect(countA).toBe(2);
	c();
	expect(countC).toBe(3);
});

test("will not trigger reaction on same value", () => {
	let countC = 0;
	let countR = 0;
	const [get1, set1] = signal(1);
	const [get2, set2] = signal(0);

	const c = computed(() => {
		countC++;
		return get1() * 0 + get2();
	});
	reaction(
		() => c(),
		() => countR++
	);

	expect(countC).toBe(1);
	set1(2);
	expect(countC).toBe(2);
	expect(countR).toBe(0);
	set2(1);
	expect(countC).toBe(3);
	expect(countR).toBe(1);
});

test("will not allow changing observable values within a computed", () => {
	const [get1] = signal(0);
	const [get2, set2] = signal(1);
	const c1 = computed(() => {
		set2(3);
		return get1();
	});

	reaction(
		() => get2(),
		() => {}
	);
	expect(() =>
		reaction(
			() => c1(),
			() => {}
		)
	).toThrowError();
});

test("observable values only observed by the computed can change", () => {
	const c1 = computed(() => {
		const [get1, set1] = signal(0);
		get1();
		set1(1);
		return get1();
	});

	expect(() =>
		reaction(
			() => c1(),
			() => {}
		)
	).not.toThrow();
});

test("will allow creating new observable values within a computed", () => {
	const [get1] = signal(0);
	let get2, set2;
	const c = computed(() => {
		[get2, set2] = signal(0);
		set2(3);
		return get1();
	});
	expect(() =>
		reaction(
			() => c() + get2() + c(),
			() => {}
		)
	).not.toThrow();
});

test("will not react to observables created within the same computed", () => {
	let count = 0;
	const [get1] = signal(2);
	let get2, set2;
	const c = computed(() => {
		[get2, set2] = signal(3);
		set2(5);
		count++;
		return get1() * 2 * get2();
	});

	effect(() => c());

	expect(count).toBe(1);
	expect(c()).toBe(20);
	expect(count).toBe(1);
	set2(10);
	expect(count).toBe(2);
});

test("will throw if an observable created within a computed is re-used", () => {
	let count = 0;
	const [get1, set1] = signal(2);
	let get2, set2;
	const c = computed(() => {
		[get2, set2] = get2 ? [get2, set2] : signal(3);
		set2(5);
		count++;
		return get1() * 2 * get2();
	});

	effect(() => c());

	expect(count).toBe(1);

	runInAction(() => {
		set1(3);
		set1(2);
	});

	expect(count).toBe(1);

	expect(() => set2(10)).toThrowErrorMatchingInlineSnapshot(
		`"Can't change an observable during a reaction or within a computed"`
	);
});

test("can use an observable that was created in another computed", () => {
	let count = 0;
	let result = 0;
	const [get1] = signal(2);
	let get2, set2;
	const c1 = computed(() => {
		[get2, set2] = signal(3);

		const v = get2();
		return get1() * 2 * v;
	});

	const c2 = computed(() => {
		count++;
		return get2();
	});

	effect(() => (result = c1() + c2()));
	expect(count).toBe(1);

	expect(result).toBe(15);

	set2(10);
	expect(count).toBe(2);

	expect(result).toBe(15);
});

test("can change what it is observing mid-action", () => {
	let count = 0;
	const [get1, set1] = signal(true);
	const [get2, set2] = signal(0);
	const [get3, set3] = signal(1);

	const c = computed(() => {
		count++;
		return get1() ? get2() : get3();
	});

	effect(() => c());
	expect(count).toBe(1);
	expect(c()).toBe(0);
	expect(count).toBe(1);
	set2(-1);
	expect(count).toBe(2);
	set3(2);
	expect(count).toBe(2);
	expect(c()).toBe(-1);
	set1(false);
	expect(count).toBe(3);
	set2(-2);
	expect(count).toBe(3);
	set3(3);
	expect(count).toBe(4);
});

test("will clean up computed no longer in use", () => {
	let count1 = 0;
	let count2 = 0;
	const [get1, set1] = signal(true);
	const [get2] = signal(1);
	const c0 = computed(() => {
		count2++;
		get2();
	});
	const c1 = computed(() => {
		count1++;
		return c0();
	});
	const c2 = computed(() => get2());

	effect(() => (get1() ? c1() : c2()));
	expect(count1).toBe(1);
	expect(count2).toBe(1);
	c1();
	expect(count1).toBe(1);
	expect(count2).toBe(1);
	set1(false);
	expect(count1).toBe(1);
	expect(count2).toBe(1);
	c1();
	expect(count1).toBe(2);
	expect(count2).toBe(2);
});

test("will not run when an action produces a no-op", () => {
	let count = 0;
	const [get1, set1] = signal(1);
	const [get2, set2] = signal(2);
	const c = computed(() => {
		count++;
		return get1() + get2();
	});
	effect(() => c());
	expect(count).toBe(1);
	runInAction(() => {
		set1(0);
		set2(0);
		set1(1);
		set2(2);
	});
	expect(count).toBe(1);
	expect(c()).toBe(3);
	expect(count).toBe(1);
});

test("will update after an action that changes an observer and no-ops another", () => {
	let count1 = 0;
	let count2 = 0;
	const [get1, set1] = signal(1);
	const [get2, set2] = signal(2);
	const c1 = computed(() => {
		count1++;
		return get1() + get2();
	});
	const c2 = computed(() => {
		count2++;
		return c1() + get1();
	});

	effect(() => c2());
	expect(count1).toBe(1);
	expect(count2).toBe(1);

	runInAction(() => {
		set2(0);
		set1(0);
		set1(1);
	});

	expect(count1).toBe(2);
	expect(count2).toBe(2);
	expect(c2()).toBe(2);
	expect(c1()).toBe(1);
	expect(count1).toBe(2);
	expect(count2).toBe(2);
});

test("will observe sibling computed values", () => {
	const [get, set] = signal(1);
	const observables: any[] = [get];
	for (let i = 0; i < 10; i++) {
		observables.push(
			computed(function () {
				return observables[i]() + 1;
			})
		);
	}

	const last = observables[observables.length - 1];
	reaction(
		() => last(),
		() => {}
	);
	expect(last()).toBe(11);

	set(2);
	expect(last()).toBe(12);
});

test("will cache values mid action", () => {
	let count1 = 0;
	let count2 = 0;
	let count3 = 0;
	const [get1, set1] = signal(1);
	const [get2, set2] = signal(2);
	const c1 = computed(() => {
		count1++;
		return get1() + get2();
	});
	const c2 = computed(() => {
		count2++;
		return c1() + get1();
	});

	const c3 = computed(() => {
		count3++;
		return get2();
	});

	effect(() => c2() + c3());
	expect(count1).toBe(1);
	expect(count2).toBe(1);
	expect(count3).toBe(1);

	runInAction(() => {
		set2(0);
		expect(c2()).toBe(2);
		expect(c2()).toBe(2);
		expect(count1).toBe(2);
		expect(count2).toBe(2);
		expect(count3).toBe(1);
		expect(c3()).toBe(0);
		expect(c3()).toBe(0);
		expect(count3).toBe(2);
		set1(0);
		expect(c3()).toBe(0);
		expect(count3).toBe(2);
		expect(c2()).toBe(0);
		expect(c2()).toBe(0);
		expect(count1).toBe(3);
		expect(count2).toBe(3);
		set1(1);
	});

	expect(count1).toBe(4);
	expect(count2).toBe(4);
	expect(count3).toBe(2);

	expect(c1()).toBe(1);
	expect(c2()).toBe(2);
	expect(c3()).toBe(0);
});

test("will detect a cycle", () => {
	const [get] = signal(1);
	const c1 = computed(() => get() + c2());
	const c2 = computed(() => get() + c1());

	expect(() => c1()).toThrow(/cycle detected/);
});

test("can recover from computed error", () => {
	const [get1, set1] = signal(true);
	const [get2] = signal(2);
	const c1 = computed(() => {
		if (get1()) {
			throw new Error("oops");
		} else {
			return get2();
		}
	});

	expect(() => effect(() => c1())).toThrowError();
	set1(false);
	expect(c1()).toBe(2);
});

test("can create a computed inside of a computed", () => {
	let count = 0;
	let get2, set2;
	let c2;
	let val;
	const [get1, set1] = signal(1);
	const c = computed(() => {
		[get2, set2] = signal(5);
		c2 = computed(() => get2());
		set2(10);
		return get1() + c2();
	});

	effect(() => {
		count++;
		val = c() + c2();
	});

	expect(count).toBe(1);
	expect(val).toBe(21);
	set2(20);
	expect(c2()).toBe(10);
	expect(val).toBe(21);
	set1(5);
	expect(val).toBe(25);
	expect(count).toBe(3);
});

test("non observed computed will cache values while it's being evaluated", () => {
	let count = 0;
	const [get] = signal(0);
	const c1 = computed(() => {
		count++;
		return get();
	});
	const c2 = computed(() => c1() + c1());
	const c3 = computed(() => c2() + c2());

	c3();
	expect(count).toBe(1);
});

test("non observed will become dirty after it's evaluated", () => {
	const [get] = signal(0);
	const c1 = computed(() => {
		return get();
	});
	const c2 = computed(() => c1() + c1());
	const c3 = computed(() => c2() + c2());
	const c1Internal = getInternalComputedNode(c1);
	const c2Internal = getInternalComputedNode(c2);
	const c3Internal = getInternalComputedNode(c3);

	c3();
	expect(c1Internal.isDirty()).toBe(true);
	expect(c2Internal.isDirty()).toBe(true);
	expect(c3Internal.isDirty()).toBe(true);

	effect(() => c2());
	expect(c1Internal.isDirty()).toBe(false);
	expect(c2Internal.isDirty()).toBe(false);
	expect(c3Internal.isDirty()).toBe(true);
});

test("computed is keptAlive even if not observed", () => {
	let count = 0;
	const [get, set] = signal(1);
	const c = computed(
		() => {
			count++;
			return get() * 2;
		},
		{ keepAlive: true }
	);

	expect(c()).toBe(2);
	expect(count).toBe(1);
	expect(c()).toBe(2);
	expect(count).toBe(1);
	set(10);
	expect(c()).toBe(20);
	expect(count).toBe(2);
});

test("keepAlive computed evaluates lazily", () => {
	let count = 0;
	const [get, set] = signal(1);
	const c = computed(
		() => {
			count++;
			return get() * 2;
		},
		{ keepAlive: true }
	);

	expect(count).toBe(0);
	set(10);
	expect(count).toBe(0);
	expect(c()).toBe(20);
	expect(count).toBe(1);
});

test("keep alive does not become unobserved", () => {
	let count = 0;
	const [get, set] = signal(1);
	const c1 = computed(
		() => {
			count++;
			return get() * 2;
		},
		{ keepAlive: true }
	);
	const c2 = computed(() => get() === 1 && c1());
	const c1Internal = getInternalComputedNode(c1);
	const c2Internal = getInternalComputedNode(c2);

	expect(c1Internal.isDirty()).toBe(true);
	c2();
	expect(count).toBe(1);
	expect(c2Internal.isDirty()).toBe(true);
	expect(c1Internal.isDirty()).toBe(false);

	set(2);
	expect(c1Internal.isDirty()).toBe(true);
	expect(c2()).toBe(false);
	expect(count).toBe(1);
	expect(c1Internal.isDirty()).toBe(true);
	set(1);
	expect(count).toBe(1);
	effect(() => c2());
	expect(count).toBe(2);
	set(2);
	expect(count).toBe(2);
	expect(c2()).toBe(false);
	expect(c1Internal.isDirty()).toBe(true);
	expect(count).toBe(2);
	set(1);
	expect(count).toBe(3);
	expect(c1Internal.isDirty()).toBe(false);
});

test("can unobserve a keepAlive computed manually", () => {
	let count = 0;
	const [get] = signal(1);
	const c1 = computed(
		() => {
			count++;
			return get() * 2;
		},
		{ keepAlive: true }
	);

	const c1Internal = getInternalComputedNode(c1);

	c1();
	expect(c1Internal.isDirty()).toBe(false);
	c1();
	expect(count).toBe(1);
	c1Internal.setKeepAlive(false);
	expect(c1Internal.isDirty()).toBe(true);
	c1Internal.setKeepAlive(true);
	expect(c1()).toBe(2);
	expect(c1Internal.isDirty()).toBe(false);
});

test("can provide a custom equals function", () => {
	let countA = 0;
	let countB = 0;
	let countC = 0;
	const [get, set] = signal({ prop: 0 });
	const c = computed(
		() => {
			countA++;
			return get();
		},
		{
			equals: (a: any, b: any) => {
				countB++;
				return a.prop === b.prop;
			},
		}
	);
	effect(() => {
		countC++;
		return c();
	});
	expect(countA).toBe(1);
	expect(countB).toBe(0);
	expect(countC).toBe(1);
	set({ prop: 1 });
	expect(countA).toBe(2);
	expect(countB).toBe(1);
	expect(countC).toBe(2);
	set({ prop: 2 });
	expect(countA).toBe(3);
	expect(countB).toBe(2);
	expect(countC).toBe(3);
	set({ prop: 2 });
	expect(countA).toBe(4);
	expect(countB).toBe(3);
	expect(countC).toBe(3);
	set({ prop: 1 });
	expect(countA).toBe(5);
	expect(countB).toBe(4);
	expect(countC).toBe(4);
});

test("correctly marks computed as potentially stale", () => {
	const [get, set] = signal(1);
	const c1 = computed(() => get() * 1);
	const c2 = computed(() => get() * 2);
	const c3 = computed(() => get() * 2);
	const c4 = computed(() => c2() + c3());
	const c5 = computed(() => c4());

	let result: number;

	effect(() => (result = c1() + c5()));

	expect(result).toBe(5);
	set(2);
	expect(result).toBe(10);
});

test("sets the context of the executing computed", () => {
	const context = {};
	const c = computed(
		function () {
			expect(this).toBe(context);
			return 1;
		},
		{ context }
	);

	expect(c()).toBe(1);
});

test("can change keepAlive once computed has been created", () => {
	let onBecomeUnobservedCount = 0;
	let onBecomeObservedCount = 0;
	const o = observable({ value: 1 });

	onObservedStateChange(o, (observing) => {
		if (observing) {
			onBecomeObservedCount++;
		} else {
			onBecomeUnobservedCount++;
		}
	});
	const c = computed(() => o.value, { keepAlive: true });

	expect(onBecomeObservedCount).toBe(0);
	expect(onBecomeUnobservedCount).toBe(0);

	c();
	expect(onBecomeObservedCount).toBe(1);
	expect(onBecomeUnobservedCount).toBe(0);

	const cInternal = getInternalComputedNode(c);

	expect(cInternal.isDirty()).toBe(false);
	expect(isObserved(o)).toBe(true);
	cInternal.setKeepAlive(false);
	expect(onBecomeObservedCount).toBe(1);
	expect(onBecomeUnobservedCount).toBe(1);
	expect(cInternal.isDirty()).toBe(true);
	expect(isObserved(o)).toBe(false);
	c();
	expect(cInternal.isDirty()).toBe(true);
	cInternal.setKeepAlive(true);
	expect(cInternal.isDirty()).toBe(true);
	c();
	expect(cInternal.isDirty()).toBe(false);
	expect(isObserved(o)).toBe(true);
});

test("can manually clear computed cached value", () => {
	let count = 0;
	const o = observable({ value: 1 });
	const c = computed(() => {
		count++;
		return o.value * 2;
	});

	effect(() => {
		c();
	});

	expect(count).toBe(1);
	o.value++;
	expect(count).toBe(2);
	c();
	c();
	expect(count).toBe(2);
	getInternalComputedNode(c).clear();
	c();
	expect(count).toBe(3);
});

test("[mobx-test] computed values believe NaN === NaN", () => {
	const [getA, setA] = signal(2);
	const [getB, setB] = signal(3);
	const c = computed(function () {
		return getA() * getB();
	});
	const buf = [];
	reaction(
		() => c(),
		(v) => buf.push(v)
	);

	setA(NaN);
	setB(NaN);
	setA(NaN);
	setA(2);
	setB(3);

	expect(buf).toEqual([NaN, 6]);
});

test("[mobx-test] lazy evaluation", function () {
	let bCalcs = 0;
	let cCalcs = 0;
	let dCalcs = 0;
	let observerChanges = 0;

	const [getA, setA] = signal(1);
	const b = computed(function () {
		bCalcs += 1;
		return getA() + 1;
	});

	const c = computed(function () {
		cCalcs += 1;
		return b() + 1;
	});

	expect(bCalcs).toBe(0);
	expect(cCalcs).toBe(0);
	expect(c()).toBe(3);
	expect(bCalcs).toBe(1);
	expect(cCalcs).toBe(1);

	expect(c()).toBe(3);
	expect(bCalcs).toBe(2);
	expect(cCalcs).toBe(2);

	setA(2);
	expect(bCalcs).toBe(2);
	expect(cCalcs).toBe(2);

	expect(c()).toBe(4);
	expect(bCalcs).toBe(3);
	expect(cCalcs).toBe(3);

	const d = computed(function () {
		dCalcs += 1;
		return b() * 2;
	});

	const handle = reaction(
		() => d(),
		function () {
			observerChanges += 1;
		}
	);
	expect(bCalcs).toBe(4);
	expect(cCalcs).toBe(3);
	expect(dCalcs).toBe(1); // d is evaluated, so that its dependencies are known

	setA(3);
	expect(d()).toBe(8);
	expect(bCalcs).toBe(5);
	expect(cCalcs).toBe(3);
	expect(dCalcs).toBe(2);

	expect(c()).toBe(5);
	expect(bCalcs).toBe(5);
	expect(cCalcs).toBe(4);
	expect(dCalcs).toBe(2);

	expect(b()).toBe(4);
	expect(bCalcs).toBe(5);
	expect(cCalcs).toBe(4);
	expect(dCalcs).toBe(2);

	handle(); // unlisten
	expect(d()).toBe(8);
	expect(bCalcs).toBe(6); // gone to sleep
	expect(cCalcs).toBe(4);
	expect(dCalcs).toBe(3);

	expect(observerChanges).toBe(1);
});

test("[mobx-test] change count optimization", function () {
	let bCalcs = 0;
	let cCalcs = 0;
	const [getA, setA] = signal(3);
	const b = computed(function () {
		bCalcs += 1;
		return 4 + getA() - getA();
	});
	const c = computed(function () {
		cCalcs += 1;
		return b();
	});

	effect(() => c());

	expect(b()).toBe(4);
	expect(c()).toBe(4);
	expect(bCalcs).toBe(1);
	expect(cCalcs).toBe(1);

	setA(5);

	expect(b()).toBe(4);
	expect(c()).toBe(4);
	expect(bCalcs).toBe(2);
	expect(cCalcs).toBe(1);
});

test("[mobx-test] observables removed", function () {
	let calcs = 0;
	const [getA, setA] = signal(1);
	const [getB, setB] = signal(2);
	const c = computed(function () {
		calcs++;
		if (getA() === 1) return getB() * getA() * getB();
		return 3;
	});

	expect(calcs).toBe(0);
	effect(() => c());
	expect(c()).toBe(4);
	expect(calcs).toBe(1);
	setA(2);
	expect(c()).toBe(3);
	expect(calcs).toBe(2);

	setB(3); // should not retrigger calc
	expect(c()).toBe(3);
	expect(calcs).toBe(2);

	setA(1);
	expect(c()).toBe(9);
	expect(calcs).toBe(3);
});

import {
	observable,
	computed,
	effect,
	atom,
	runInAction,
	onObservedStateChange,
	signal,
} from "../src/main";

const createValueAtom = (v, onBecomeObservedCb?, onBecomeUnobservedCb?) => {
	const n = atom();
	onObservedStateChange(n, (observing) => {
		observing ? onBecomeObservedCb?.() : onBecomeUnobservedCb?.();
	});
	let value = v;

	return {
		set(v) {
			value = v;
			n.reportChanged();
		},
		get() {
			n.reportObserved();
			return value;
		},
	};
};

test("can be observed", () => {
	let count = 0;
	const a = createValueAtom(1);
	const c = computed(() => {
		count++;
		return a.get() * 2;
	});

	effect(() => c());
	expect(count).toBe(1);
	expect(c()).toBe(2);
	expect(count).toBe(1);
	a.set(2);
	expect(c()).toBe(4);
	expect(count).toBe(2);
});

test("will trigger onBecomeObserved when observation starts", () => {
	let count = 0;
	const a = createValueAtom(1, () => count++);
	const c = computed(() => a.get());
	c();
	expect(count).toBe(1);
	const u = effect(() => c());
	const u2 = effect(() => a.get());
	expect(count).toBe(2);
	u();
	c();
	expect(count).toBe(2);
	u2();
	expect(count).toBe(2);
	effect(() => c());
	expect(count).toBe(3);
});

test("will trigger onBecomeUnobserved when observation ends (listener unsubscribe)", () => {
	let count = 0;
	const a = createValueAtom(1, null, () => count++);
	const c = computed(() => a.get());
	c();
	expect(count).toBe(1);
	let u = effect(() => c());
	const u2 = effect(() => a.get());
	expect(count).toBe(1);
	u();
	expect(count).toBe(1);
	u2();
	expect(count).toBe(2);
	u = effect(() => c());
	expect(count).toBe(2);
	u();
	expect(count).toBe(3);
});

test("will trigger onBecomeUnobserved when observation ends (computed unsubscribe)", () => {
	let count = 0;
	const [get, set] = signal(true);
	const a = createValueAtom(1, null, () => count++);
	const c = computed(() => get() && a.get());
	const c2 = computed(() => c());
	c2();
	expect(count).toBe(1);
	effect(() => c2());
	expect(count).toBe(1);
	set(false);
	expect(count).toBe(2);
});

test("will return a boolean indicating if atom is observed when invoking `reportObserved`", () => {
	const a = atom();
	expect(a.reportObserved()).toBe(false);
	const u = effect(() => expect(a.reportObserved()).toBe(true));
	expect(a.reportObserved()).toBe(true);
	u();
	expect(a.reportObserved()).toBe(false);
});

test("will not trigger listeners unless 'reportChanged' is called", () => {
	let count = 0;

	const a = createValueAtom(1);
	const [get, set] = signal(1);
	const c = computed(() => ({
		n: a.get(),
		o: get(),
	}));

	effect(() => {
		count++;
		c();
	});

	expect(count).toBe(1);
	runInAction(() => {
		set(2);
		set(1);
	});

	expect(count).toBe(1);
});

test("unoptimizable subscriptions are diffed correctly", () => {
	const [getA, setA] = signal(1);
	const [getB, setB] = signal(1);
	const c = computed(() => {
		getA();
		return 3;
	});
	let called = 0;
	let val = 0;

	const d = effect(() => {
		called++;
		getA();
		c(); // reads a as well
		val = getA();
		if (
			getB() === 1 // only on first run
		)
			getA(); // second run: one read less for a
	});

	expect(called).toBe(1);
	expect(val).toBe(1);

	setB(2);

	expect(called).toBe(2);
	expect(val).toBe(1);

	setA(2);

	expect(called).toBe(3);
	expect(val).toBe(2);

	d();
});

test("can set a custom equals method", () => {
	const a = atom({ equals: (a) => a === 1 });

	let count = 0;

	effect(() => {
		count++;
		a.reportObserved();
	});

	a.reportChanged();
	expect(count).toBe(2);
	a.reportChanged(0);
	expect(count).toBe(3);
	a.reportChanged(1);
	expect(count).toBe(3);
});

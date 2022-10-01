import { runInAction, action, effect, computed, signal } from "../src";

test("immediately executes the function passed in", () => {
	let count = 0;
	runInAction(() => count++);
	expect(count).toBe(1);
});

test("updates observable values", () => {
	const [get, set] = signal(0);
	runInAction(() => set(1));
	expect(get()).toBe(1);
});

test("runInAction returns the result of the action", () => {
	expect(runInAction(() => 1)).toBe(1);
});

test("only calls reactions when the action is completed", () => {
	const [get1, set1] = signal(0);
	const [get2, set2] = signal(0);
	let result = 0;
	let count = 0;
	effect(() => {
		result = get1() + get2();
		count++;
	});

	expect(count).toBe(1);

	runInAction(() => {
		set1(1);
		expect(result).toBe(0);
		set2(2);
		expect(result).toBe(0);
		expect(count).toBe(1);
	});

	expect(result).toBe(3);
	expect(count).toBe(2);
});

test("action is untracked", () => {
	let count = 0;
	const [get, set] = signal(0);

	effect(() => {
		runInAction(() => get());
		count++;
	});

	expect(count).toBe(1);
	set(1);
	expect(count).toBe(1);
});

test("computed values are updated within an action", () => {
	let countC = 0;
	let countA = 0;
	const [get1, set1] = signal(0);
	const [get2, set2] = signal(0);
	const c = computed(() => {
		countC++;
		return get1() + get2();
	});
	effect(() => {
		c();
		countA++;
	});
	expect(countC).toBe(1);
	expect(countA).toBe(1);

	runInAction(() => {
		expect(c()).toBe(0);
		expect(countC).toBe(1);
		set1(1);
		expect(c()).toBe(1);
		expect(countA).toBe(1);
		expect(countC).toBe(2);
		set2(2);
		expect(c()).toBe(3);
		expect(countC).toBe(3);
	});

	expect(countA).toBe(2);
	expect(c()).toBe(3);
	expect(countC).toBe(3);
});

test("does not trigger a change when an observable did not end up producing a new value", () => {
	let count = 0;
	const [get, set] = signal(0);
	const c = computed(() => get() * 2);

	effect(() => {
		c();
		count++;
	});

	expect(count).toBe(1);

	runInAction(() => {
		set(1);
		set(0);
	});

	expect(count).toBe(1);
});

test("can create an action to execute at any time", () => {
	const [get1, set1] = signal(0);
	const [get2, set2] = signal(0);
	let result = 0;
	let count = 0;
	effect(() => {
		result = get1() + get2();
		count++;
	});

	expect(count).toBe(1);

	const myAction = action(() => {
		set1(1);
		expect(result).toBe(0);
		set2(2);
		expect(result).toBe(0);
		expect(count).toBe(1);
	});

	myAction();

	expect(result).toBe(3);
	expect(count).toBe(2);
});

test("created action returns the result of the action", () => {
	const myAction = action(() => 1);
	expect(myAction()).toBe(1);
});

test("can execute an action within an action", () => {
	let countC = 0;
	let countA = 0;
	const [get1, set1] = signal(0);
	const [get2, set2] = signal(0);
	const c = computed(() => {
		countC++;
		return get1() + get2();
	});
	effect(() => {
		c();
		countA++;
	});
	expect(countC).toBe(1);
	expect(countA).toBe(1);

	runInAction(() => {
		expect(c()).toBe(0);
		expect(countC).toBe(1);
		set1(1);
		expect(c()).toBe(1);
		expect(countA).toBe(1);
		expect(countC).toBe(2);
		runInAction(() => {
			runInAction(() => set2(2));
			set1(10);
		});
		expect(countA).toBe(1);
		expect(c()).toBe(12);
		expect(countC).toBe(3);
		runInAction(() => set1(2));
		expect(c()).toBe(4);
		expect(countC).toBe(4);
		expect(countA).toBe(1);
	});

	expect(countA).toBe(2);
});

test("computed values are cached in actions even when unobserved", () => {
	let calls = 0;

	const [get, set] = signal(1);
	const c = computed(() => {
		calls++;
		return get() * get();
	});
	const doAction = action(() => {
		c();
		c();
		for (let i = 0; i < 10; i++) set(get() + 1);
	});

	doAction();
	expect(calls).toBe(1);

	doAction();
	expect(calls).toBe(2);

	effect(() => c());
	expect(calls).toBe(3);

	doAction();
	expect(calls).toBe(4);
});

test("unobserved computed values do not empty cache until all actions are done", () => {
	let calls = 0;
	let called = false;

	const [get1, set1] = signal(0);

	const c = computed(() => {
		calls++;
		return { zero: get1() * 0 };
	});

	const doAction1 = action(() => {
		called = true;
		set1(get1() + 1);
		c();
		c();
	});

	const doAction2 = action(() => {
		c();
		c();
	});

	effect(() => {
		get1();
		if (called) doAction2();
		c();
	});

	doAction1();

	expect(calls).toBe(2);
});

test("unobserved computed values respond to changes within an action", () => {
	const [get, set] = signal(1);
	const c = computed(() => {
		return get() * get();
	});
	const doAction = action(() => {
		expect(c()).toBe(1);
		set(10);
		expect(c()).toBe(100);
	});

	doAction();
	expect(c()).toBe(100);
});

test("computed can throw within an action", () => {
	const [get, set] = signal(1);
	const c = computed(() => {
		if (get() === 0) {
			throw new Error();
		}

		return get();
	});

	let count = 0;

	effect(() => {
		count++;
		c();
	});

	expect(count).toBe(1);

	runInAction(() => {
		try {
			set(0);
			c();
		} catch (e) {}
		expect(() => c()).toThrowError();
		set(10);
	});

	expect(count).toBe(2);
	expect(c()).toBe(10);
});

test("[mobx-test] action in effect does keep / make computed values alive", () => {
	let calls = 0;
	const myComputed = computed(() => calls++);
	const callComputedTwice = () => {
		myComputed();
		myComputed();
	};

	const runWithMemoizing = (fun) => {
		effect(fun)();
	};

	callComputedTwice();
	expect(calls).toBe(2);

	runWithMemoizing(callComputedTwice);
	expect(calls).toBe(3);

	callComputedTwice();
	expect(calls).toBe(5);

	runWithMemoizing(function () {
		runInAction(callComputedTwice);
	});
	expect(calls).toBe(6);

	callComputedTwice();
	expect(calls).toBe(8);
});

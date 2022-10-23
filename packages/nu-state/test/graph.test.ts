import {
	observable,
	isInAction,
	enforceActions,
	runInAction,
	effect,
	computed,
	listener,
	untracked,
	atom,
	isObserved,
	onReactionsComplete,
	isTracking,
	action,
	signal,
} from "../src";

test("can't listen to untracked changes", () => {
	let count = 0;
	const l = listener(() => count++);
	const [get, set] = signal(0);
	const [get2, set2] = signal(1);
	expect(count).toBe(0);
	l.track(() => get() + untracked(() => get2()));
	set(1);
	expect(count).toBe(1);
	set2(2);
	expect(count).toBe(1);
	set(3);
	expect(count).toBe(2);
});

test("can query graph action state", () => {
	expect(isInAction()).toBe(false);

	runInAction(() => {
		expect(isInAction()).toBe(true);
	});

	expect(isInAction()).toBe(false);
});

test("can query the observed state of an observable", () => {
	const o = observable({ value: 0 });
	const c = computed(() => o.value);
	const n = atom();

	expect(isObserved(o)).toBe(false);
	expect(isObserved(c)).toBe(false);
	expect(isObserved(n)).toBe(false);

	const u = effect(() => {
		c();
		n.reportObserved();
	});

	expect(isObserved(o)).toBe(true);
	expect(isObserved(c)).toBe(true);
	expect(isObserved(n)).toBe(true);

	u();

	expect(isObserved(o)).toBe(false);
	expect(isObserved(c)).toBe(false);
	expect(isObserved(n)).toBe(false);
});

test("can query the tracking state of the graph", () => {
	let count = 0;

	const c = computed(() => {
		count++;
		return isTracking();
	});

	expect(isTracking()).toBe(false);
	expect(c()).toBe(true);
	expect(count).toBe(1);
	effect(() => {
		count++;
		expect(isTracking()).toBe(true);
		expect(c()).toBe(true);
	});
	expect(count).toBe(3);
	expect(isTracking()).toBe(false);
	effect(() =>
		untracked(() => {
			count++;
			expect(isTracking()).toBe(false);
		})
	);
	expect(count).toBe(4);
});

test("will prevent modification of observables outside of actions when actions are enforced", () => {
	const [get, set] = signal(0);
	enforceActions(true);

	//allowed
	expect(() => set(1)).not.toThrow();

	const u = effect(() => get());
	expect(() => set(2)).toThrowError();

	u();
	expect(() => set(1)).not.toThrow();
});

test("(global) will prevent modification of observables outside of actions when actions are enforced", () => {
	const [get, set] = signal(0);
	enforceActions(true);

	//allowed
	expect(() => set(1)).not.toThrow();

	const u = effect(() => get());
	expect(() => set(2)).toThrowError();

	u();
	expect(() => set(1)).not.toThrow();
	enforceActions(false);
});

test("enforce actions allows for initialization within a computed", () => {
	const [get] = signal(0);
	enforceActions(true);

	const c = computed(() => {
		const obj = observable({ o: undefined });

		obj.o = get();

		return obj;
	});

	expect(() => c()).not.toThrow();
	expect(effect(() => c())).not.toThrow();
	enforceActions(false);
});

test("onReactionsComplete:: can call method when reactions are done", () => {
	const [get, set] = signal(0);
	let count = 0;
	const unsub = onReactionsComplete(() => count++);
	const act = action(() => {
		runInAction(() => {
			runInAction(() => {
				set(get() + 1);
			});
		});
	});
	expect(count).toBe(0);
	act();
	expect(get()).toBe(1);
	expect(count).toBe(0);
	effect(() => get());
	act();
	expect(get()).toBe(2);
	expect(count).toBe(1);
	unsub();
	act();
	expect(count).toBe(1);
});

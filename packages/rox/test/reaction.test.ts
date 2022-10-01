import { computed, reaction, effect, signal } from "../src";

test("runs the track method initially", () => {
	let count = 0;
	reaction(
		() => count++,
		() => {}
	);
	expect(count).toBe(1);
});

test("re-runs the track method when an observable value changes", () => {
	let count = 0;
	const [get, set] = signal(0);
	reaction(
		() => {
			count++;
			return get();
		},
		() => {}
	);
	expect(count).toBe(1);
	set(1);
	expect(count).toBe(2);
});

test("passes the value returned from the track method into the callback", () => {
	let value = 0;
	const [get, set] = signal(0);
	reaction(
		() => {
			return get();
		},
		(v) => {
			value = v;
		}
	);

	set(1);
	expect(value).toBe(1);
});

test("runs the callback method when an observable value changes", () => {
	let count1 = 0;
	let count2 = 0;
	const [get1, set1] = signal(0);
	const [get2, set2] = signal(0);
	const c1 = computed(() => get2() * 2);
	const c2 = computed(() => get1() * 2);
	reaction(
		() => get1() + c1() + c2(),
		() => count1++
	);
	reaction(
		() => c2(),
		() => count2++
	);
	expect(count1).toBe(0);
	expect(count2).toBe(0);
	set1(1);
	expect(count1).toBe(1);
	expect(count2).toBe(1);
	set1(2);
	expect(count1).toBe(2);
	expect(count2).toBe(2);
	set2(1);
	expect(count1).toBe(3);
	expect(count2).toBe(2);
});

test("does not run the callback when the same value is returned", () => {
	let count = 0;
	const [get1, set1] = signal(0);
	const [get2, set2] = signal(0);
	reaction(
		() => get1() * 0 + get2(),
		() => count++
	);
	set1(1);
	expect(count).toBe(0);
	set2(1);
	expect(count).toBe(1);
});

test("does not call the callback when unsubscribed", () => {
	let count = 0;
	const [get, set] = signal(0);
	const u = reaction(
		() => get(),
		() => count++
	);
	set(1);
	expect(count).toBe(1);
	u();
	set(2);
	expect(count).toBe(1);
});

test("does not call the track function when unsubscribed", () => {
	let count = 0;
	const [get, set] = signal(0);
	const u = reaction(
		() => {
			count++;
			return get();
		},
		() => {}
	);
	expect(count).toBe(1);
	set(1);
	expect(count).toBe(2);
	u();
	set(2);
	expect(count).toBe(2);
});

test("can mutate observables in the callback", () => {
	let count = 0;
	const [get1, set1] = signal(0);
	const [get2, set2] = signal(1);
	const c = computed(() => get2() * 2);
	reaction(
		() => {
			return get1();
		},
		() => {
			set2(get2() + 1);
		}
	);
	set1(1);
	expect(c()).toBe(4);
	effect(() => {
		count++;
		c();
	});
	set1(2);
	expect(c()).toBe(6);
	expect(count).toBe(2);
});

test("does not react to stale observables", () => {
	let count = 0;
	const [get1, set1] = signal(true);
	const [get2, set2] = signal(1);
	const [get3, set3] = signal(2);

	reaction(
		() => (get1() ? get2() : get3()),
		() => count++
	);
	set1(false);
	expect(count).toBe(1);
	set2(3);
	expect(count).toBe(1);
	set3(4);
	expect(count).toBe(2);
});

test("reactions triggering other reactions", () => {
	let results = [];
	const [get, set] = signal(1);
	const c = computed(() => {
		results.push("computed");
		return get() * 2;
	});
	reaction(
		() => c(),
		() => {
			results.push("reaction1 + " + get());
			set(2);
		}
	);

	reaction(
		() => c(),
		() => {
			results.push("reaction2 + " + get());
			set(3);
		}
	);

	reaction(
		() => get(),
		() => {
			results.push("reaction3 + " + get());
		}
	);
	expect(results).toEqual(["computed"]);
	results = [];

	set(2);

	expect(results).toEqual([
		"computed",
		"reaction1 + 2",
		"reaction2 + 2",
		"reaction3 + 3",
		"computed",
		"reaction1 + 3",
		"reaction3 + 2",
		"computed",
		"reaction1 + 2",
	]);
});

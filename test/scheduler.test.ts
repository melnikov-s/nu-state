import { vi } from "vitest";
import {
	observable,
	createScheduler,
	Scheduler,
	isInBatch,
	signal,
	createMicroTaskScheduler,
	createAnimationScheduler,
} from "../src/main";

const createTimeoutScheduler = (timeout: number = 0): Scheduler =>
	createScheduler((fn) => setTimeout(fn, timeout));

beforeEach(() => {
	vi.useFakeTimers();
});

test("can create an effect scheduler", () => {
	const [get, set] = signal(0);
	const scheduler = createTimeoutScheduler(0);
	let count = 0;
	scheduler.effect(() => {
		get();
		count++;
	});
	expect(count).toBe(1);
	set(1);
	set(2);
	expect(count).toBe(1);
	vi.runAllTimers();
	expect(count).toBe(2);
});

test("can create a reaction scheduler", () => {
	const [get, set] = signal(0);
	const scheduler = createTimeoutScheduler(0);
	let count = 0;
	scheduler.reaction(
		() => get(),
		() => count++
	);
	set(1);
	set(2);
	expect(count).toBe(0);
	vi.runAllTimers();
	expect(count).toBe(1);
	set(3);
});

test("reaction scheduler passes in the last value into callback", () => {
	const [get, set] = signal(0);
	const scheduler = createTimeoutScheduler(0);
	const count = 0;
	let value = 0;
	scheduler.reaction(
		() => get(),
		(v) => {
			value = v;
		}
	);
	set(1);
	set(2);
	set(3);
	expect(value).toBe(0);
	vi.runAllTimers();
	expect(value).toBe(3);
});

test("unsubscribe removes scheduled callback", () => {
	const [get, set] = signal(0);
	const scheduler = createTimeoutScheduler(0);
	let count = 0;
	const unsub = scheduler.effect(() => {
		get();
		count++;
	});
	expect(count).toBe(1);
	set(1);
	unsub();
	vi.runAllTimers();
	expect(count).toBe(1);
});

test("can create a scheduled listener", () => {
	let count = 0;
	const scheduler = createTimeoutScheduler(0);
	const l = scheduler.listener(() => count++);
	const [get, set] = signal(0);
	l.track(() => get());
	set(1);
	set(2);
	set(3);
	expect(count).toBe(0);
	vi.runAllTimers();
	expect(count).toBe(1);
});

test("scheduled reactions occur in a batch", () => {
	let count = 0;
	const scheduler = createTimeoutScheduler(0);
	const l = scheduler.listener(() => {
		count++;
		expect(isInBatch()).toBe(true);
	});
	const [get, set] = signal(0);
	l.track(() => get());
	set(1);
	set(2);
	set(3);
	expect(count).toBe(0);
	vi.runAllTimers();
	expect(count).toBe(1);
	expect(isInBatch()).toBe(false);
});

test("listeners on the same scheduler trigger in a tight loop", () => {
	let count = 0;
	let asserted = true;
	const createCustomScheduler = (timeout: number = 0): Scheduler =>
		createScheduler((fn) =>
			setTimeout(() => {
				expect(count).toBe(0);
				fn();
				expect(count).toBe(3);
				asserted = true;
			}, 0)
		);

	const scheduler = createCustomScheduler();
	const [get, set] = signal(0);
	const l = scheduler.listener(() => {
		count++;
	});
	const l2 = scheduler.listener(() => {
		count++;
	});
	const l3 = scheduler.listener(() => {
		count++;
	});
	l.track(() => get());
	l2.track(() => get());
	l3.track(() => get());
	set(1);
	set(2);
	vi.runAllTimers();
	expect(count).toBe(3);
	expect(asserted).toBe(true);
});

test("can create a sync scheduler", () => {
	let count = 0;
	const createCustomScheduler = (): Scheduler => createScheduler((fn) => fn());

	const scheduler = createCustomScheduler();
	const [get, set] = signal(0);
	const l = scheduler.listener(() => {
		count++;
	});
	const l2 = scheduler.listener(() => {
		count++;
	});
	const l3 = scheduler.listener(() => {
		count++;
	});
	l.track(() => get());
	l2.track(() => get());
	l3.track(() => get());
	set(1);
	expect(count).toBe(3);
	set(2);
	expect(count).toBe(6);
});

test("can create a microtask scheduler", async () => {
	vi.useRealTimers();
	let count = 0;
	const runs = [];

	const scheduler = createMicroTaskScheduler();
	const [get, set] = signal(0);
	const l = scheduler.listener(() => {
		count++;
		runs.push(1);
	});
	const l2 = scheduler.listener(() => {
		count++;
		runs.push(2);
	});
	const l3 = scheduler.listener(() => {
		count++;
		runs.push(3);
	});
	l.track(() => get());
	l2.track(() => get());
	l3.track(() => get());
	set(1);
	set(2);
	set(3);
	set(4);
	expect(count).toBe(0);
	await new Promise((resolve) => setTimeout(resolve, 0));
	expect(count).toBe(3);
	expect(runs).toEqual([1, 2, 3]);
});

test("can create an animation scheduler", () => {
	let fns = [];

	global.requestAnimationFrame = (fn) => {
		fns.push(fn);
		return fns.length;
	};

	function tick() {
		fns.forEach((fn) => fn());
		fns = [];
	}

	let count = 0;
	const runs = [];

	const scheduler = createAnimationScheduler();
	const [get, set] = signal(0);
	const l = scheduler.listener(() => {
		count++;
		runs.push(1);
	});
	const l2 = scheduler.listener(() => {
		count++;
		runs.push(2);
	});
	const l3 = scheduler.listener(() => {
		count++;
		runs.push(3);
	});
	l.track(() => get());
	l2.track(() => get());
	l3.track(() => get());
	set(1);
	set(2);
	set(3);
	set(4);
	expect(count).toBe(0);
	tick();
	expect(count).toBe(3);
	expect(runs).toEqual([1, 2, 3]);
});

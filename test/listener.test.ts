import { listener, runInAction, signal } from "../src/main";

test("reacts to whatever is tracked", () => {
	let count = 0;
	const l = listener(() => count++);
	const [get, set] = signal(0);
	expect(count).toBe(0);
	l.track(() => get());
	set(1);
	expect(count).toBe(1);
});

test("continues to track once the callback is called", () => {
	let count = 0;
	const l = listener(() => count++);
	const [get, set] = signal(0);
	l.track(() => get());
	set(1);
	set(2);
	set(3);
	expect(count).toBe(3);
});

test("additional track invocations unsubscribes from previous ones", () => {
	let count = 0;
	const l = listener(() => count++);
	const [get, set] = signal(0);
	l.track(() => get());
	l.track(() => {});
	set(1);
	set(2);
	set(3);
	expect(count).toBe(0);
});

test("calling dispose will no longer invoke the callback", () => {
	let count = 0;
	const l = listener(() => count++);
	const [get, set] = signal(0);
	l.track(() => get());
	set(1);
	expect(l.isDisposed).toBe(false);
	l.dispose();
	expect(l.isDisposed).toBe(true);
	set(2);
	set(3);
	expect(count).toBe(1);
});

test("can perform an action during the callback", () => {
	const l = listener(() => runInAction(() => set2(get())));
	const [get, set] = signal(0);
	const [get2, set2] = signal(0);
	l.track(() => get());
	set(1);
	expect(get2()).toBe(1);
	l.dispose();
	set(2);
	set(3);
	expect(get2()).toBe(1);
});

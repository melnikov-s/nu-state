import { listener, runInAction, signal } from "../src";

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

test("can manually start and end an observer", () => {
	let count = 0;
	const l = listener(() => count++);
	const [get, set] = signal(0);

	l.start();
	get();
	l.end();

	expect(count).toBe(0);

	set(1);
	expect(count).toBe(1);
});

test("can manually start and end an observer over async boundary", async () => {
	let count = 0;
	const l = listener(() => count++);
	const [get, set] = signal(0);

	l.start();
	get();

	await Promise.resolve();
	l.end();

	expect(count).toBe(0);

	set(1);
	expect(count).toBe(1);
});

test("can manually start and end an observer over async boundary (nested)", async () => {
	let countA = 0;
	let countB = 0;
	const lA = listener(() => countA++);
	const lB = listener(() => countB++);
	const [getA, setA] = signal(0);
	const [getB, setB] = signal(0);
	const [getC, setC] = signal(0);
	const [getD, setD] = signal(0);

	lA.start();
	getA();

	await Promise.resolve();
	lB.start();
	getB();
	await Promise.resolve();
	lB.end();
	await Promise.resolve();
	getC();
	lA.end();
	expect(countA).toBe(0);
	expect(countB).toBe(0);

	getD();

	setB(1);
	expect(countA).toBe(0);
	expect(countB).toBe(1);
	setA(1);
	expect(countA).toBe(1);
	expect(countB).toBe(1);
	setC(1);
	expect(countA).toBe(2);
	expect(countB).toBe(1);
	setD(1);
	expect(countA).toBe(2);
	expect(countB).toBe(1);
});

test("mismatching end/start on listener will throw", async () => {
	const lA = listener(() => {});
	const lB = listener(() => {});

	lB.start();
	lA.start();
	await Promise.resolve();
	expect(() => lB.end()).toThrow();
});

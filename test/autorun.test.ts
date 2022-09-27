import { effect, signal } from "../src/main";

test("runs the callback initially", () => {
	let count = 0;
	effect(() => count++);
	expect(count).toBe(1);
});

test("can be disposed on first run", function () {
	const [get, set] = signal(1);
	const values = [];

	effect((r) => {
		r.dispose();
		values.push(get());
	});

	set(2);

	expect(values).toEqual([1]);
});

test("runs the callback every time an observer is changed", () => {
	let count = 0;
	const [get, set] = signal(0);
	effect(() => {
		count++;
		get();
	});
	expect(count).toBe(1);
	set(1);
	expect(count).toBe(2);
});

test("does not run the callback when unsubscribed", () => {
	let count = 0;
	const [get, set] = signal(0);
	const u = effect(() => {
		get();
		count++;
	});
	expect(count).toBe(1);
	set(1);
	expect(count).toBe(2);
	u();
	set(2);
	expect(count).toBe(2);
});

test("[mobx-test] effects created in effects should kick off", () => {
	const [getX, setX] = signal(3);
	const x2 = [];
	let d;

	effect(function () {
		if (d) {
			// dispose previous effect
			d();
		}
		d = effect(function () {
			x2.push(getX() * 2);
		});
	});

	setX(4);
	expect(x2).toEqual([6, 8]);
});

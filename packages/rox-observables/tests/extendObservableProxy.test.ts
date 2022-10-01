import { extendObservableProxy } from "../src";
import { observable, effect } from "./utils";

test("can extend the proxy handlers on an observable object", () => {
	const o = observable({ a: 0 });
	let triggeredGet = false;
	let triggeredSet = false;
	let count = 0;

	extendObservableProxy(o, {
		get(originalHandler, target, key, receiver) {
			if (key === "a") {
				triggeredGet = true;
			}

			return originalHandler(target, key, receiver);
		},
		set(originalHandler, target, key, newValue, receiver) {
			if (key === "a") {
				triggeredSet = true;
			}

			return originalHandler(target, key, newValue, receiver);
		},
	});

	effect(() => {
		o.a;
		count++;
	});

	expect(triggeredGet).toBe(true);

	o.a = 1;
	expect(count).toBe(2);
	expect(triggeredSet).toBe(true);
});

test("extending a un-used proxy trap does not throw when calling original trap", () => {
	const o = observable({ a: 0 });
	let triggered = false;

	extendObservableProxy(o, {
		getPrototypeOf(originalHandler, target) {
			triggered = true;
			return originalHandler(target);
		},
	});

	let proto;

	expect(() => (proto = Object.getPrototypeOf(o))).not.toThrow();
	expect(triggered).toBe(true);
	expect(proto).toBe(Object.getPrototypeOf(o));
});

test("attempting to extend proxy handlers on an non-observable will throw", () => {
	expect(() => extendObservableProxy({}, {})).toThrow();
});

import { Signal as SignalClass } from "../observables/signal";
import { defaultEquals } from "../utils";
import { setNode } from "./graph";

export type SignalOptions = {
	equals?: typeof defaultEquals;
};

export type Signal<T> = [get: () => T, set: (v: T) => T];

export function signal<T>(initialValue: T, opts?: SignalOptions): Signal<T> {
	const signal = new SignalClass(
		initialValue,
		opts?.equals
	);

	const getter = signal.get.bind(signal);
	const setter = signal.set.bind(signal);

	setNode(getter, signal);

	return [getter, setter];
}

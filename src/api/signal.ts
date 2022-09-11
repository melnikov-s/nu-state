import SignalClass from "../observables/signal";
import { defaultEquals } from "../utils";
import { Graph, resolveGraph, setNode } from "./graph";

export type SignalOptions = {
	graph?: Graph;
	equals?: typeof defaultEquals;
};

export type Signal<T> = [get: () => T, set: (v: T) => T];

export default function signal<T>(
	initialValue: T,
	opts?: SignalOptions
): Signal<T> {
	const signal = new SignalClass(
		initialValue,
		resolveGraph(opts?.graph),
		opts?.equals
	);

	const getter = signal.get.bind(signal);
	const setter = signal.set.bind(signal);

	setNode(getter, signal);

	return [getter, setter];
}

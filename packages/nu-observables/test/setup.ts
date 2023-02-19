import { createGraph, Graph, setTestGraph } from "nu-observables";
import {
	AtomNode,
	ComputedNode,
	batch,
	runInAction,
	isTracking,
	isInAction,
	onObservedStateChange,
	ListenerNode,
} from "nu-reactive-graph";

let graph: Graph;

function effect(callback: () => void): () => void {
	const boundCallback: () => void = () => callback.call(null, listener);

	const listener = new ListenerNode(() => {
		listener.track(boundCallback);
	});

	listener.track(boundCallback);

	return function (): void {
		listener.dispose();
	};
}

export function getGraph(): Graph {
	return (graph =
		graph ??
		createGraph({
			createAtom() {
				return new AtomNode();
			},
			createComputed(fn, context) {
				return new ComputedNode(fn, undefined, false, context);
			},
			batch,
			runInAction(fn) {
				return runInAction(fn, false);
			},
			isTracking,
			onObservedStateChange,
			effect,
			isInAction,
		}));
}

setTestGraph(getGraph());

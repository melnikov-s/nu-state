import {
	Computed,
	Listener,
	nodeTypes,
	ObservableNode,
	ObserverNode,
	Node,
	Atom,
} from "./types";

let inBatch = false;
let actionsEnforced = false;
let inAction = false;
let callDepth = 0;
let actionCallDepth = 0;
let taskError = false;
const propagatedObservables: Set<Atom<unknown>> = new Set();
const changedObservables: Map<Node, unknown> = new Map();
const invokedComputed: Set<Computed<unknown>> = new Set();
const potentialUnObserved: Set<ObservableNode> = new Set();
const potentialStale: Set<Computed<unknown>> = new Set();
const queuedListeners: Set<Listener> = new Set();
const runStack: (ObserverNode | null)[] = [];
const onObservedStateChangeCallbacks: Map<
	ObservableNode,
	Set<(observing: boolean) => void>
> = new Map();
const reactionsCompleteCallbacks: Set<() => void> = new Set();

const taskCalledStack: boolean[] = [];

// clean up any unobserved computed nodes that were cached for the
// duration of a batch or derivation
function clearInvokedComputed(): void {
	invokedComputed.forEach((c) => {
		if (c.observers.size === 0 && !c.isKeepAlive()) {
			remove(c);
		}
	});
	invokedComputed.clear();
}

// determine if a node has changed it's value during a batch
function hasChanged(node: Node): boolean {
	let changed = false;

	switch (node.nodeType) {
		case nodeTypes.atom:
			changed = !node.equals(changedObservables.get(node));
			if (!changed) {
				changedObservables.delete(node);
			}
			break;
		case nodeTypes.computed:
			node.observing.forEach((o) => {
				changed = changed || (changedObservables.has(o) && hasChanged(o));
			});

			if (!changed) {
				changedObservables.delete(node);
				potentialStale.delete(node);
			}

			changed = changed && !node.equals(changedObservables.get(node));
			break;
		case nodeTypes.listener:
			node.observing.forEach((o) => {
				changed = changed || (changedObservables.has(o) && hasChanged(o));
			});
			break;
	}

	return changed;
}

function notifyObservedState(
	observable: ObservableNode,
	observing: boolean
): void {
	onObservedStateChangeCallbacks.get(observable)?.forEach((f) => f(observing));
}

// propagate a change to an observable down the graph during a batch
// in order to mark any affected computed nodes as a potentially stale
// and collect all dependent listeners
function propagateChange(node: ObservableNode): void {
	node.observers.forEach((childNode) => {
		if (childNode.nodeType === nodeTypes.computed) {
			// if this is the first time this computed node was changed within
			// a batch we collect its value for later comparison
			// at this point the computed value should never be dirty
			if (!changedObservables.has(childNode)) {
				changedObservables.set(childNode, childNode.value);
			}

			// if a computed is already marked as stale we can stop propagation
			if (!potentialStale.has(childNode)) {
				potentialStale.add(childNode);
				propagateChange(childNode);
			}
		} else {
			// store all affected listeners for potential invocation when batch
			// is complete
			const listener = childNode as Listener;

			queuedListeners.delete(listener);
			queuedListeners.add(listener);
		}
	});
}

function topOfRunStack(): ObserverNode | null {
	return runStack[runStack.length - 1] || null;
}

function run<T>(fn: () => T, isUntracked = true, asAction = false): T {
	let result: unknown;
	taskCalledStack.push(false);

	try {
		asAction ? startAction() : startBatch();
		result = isUntracked ? untracked(fn) : fn();
	} finally {
		if (taskCalledStack[taskCalledStack.length - 1]) {
			if (typeof (result as Promise<unknown>)?.finally !== "function") {
				taskCalledStack.pop();
				taskError = true;
				throw new Error(
					"nu-state: when task is used in an action that action must return a promise, instead got :" +
						typeof result
				);
			}
			result = (result as Promise<T>).finally(() => {
				asAction ? endAction() : endBatch();
			});
		} else {
			asAction ? endAction() : endBatch();
		}

		taskCalledStack.pop();
	}

	return result as T;
}

export function enforceActions(enforce: boolean): void {
	actionsEnforced = enforce;
}

export function isInAction(): boolean {
	return inAction;
}

export function isInBatch(): boolean {
	return inBatch;
}

export function isObserved(node: ObservableNode): boolean {
	return node.observers.size > 0 || potentialUnObserved.has(node);
}

export function isPotentiallyStale(node: Computed<unknown>): boolean {
	return potentialStale.has(node);
}

export function isTracking(): boolean {
	return topOfRunStack() != null;
}

export function onReactionsComplete(callback: () => void): () => void {
	reactionsCompleteCallbacks.add(callback);

	return (): void => {
		reactionsCompleteCallbacks.delete(callback);
	};
}

export function onObservedStateChange(
	node: ObservableNode,
	callback: (observing: boolean) => void
): () => void {
	let callbacks = onObservedStateChangeCallbacks.get(node);
	if (!callbacks) {
		callbacks = new Set();
		onObservedStateChangeCallbacks.set(node, callbacks);
	}

	callbacks.add(callback);

	return (): void => {
		callbacks!.delete(callback);
		if (callbacks!.size === 0) {
			onObservedStateChangeCallbacks.delete(node);
		}
	};
}

// remove an observer from the graph, can happen when a listener is
// unsubscribed from or when a computed is no longer observed
// or when a derivation has ended and we want to clear cached values
// for unobserved computed
export function remove(
	node: ObserverNode,
	forceUnObserve: boolean = false
): void {
	const wasObserved =
		forceUnObserve ||
		(node.nodeType === nodeTypes.computed && isObserved(node));

	node.observing.forEach((o) => {
		o.observers.delete(node);
		if (!isObserved(o)) {
			if (o.nodeType === nodeTypes.computed && !o.isKeepAlive()) {
				remove(o, true);
			} else {
				notifyObservedState(o, false);
			}
		}
	});
	node.observing.clear();

	// in case we are disposing a listener while it is running
	const runStackIndex = runStack.indexOf(node);
	if (runStackIndex >= 0) {
		runStack[runStackIndex] = null;
	}

	if (node.nodeType === nodeTypes.computed) {
		node.clear();
		wasObserved && notifyObservedState(node, false);
	}
}

// register an observable change which will propagate the change to all
// dependencies, invaliding computed nodes and queuing up listener nodes
// for execution.
export function reportChanged(node: Atom<unknown>, oldValue?: unknown): void {
	const top = topOfRunStack();
	if (runStack.length && !!top && isObserved(node)) {
		// we ignore the change if the change occurred within the same reaction in
		// which it was initially observed. This is to allow for creating observables
		// in reactions and mutating them further.
		if (node.observers.has(top) && node.observers.size === 1) {
			return;
		}

		throw new Error(
			"Can't change an observable during a reaction or within a computed"
		);
	}

	if (!inAction) {
		if (actionsEnforced) {
			throw new Error(
				"strict actions are enforced. Attempted to modify an observed observable outside of an action"
			);
		} else {
			// if we're not currently in a action start a new one
			try {
				startAction();
				reportChanged(node, oldValue);
			} finally {
				endAction();
			}
			return;
		}
	}

	if (propagatedObservables.has(node)) {
		return;
	}

	// keep track of the old value to ensure it changed when the batch
	// is completed
	if (!changedObservables.has(node)) {
		changedObservables.set(node, oldValue);
	}

	propagatedObservables.add(node);

	// propagate the change down the graph until we reach the listeners
	propagateChange(node);
}

// register an observable read with the top most observer on the run stack
export function reportObserved(node: ObservableNode): void {
	const top = topOfRunStack();

	// we only care about an observable being accessed if there's
	// currently an observer running
	if (top && !top.observing.has(node)) {
		propagatedObservables.delete(node as Atom);
		// if this is the first time an observable is being observed ...
		if (!isObserved(node)) {
			notifyObservedState(node, true);
		}

		// create two-way link between observer and observable
		node.observers.add(top);
		top.observing.add(node);
	}
}

export function startObserver(node: ObserverNode): void {
	// Clear out all observer links from last run
	node.observing.forEach((n) => {
		n.observers.delete(node);

		if (n.observers.size === 0) {
			// keep track of all nodes that might lose their only subscriber
			// `onBecomeUnobserved` needs to be called on them if they do
			potentialUnObserved.add(n);
		}
	});
	node.observing.clear();
	runStack.push(node);
}

export function endObserver(node: ObserverNode): void {
	if (runStack.length === 0) {
		throw new Error(
			"Attempted to end an observer but one has not yet been started."
		);
	} else if (
		runStack[runStack.length - 1] &&
		runStack[runStack.length - 1] !== node
	) {
		throw new Error(
			"Attempted to end an observer on a node that has not started it"
		);
	}
	// computed values are cached while an observer is running need to track
	// them and clear them out when the top most observer is completed
	if (node.nodeType === nodeTypes.computed) {
		invokedComputed.add(node);
	}

	runStack.pop();

	if (runStack.length === 0) {
		// if we're not in a batch we can clean up any derived computed that are not
		// observed but were cached for the duration of the derivation.
		// if we're in an batch, that clean up will be performed after the batch
		// is completed.
		if (!inBatch) {
			clearInvokedComputed();
		}

		// once done with the runstack we need to go through all nodes
		// that were marked as potential to be unobserved and if they no
		// longer have any observers call `onBecomeUnobserved` on them.
		potentialUnObserved.forEach((observable) => {
			if (observable.observers.size === 0) {
				if (observable.nodeType === nodeTypes.computed) {
					remove(observable);
				} else {
					notifyObservedState(observable, false);
				}
			}
		});
		potentialUnObserved.clear();
	}
}

// run an observer method and listen to any `reportObserved` calls from observables
// that were accessed during this time
export function runObserver<T>(
	node: ObserverNode,
	observerMethod: () => T,
	context: unknown = null
): T {
	startObserver(node);

	let value: T;

	try {
		value = observerMethod.call(context);
		if (node.nodeType === nodeTypes.computed) {
			potentialStale.delete(node);
		}
	} finally {
		endObserver(node);
	}

	return value;
}

export function runInAction<T>(fn: () => T, untracked = true): T {
	return run(fn, untracked, true);
}

export function task<T>(promise: Promise<T>): Promise<T> {
	if (!inBatch) {
		throw new Error("nu-state: can't call `task` outside of an action");
	}
	const wasInAction = inAction;
	if (wasInAction) {
		endAction();
	} else {
		endBatch();
	}
	taskCalledStack[taskCalledStack.length - 1] = true;
	return Promise.resolve(promise).finally(() => {
		if (taskError) {
			taskError = false;
			return;
		}

		if (wasInAction) {
			startAction();
		} else {
			startBatch();
		}
	});
}

export function batch<T>(fn: () => T): T {
	return run(fn, false);
}

export function endAction(): void {
	if (actionCallDepth === 0) {
		throw new Error(
			"nu-state: attempted to end an action that has not been started"
		);
	}
	actionCallDepth--;
	if (actionCallDepth === 0) {
		inAction = false;
	}
	endBatch();
}

export function startAction(): void {
	actionCallDepth++;
	inAction = true;
	startBatch();
}

export function endBatch(): void {
	if (callDepth === 0) {
		throw new Error(
			"nu-state: attempted to end a batch/action that has not been started"
		);
	}

	// if we're ending the outer most batch
	if (callDepth === 1) {
		let reactionsExecuted = false;

		try {
			// loop through all the affected listeners and filter out
			// the listeners whose observables did not produce a new value
			queuedListeners.forEach((l) => {
				// we remove the listener from the queue so that it can be re-added
				// in the case that a reaction performs a mutation
				// queuedListeners.delete(l);
				// computed might re-evaluate here in order to determine if a new
				// value was produced
				if (hasChanged(l)) {
					// perform reaction if any of the dependents have changed
					l.react();
					reactionsExecuted = true;

					// after a reaction it's possible that we queued another listener
					// this can occur if a reaction made a further mutation
					// if that happens the listener will be added to the `queuedListeners` Set
					// and will eventually run in this forEach loop.
				}
			});
		} finally {
			inBatch = false;
			inAction = false;
			queuedListeners.clear();
			changedObservables.clear();
			propagatedObservables.clear();

			// All computed nodes marked potentially stale are now confirmed stale
			// need to reset them
			potentialStale.forEach((n) => {
				n.clear();
			});
			potentialStale.clear();

			// clean up any unobserved computed that were cached for the duration
			// of this batch.
			clearInvokedComputed();
			callDepth--;

			// If a reaction occurred during this batch invoke `onReactionsComplete` callbacks
			if (reactionsExecuted) {
				reactionsCompleteCallbacks.forEach((c) => c());
			}
		}
	} else {
		callDepth--;
	}
}

export function startBatch(): void {
	callDepth++;
	if (!inBatch) {
		inBatch = true;
	}
}

export function untracked<T>(fn: () => T): T {
	try {
		runStack.push(null);
		return fn();
	} finally {
		runStack.pop();
	}
}

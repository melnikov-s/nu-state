import { ComputedNode } from "../core/nodes/computed";
import { setNode, getNode } from "./graph";

export type Computed<T> = () => T;

export type InternalComputedNode<T> = {
	clear: () => void;
	equals: (value: T) => boolean;
	get: () => T;
	isDirty: () => boolean;
	isKeepAlive: () => boolean;
	setKeepAlive: (keepAlive: boolean) => void;
};

export type ComputedOptions<T> = {
	equals?: (a: T, b: T) => boolean;
	keepAlive?: boolean;
	context?: unknown;
};

const internalComputedNodes = new WeakMap<
	Computed<unknown>,
	InternalComputedNode<unknown>
>();

export function computed<T>(
	fn: () => T,
	opts?: ComputedOptions<T>
): Computed<T> {
	const computedNode = new ComputedNode(
		fn,
		opts?.equals,
		opts?.keepAlive,
		opts?.context
	);

	const computed = computedNode.get.bind(computedNode);

	setNode(computed, computedNode);

	return computed;
}

export function getInternalComputedNode<T>(
	fn: () => T
): InternalComputedNode<T> {
	let internalNode = internalComputedNodes.get(fn);

	if (!internalNode) {
		const computedNode = getNode(fn);

		if (!computedNode) {
			throw new Error("getInternalComputedNode: parameter is not a computed!");
		}

		internalNode = {
			get: computedNode.get.bind(computedNode),
			clear: computedNode.clear.bind(computedNode),
			equals: computedNode.equals.bind(computedNode),
			isDirty: computedNode.isDirty.bind(computedNode),
			isKeepAlive: computedNode.isKeepAlive.bind(computedNode),
			setKeepAlive: computedNode.setKeepAlive.bind(computedNode),
		};

		internalComputedNodes.set(fn, internalNode);
	}

	return internalNode as InternalComputedNode<T>;
}

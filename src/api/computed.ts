import ComputedNode from "../core/nodes/computed";
import { getOpts, propertyType } from "../observables/utils/configuration";
import { getCtorConfiguration } from "../observables/utils/lookup";
import { isPropertyKey } from "../utils";
import { resolveGraph, Graph, setNode, getNode } from "./graph";

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
	graph?: Graph;
	equals?: (a: T, b: T) => boolean;
	keepAlive?: boolean;
	context?: unknown;
};

const internalComputedNodes = new WeakMap<
	Computed<unknown>,
	InternalComputedNode<unknown>
>();

function computed<T>(fn: () => T, opts?: ComputedOptions<T>): Computed<T>;

function computed(
	target: unknown,
	propertyKey: string,
	descriptor: PropertyDescriptor
): any;

function computed<T>(...args: unknown[]): unknown {
	if (isPropertyKey(args[1])) {
		const [target, propertyKey, descriptor] = args as [
			any,
			PropertyKey,
			unknown
		];

		const config = getCtorConfiguration(target.constructor);
		config[propertyKey] = propertyType.computed;
		return descriptor;
	} else {
		const [fn, opts] = args as [() => T, ComputedOptions<T>];
		const computedNode = new ComputedNode(
			resolveGraph(opts?.graph),
			fn,
			opts?.equals,
			opts?.keepAlive,
			opts?.context
		);

		const computed = computedNode.get.bind(computedNode);

		setNode(computed, computedNode);

		return computed;
	}
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

Object.assign(computed, propertyType.computed);

computed.opts = getOpts(propertyType.computed);

export default computed as typeof computed & {
	opts: typeof computed.opts;
} & typeof propertyType.computed;

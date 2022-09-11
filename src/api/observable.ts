import { resolveGraph, Graph } from "./graph";
import { isNonPrimitive, isPropertyKey } from "../utils";
import {
	getObservable,
	getCtorConfiguration,
	getObservableWithConfig,
} from "../observables/utils/lookup";
import {
	Configuration,
	ConfigurationGetter,
	propertyType,
	getOpts,
	withDefaultConfig,
} from "../observables/utils/configuration";

export type ObservableOptions = {
	graph?: Graph;
};

type ObservableOptionsConfigure = ObservableOptions & {
	withDefaults?: boolean;
};

function observableConfigure<T extends object, S extends T>(
	config: Configuration<T> | ConfigurationGetter<S>,
	target: T,
	opts?: ObservableOptionsConfigure
): T;

function observableConfigure<T extends object>(
	config: Configuration<T> | ConfigurationGetter<T>
): typeof propertyType.observable;

function observableConfigure<T extends object>(
	config: Configuration<T> | ConfigurationGetter<T>,
	target?: T,
	opts?: ObservableOptionsConfigure
): any {
	if (target) {
		return getObservableWithConfig(
			target,
			resolveGraph(opts?.graph),
			opts?.withDefaults ? withDefaultConfig(config) : config
		);
	} else {
		return {
			...propertyType.observable,
			configuration: config,
		};
	}
}

function observable<T extends object>(object: T, opts?: ObservableOptions): T;

function observable(target: any, propertyKey: string): any;

function observable<T>(...args: unknown[]): unknown {
	if (isPropertyKey(args[1])) {
		const [target, propertyKey] = args as [any, PropertyKey];

		const config = getCtorConfiguration(target.constructor);
		config[propertyKey] = propertyType.observable;

		return undefined;
	} else {
		const [object, opts] = args as [T, ObservableOptions];
		const primitive = !isNonPrimitive(object);
		if (primitive) {
			throw new Error(
				`observable is only for non primitive values. Got ${typeof object} instead. Use \`signal\` for primitive values.`
			);
		}

		return getObservable(object, resolveGraph(opts?.graph));
	}
}

Object.assign(observable, propertyType.observable);

observable.configure = observableConfigure;
observable.opts = getOpts(propertyType.observable);

export default observable as typeof observable & {
	configure: typeof observableConfigure;
	opts: typeof observable.opts;
} & typeof propertyType.observable;

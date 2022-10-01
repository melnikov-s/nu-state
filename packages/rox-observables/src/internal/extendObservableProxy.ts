import { getAdministration } from "./lookup";

type ExtendedProxyHandler<T extends object> = Partial<{
	[key in keyof ProxyHandler<T>]: ProxyHandler<T>[key] extends (
		...args: any[]
	) => any
		? (
				originalHandler: ProxyHandler<T>[key],
				...args: Parameters<ProxyHandler<T>[key]>
		  ) => ReturnType<ProxyHandler<T>[key]>
		: never;
}>;

export function extendObservableProxy<T extends object>(
	obj: T,
	handlers: ExtendedProxyHandler<T>
): T {
	const adm = getAdministration(obj);

	if (!adm) {
		throw new Error(
			"Passed in object to `extendObservableProxy` was not an observable"
		);
	}

	const proxyTraps = adm.proxyTraps as ProxyHandler<T>;

	Object.keys(handlers).forEach((key) => {
		const originalTrap = proxyTraps[key] ?? Reflect[key];

		proxyTraps[key] = (...args: any[]) => {
			return handlers[key](originalTrap, ...args);
		};
	});

	return obj;
}

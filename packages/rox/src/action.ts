import { runInAction } from "./graph";

export function action<T extends unknown[], U>(
	func: (...args: T) => U
): (...args: T) => U {
	return function (this: unknown, ...args: T): U {
		return runInAction(() => func.apply(this, args)) as U;
	};
}

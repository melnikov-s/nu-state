import { isNonPrimitive } from "../utils";
import { getObservable } from "../observables/utils/lookup";

export function observable<T extends object>(object: T): T {
	const primitive = !isNonPrimitive(object);
	if (primitive) {
		throw new Error(
			`observable is only for non primitive values. Got ${typeof object} instead. Use \`signal\` for primitive values.`
		);
	}

	return getObservable(object, false, false);
}

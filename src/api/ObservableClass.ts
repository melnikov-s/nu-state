import { getObservable } from "../observables/utils/lookup";

export class Observable {
	constructor() {
		return getObservable(this, true);
	}
}

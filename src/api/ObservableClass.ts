import { getObservableClassInstance } from "../observables/utils/lookup";

export class Observable {
	constructor() {
		return getObservableClassInstance(this);
	}
}

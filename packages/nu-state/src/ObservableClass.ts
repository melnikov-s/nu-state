import { getObservableClassInstance } from "nu-observables";
import { getGraph } from "./graph";

export class Observable {
	constructor() {
		return getObservableClassInstance(this, getGraph());
	}
}

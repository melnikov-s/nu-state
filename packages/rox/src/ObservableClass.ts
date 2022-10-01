import { getObservableClassInstance } from "rox-observables";
import { getGraph } from "./graph";

export class Observable {
	constructor() {
		return getObservableClassInstance(this, getGraph());
	}
}

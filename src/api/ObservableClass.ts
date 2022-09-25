import { Graph, resolveGraph } from "./graph";
import { getObservable } from "../observables/utils/lookup";

export class Observable {
	constructor(opts?: { graph?: Graph }) {
		return getObservable(this, resolveGraph(opts?.graph), true);
	}
}

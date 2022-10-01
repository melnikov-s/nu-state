export type { Graph } from "./internal/graph";
export { createGraph } from "./internal/graph";
export {
	getAdministration,
	getSource,
	isObservable,
	getObservable,
	getObservableClassInstance,
} from "./internal/lookup";
export { extendObservableProxy } from "./internal/extendObservableProxy";

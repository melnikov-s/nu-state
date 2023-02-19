import { Graph } from "./internal/graph";

export type { Graph } from "./internal/graph";
export { createGraph, hasGraphFeature } from "./internal/graph";
export {
	getAdministration,
	getSource,
	isObservable,
	getObservable,
	getObservableClassInstance,
	getInternalNode,
	setAdministrationType,
	createObservableWithCustomAdministration,
} from "./internal/lookup";
export { ArrayAdministration } from "./array";
export { CollectionAdministration } from "./collection";
export { DateAdministration } from "./date";
export { ObjectAdministration } from "./object";

let testGraph: Graph;
export function setTestGraph(graph: Graph): void {
	testGraph = graph;
}
export function getTestGraph(): Graph {
	return testGraph!;
}

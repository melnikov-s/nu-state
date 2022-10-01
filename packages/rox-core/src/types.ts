export const nodeTypes = {
	atom: 1,
	computed: 2,
	listener: 3,
} as const;

interface Observable {
	observers: Set<ObserverNode>;
}

interface Observer {
	observing: Set<ObservableNode>;
}

export interface Atom<T = unknown> extends Observable {
	nodeType: typeof nodeTypes.atom;
	equals(a: T): boolean;
}

export interface Computed<T = unknown> extends Observer, Observable {
	nodeType: typeof nodeTypes.computed;
	isKeepAlive(): boolean;
	clear(): void;
	value: T | null;
	equals(a: T): boolean;
}

export interface Listener extends Observer {
	nodeType: typeof nodeTypes.listener;
	react(): void;
}

export type ObserverNode = Computed | Listener;
export type ObservableNode = Computed | Atom;
export type Node = ObserverNode | ObservableNode;

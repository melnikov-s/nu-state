import { AtomNode } from "../core/nodes/atom";

export type Atom<T = unknown> = {
	reportChanged: (value?: T) => void;
	reportObserved: () => boolean;
};

export function atom<T = unknown>(opts?: {
	equals?: (v: T) => boolean;
}): Atom<T> {
	return new AtomNode(opts?.equals);
}

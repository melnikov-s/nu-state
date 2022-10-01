import { onReactionsComplete, batch } from "rox-core";
import { listener as makeListener, Listener } from "./listener";
import { reaction } from "./reaction";
import { effect } from "./effect";

export type Scheduler = {
	listener: (callback: () => void) => Listener;
	reaction: <T>(
		track: () => T,
		callback: (a: T, listener: Listener) => void
	) => () => void;
	effect: (callback: (t: Listener) => void) => () => void;
};

function schedule(
	scheduler: (reactions: ScheduledReactions) => void
): Scheduler {
	const reactions = new ScheduledReactions();
	let unsub: () => void;

	let isReacting = false;

	function applySchedule(
		callback: Function,
		effect: boolean = false
	): () => void {
		let ran = false;
		return (...args) => {
			if (effect && !ran) {
				callback();
			}

			ran = true;

			if (reactions.size === 0) {
				unsub = onReactionsComplete(() => {
					if (reactions.size > 0 && !isReacting) {
						try {
							// if a reaction causes further transactions we ignore those
							isReacting = true;
							scheduler(reactions);
						} finally {
							isReacting = false;
							reactions!.clear();
							unsub!();
						}
					}
				});
			}

			const listener = args[args.length - 1] as Listener;

			reactions.add(callback, listener, args);
		};
	}

	return {
		listener(callback: () => void) {
			return makeListener(applySchedule(callback));
		},
		reaction<T>(track: () => T, callback: (a: T, listener: Listener) => void) {
			return reaction(track, applySchedule(callback));
		},
		effect(callback: (t: Listener) => void) {
			return effect(applySchedule(callback, true));
		},
	};
}

class ScheduledReactions {
	private reactions: Set<Function> = new Set();
	private argsMap: WeakMap<Function, unknown[]> = new WeakMap();
	private listenerMap: WeakMap<Function, Listener> = new WeakMap();

	get size(): number {
		return this.reactions.size;
	}

	add(callback: Function, listener: Listener, args: unknown[]): void {
		this.reactions.add(callback);
		this.argsMap.set(callback, args);
		this.listenerMap.set(callback, listener);
	}

	merge(r: ScheduledReactions): void {
		r.reactions.forEach((reaction) => {
			this.reactions.add(reaction);
			this.argsMap.set(reaction, r.argsMap.get(reaction)!);
			this.listenerMap.set(reaction, r.listenerMap.get(reaction)!);
		});
	}

	flush(): void {
		batch(() => {
			try {
				this.reactions.forEach((reaction) => {
					const args = this.argsMap.get(reaction) ?? [];
					const listener = this.listenerMap.get(reaction)!;
					!listener.isDisposed && reaction(...args);
				});
			} finally {
				this.reactions.clear();
			}
		});
	}

	clear(): void {
		this.reactions.clear();
	}
}

export function createScheduler(
	scheduler: (fn: () => void) => void
): Scheduler {
	const reactions = new ScheduledReactions();

	return schedule((newReactions: ScheduledReactions) => {
		if (reactions.size === 0) {
			reactions.merge(newReactions);
			scheduler(() => {
				reactions.flush();
			});
		} else {
			reactions.merge(newReactions);
		}
	});
}

export function createMicroTaskScheduler(): Scheduler {
	return createScheduler(queueMicrotask);
}

export function createAnimationScheduler(): Scheduler {
	return createScheduler(requestAnimationFrame);
}

import {
	effect,
	isObservable,
	enforceActions,
	Observable,
	isInAction,
} from "../src/main";

afterEach(() => {
	enforceActions(false);
});

test("objects created from class return `false` from `isObservable`", () => {
	class C extends Observable {}

	const o = new C();
	expect(isObservable(o)).toBe(false);
});

test("objects create from class have observable properties", () => {
	class C extends Observable {
		value = "prop";
	}

	const o = new C();
	let count = 0;

	effect(() => {
		o.value;
		count++;
	});

	o.value = "newProp";
	expect(count).toBe(2);
});

test("object methods return a value", () => {
	class C extends Observable {
		value = "prop";

		readValue() {
			return this.value;
		}
	}

	const o = new C();
	expect(o.readValue()).toBe("prop");
});

test("object methods occur in an action ", () => {
	enforceActions(true);
	class C extends Observable {
		valueA = 0;
		valueB = 0;

		inc() {
			this.valueA++;
			this.valueB++;
			expect(isInAction()).toBe(true);
		}
	}

	const o = new C();
	let count = 0;

	effect(() => {
		o.valueA;
		o.valueB;
		count++;
	});

	o.inc();
	expect(count).toBe(2);
});

test("object methods are observable", () => {
	class C extends Observable {
		value = "prop";

		readValue() {
			return this.value;
		}
	}

	const o = new C();
	let count = 0;

	effect(() => {
		o.readValue();
		count++;
	});

	o.value = "newProp";
	expect(count).toBe(2);
});

test("object setters occur in an action", () => {
	enforceActions(true);
	class C extends Observable {
		valueA = 0;
		valueB = 0;

		set values(v: number) {
			this.valueA = v;
			this.valueB = v;
			expect(isInAction()).toBe(true);
		}
	}

	const o = new C();
	let count = 0;

	effect(() => {
		o.valueA;
		o.valueB;
		count++;
	});

	o.values = 1;
	expect(count).toBe(2);
});

test("object getters and setters on same property", () => {
	enforceActions(true);
	class C extends Observable {
		valueA = 0;
		valueB = 0;

		get values() {
			return this.valueA + this.valueB;
		}

		set values(v: number) {
			this.valueA = v;
			this.valueB = v;
			expect(isInAction()).toBe(true);
		}
	}

	const o = new C();
	let count = 0;

	effect(() => {
		o.values;
		count++;
	});

	o.values = 1;
	expect(count).toBe(2);
});

test("object getters return a value", () => {
	class C extends Observable {
		value = "prop";

		get readValue() {
			return this.value;
		}
	}

	const o = new C();
	expect(o.readValue).toBe("prop");
});

test("object getters are observable", () => {
	class C extends Observable {
		value = "prop";

		get readValue() {
			return this.value;
		}
	}

	const o = new C();
	let count = 0;

	effect(() => {
		o.readValue;
		count++;
	});

	o.value = "newProp";
	expect(count).toBe(2);
});

test("can have properties that are Promise", async () => {
	class C extends Observable {
		value = Promise.resolve(42);
	}

	const o = new C();
	const v = await o.value;
	expect(v).toBe(42);
});

test("instanceof operator on observable class and object", () => {
	class C extends Observable {}
	const c = new C();
	expect(c).toBeInstanceOf(C);
});

test("constructor has observable instance", () => {
	const weakSet = new WeakSet();

	class C extends Observable {
		constructor() {
			super();
			weakSet.add(this);
		}
		prop = {};
		arrowFunc = () => {
			expect(isObservable(this.prop)).toBe(true);
		};
	}

	const c = new C();
	c.arrowFunc();
	expect(weakSet.has(c)).toBe(true);
	expect.assertions(2);
});

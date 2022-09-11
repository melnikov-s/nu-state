import { observable } from "../src/main";

test("can't observe primitive values", () => {
	expect(() => observable(1 as any)).toThrowError();
	expect(() => observable("" as any)).toThrowError();
	expect(() => observable(false as any)).toThrowError();
	expect(() => observable(Symbol() as any)).toThrowError();
});
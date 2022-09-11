import Administration, { getAdministration } from "./utils/Administration";
import Graph from "../core/graph";

export class DateAdministration extends Administration<Date> {
	constructor(source: Date, graph: Graph) {
		super(source, graph);
		this.proxyTraps.get = (_, name: keyof Date) => this.proxyGet(name);
	}

	private proxyGet(name: keyof Date): unknown {
		if (typeof this.source[name] === "function") {
			if (typeof name === "string" && name.startsWith("set")) {
				addDateSetMethod(name);
			} else {
				addDateGetMethod(name);
			}

			return dateMethods[name];
		}

		return this.source[name];
	}
}

const dateMethods = Object.create(null);

function addDateSetMethod(method: PropertyKey): void {
	if (!dateMethods[method])
		dateMethods[method] = function (this: Date): unknown {
			const adm = getAdministration(this)! as Administration<Date>;
			const res = adm.source[method].apply(adm.source, arguments);
			adm.atom.reportChanged();
			return res;
		};
}

function addDateGetMethod(method: PropertyKey): void {
	if (!dateMethods[method])
		dateMethods[method] = function (this: Date): unknown {
			const adm = getAdministration(this)! as Administration<Date>;
			adm.atom.reportObserved();
			return adm.source[method].apply(adm.source, arguments);
		};
}

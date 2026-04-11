import { Electroview } from "electrobun/view";
import { rpc } from "./events";

export const electroview = new Electroview({ rpc: rpc });

if (!electroview.rpc) {
	throw new Error("RPC not configured");
}

// Вызвать функцию bun из browser:
electroview.rpc.request.someBunFunction({ a: 9, b: 8 }).then((result) => {
	console.log("result: ", result);
});

// Отправить сообщение:
electroview.rpc.send.logToBun({ msg: "hi from browser" });

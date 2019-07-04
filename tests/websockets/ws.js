const WSClient = require("../../lib/client/ws.js");

const ws = new WSClient({ url: "wss://echo.websocket.org" });

ws.onConnection().then((event) => {
  ws.request().send("test", []);
});

console.log("working");

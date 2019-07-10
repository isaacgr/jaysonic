const WSClient = require("../../lib/client/ws.js");

const ws = new WSClient({ url: "ws://127.0.0.1:8100", delimiter: "\r\n" });

ws.onConnection().then((event) => {
  ws.request()
    .send("get_config", {})
    .then((response) => {
      console.log(response);
    });
});

console.log("working");

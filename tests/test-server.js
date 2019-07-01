const Jaysonic = require("../src");
const data = require("./large-data.json");

const server = new Jaysonic.server.tcp({ host: "127.0.0.1", port: 8100 });
const serverV1 = new Jaysonic.server.tcp({
  host: "127.0.0.1",
  port: 8600,
  version: 1
});

const serverHttp = new Jaysonic.server.http({
  host: "127.0.0.1",
  port: 8800
});

server.method("add", ([a, b]) => a + b);
server.method("greeting", ({ name }) => `Hello ${name}`);
server.method("typeerror", ([a]) => {
  if (typeof a === "number") {
    throw new TypeError();
  }
});
server.method("large.data", () => data);
serverHttp.method("large.data", () => data);

serverHttp.method("add", ([a, b]) => a + b);
serverHttp.method("greeting", ({ name }) => `Hello ${name}`);
serverHttp.method("typeerror", ([a]) => {
  if (typeof a === "number") {
    throw new TypeError();
  }
});

serverV1.method("add", ([a, b]) => a + b);

server.onNotify("noitify", () => "notification");

module.exports = { server, serverHttp, serverV1 };

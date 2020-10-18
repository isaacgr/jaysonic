const fs = require("fs");
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
const serverHttps = new Jaysonic.server.http({
  host: "127.0.0.1",
  port: 8801,
  scheme: "https",
  key: fs.readFileSync("tests/key.pem"),
  cert: fs.readFileSync("tests/server.crt"),
  ca: "selfSignedRootCaPemCrtBuffer"
});
const wss = new Jaysonic.server.ws({ port: 8900 });

// TCP Server
server.method("add", ([a, b]) => a + b);
server.method("greeting", ({ name }) => `Hello ${name}`);
server.method("typeerror", ([a]) => {
  if (typeof a === "number") {
    throw new TypeError();
  }
});
server.method("unknownerror", ([a]) => {
  if (typeof a === "number") {
    throw new Error();
  }
});
server.method("large.data", () => data);
server.onNotify("noitify", () => "notification");

// HTTP Server
serverHttp.method("large.data", () => data);
serverHttp.method("add", ([a, b]) => a + b);
serverHttp.method("greeting", ({ name }) => `Hello ${name}`);
serverHttp.method("typeerror", ([a]) => {
  if (typeof a === "number") {
    throw new TypeError();
  }
});
serverHttp.method("unknownerror", ([a]) => {
  if (typeof a === "number") {
    throw new Error();
  }
});

// HTTPS Server
serverHttps.method("large.data", () => data);
serverHttps.method("add", ([a, b]) => a + b);
serverHttps.method("greeting", ({ name }) => `Hello ${name}`);
serverHttps.method("typeerror", ([a]) => {
  if (typeof a === "number") {
    throw new TypeError();
  }
});
serverHttps.method("unknownerror", ([a]) => {
  if (typeof a === "number") {
    throw new Error();
  }
});

// Websocket server
wss.method("add", ([a, b]) => a + b);
wss.method("greeting", ({ name }) => `Hello ${name}`);
wss.method("typeerror", ([a]) => {
  if (typeof a === "number") {
    throw new TypeError();
  }
});
wss.method("unknownerror", ([a]) => {
  if (typeof a === "number") {
    throw new Error();
  }
});
wss.method("large.data", () => data);
wss.onNotify("noitify", () => "notification");

// V1 TCP Server
serverV1.method("add", ([a, b]) => a + b);

module.exports = {
  server,
  serverHttp,
  serverHttps,
  serverV1,
  wss
};

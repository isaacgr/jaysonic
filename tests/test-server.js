const fs = require("fs");
const Jaysonic = require("../src");
const data = require("./large-data.json");

/**
 * Servers
 */
const server = new Jaysonic.server.tcp();
const serverV1 = new Jaysonic.server.tcp({
  version: 1
});
const serverHttp = new Jaysonic.server.http();
const serverHttpV1 = new Jaysonic.server.http({ version: 1 });
const serverHttps = new Jaysonic.server.http({
  scheme: "https",
  ssl: {
    key: fs.readFileSync("tests/key.pem"),
    cert: fs.readFileSync("tests/server.crt"),
    ca: "selfSignedRootCaPemCrtBuffer"
  }
});
const wss = new Jaysonic.server.ws();

/**
 * Methods
 */
// TCP Server
server.method("params", ([a, b]) => a + b);
server.method("named.params", ({ name }) => `Hello ${name}`);
server.method("type.error", ([a]) => {
  if (typeof a === "number") {
    throw new TypeError();
  }
});
server.method("unknown.error", ([a]) => {
  if (typeof a === "number") {
    throw new Error();
  }
});
server.method("large.data", () => data);
server.onNotify("notify", () => "notification");

// HTTP Server
serverHttp.method("large.data", () => data);
serverHttp.method("params", ([a, b]) => a + b);
serverHttp.method("named.params", ({ name }) => `Hello ${name}`);
serverHttp.method("type.error", ([a]) => {
  if (typeof a === "number") {
    throw new TypeError();
  }
});
serverHttp.method("unknown.error", ([a]) => {
  if (typeof a === "number") {
    throw new Error();
  }
});

// HTTP V1 Server
serverHttpV1.method("large.data", () => data);
serverHttpV1.method("params", ([a, b]) => a + b);
serverHttpV1.method("named.params", ({ name }) => `Hello ${name}`);
serverHttpV1.method("type.error", ([a]) => {
  if (typeof a === "number") {
    throw new TypeError();
  }
});
serverHttpV1.method("unknown.error", ([a]) => {
  if (typeof a === "number") {
    throw new Error();
  }
});

// HTTPS Server
serverHttps.method("large.data", () => data);
serverHttps.method("params", ([a, b]) => a + b);
serverHttps.method("named.params", ({ name }) => `Hello ${name}`);
serverHttps.method("type.error", ([a]) => {
  if (typeof a === "number") {
    throw new TypeError();
  }
});
serverHttps.method("unknown.error", ([a]) => {
  if (typeof a === "number") {
    throw new Error();
  }
});

// Websocket server
wss.method("params", ([a, b]) => a + b);
wss.method("named.params", ({ name }) => `Hello ${name}`);
wss.method("type.error", ([a]) => {
  if (typeof a === "number") {
    throw new TypeError();
  }
});
wss.method("unknown.error", ([a]) => {
  if (typeof a === "number") {
    throw new Error();
  }
});
wss.method("large.data", () => data);
wss.onNotify("notify", () => "notification");

// V1 TCP Server
serverV1.method("params", ([a, b]) => a + b);

module.exports = {
  server,
  serverHttp,
  serverHttps,
  serverV1,
  wss,
  serverHttpV1
};

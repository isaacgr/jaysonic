const Jaysonic = require("../src/");

const server = new Jaysonic.server.tcp({ host: "127.0.0.1", port: 8100 });

server.method("add", ([a, b]) => {
  return a + b;
});

server.method("greeting", ({ name }) => {
  return `Hello ${name}`;
});

server.method("typeerror", ([]) => {
  throw new TypeError();
});

module.exports = server;

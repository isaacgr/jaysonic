const net = require("net");
const Jaysonic = require("../src");

const client = new Jaysonic.client.tcp({ host: "127.0.0.1", port: 6969 });
const clienthttp = new Jaysonic.client.http({ host: "127.0.0.1", port: 8000 });
const socket = new net.Socket();
const sock = new net.Socket();
const clientws = new Jaysonic.client.ws({ url: "ws://127.0.0.1:9000" });
const wstest = new window.WebSocket("ws://127.0.0.1:9000");

module.exports = {
  client,
  clienthttp,
  socket,
  sock,
  clientws,
  wstest
};

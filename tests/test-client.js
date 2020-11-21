const net = require("net");
const Jaysonic = require("../src");
const WebSocket = require("../src/client-ws");

const client = new Jaysonic.client.tcp();
const clienthttp = new Jaysonic.client.http();
const socket = new net.Socket();
const socketV1 = new net.Socket();

const sock = new net.Socket();
const clientws = new WebSocket.wsclient();

module.exports = {
  client,
  clienthttp,
  socket,
  socketV1,
  sock,
  clientws
};

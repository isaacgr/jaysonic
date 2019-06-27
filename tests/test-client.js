const net = require("net");
const Jayson = require("../src");

const client = new Jayson.client.tcp({ host: "127.0.0.1", port: 6969 });
// const clienthttp = new Jayson.client.http({ host: "127.0.0.1", port: 8000 });
const socket = new net.Socket();
const sock = new net.Socket();

module.exports = { client, socket, sock };

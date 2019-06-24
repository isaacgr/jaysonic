const net = require("net");
const Jayson = require("../src");

const client = new Jayson.client.tcp({ host: "127.0.0.1", port: 6969 });
const socket = new net.Socket();
const sock = new net.Socket();
// client.connect().then(() => {});

// for (let i = 0; i < 20; i++) {
//   client
//     .request("add", [1, 2])
//     .then((result) => {
//       console.log(result);
//     })
//     .catch((error) => {
//       console.log(error);
//     });
//   client
//     .request("greeting", { name: "Isaac" })
//     .then((result) => {
//       console.log(result);
//     })
//     .catch((error) => {
//       console.log(error);
//     });
// }

module.exports = { client, socket, sock };

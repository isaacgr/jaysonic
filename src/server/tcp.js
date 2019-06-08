const Server = require(".");
const _ = require("lodash");
const net = require("net");

/**
 * Constructor for Jsonic TCP client
 * @class TCPClient
 * @constructor
 * @extends Client
 * @param {Object} [options] optional settings for client
 * @return TCPClient
 */

class TCPServer extends Server {
  constructor(options) {
    super(options);
    this.initServer();
  }
  initServer() {
    this.server = new net.Server();
  }

  handleData() {
    this.server.on("connection", client => {
      client.on("data", data => {
        this.messageBuffer += data;
        const messages = this.messageBuffer.split(this.options.delimiter);
        for (let chunk of messages) {
          if (chunk === "") {
            continue;
          }
          const validRequest = () =>
            this.validateRequest(chunk)
              .then(result => {
                return result;
              })
              .catch(error => {
                throw new Error(JSON.stringify(error));
              });

          validRequest()
            .then(result => {
              this.getResult(result.json).then(result => {
                client.write(result);
                client.pipe(client);
              });
            })
            .catch(error => {
              client.write(error["message"] + "\r\n");
              client.pipe(client);
            });
        }
      });
    });
  }
}

module.exports = TCPServer;

const Client = require(".");
const net = require("net");

/**
 * Constructor for Jsonic TCP client
 * @class TCPClient
 * @constructor
 * @extends Client
 * @param {Object} [options] optional settings for client
 * @return TCPClient
 */

class TCPClient extends Client {
  connect() {
    return new Promise((resolve, reject) => {
      if (this.attached) {
        reject(Error("client already connected"));
      }
      this.client = new net.Socket();
      this.client.connect(this.server);
      this.client.setEncoding("utf8");
      this.client.on("connect", () => {
        this.attached = true;
        this.writer = this.client;
        /**
         * start listeners, response handlers and error handlers
         */
        this.listen();
        this.handleResponse();
        this.handleError();
        resolve(this.server);
      });
      this.client.on("error", (error) => {
        reject(error);
      });
    });
  }
  subscribe(method, cb) {
    /**
     * @params {String} [method] method to subscribe to
     * @params {Function} [cb] callback function to invoke on notify
     */
    this.on("notify", (message) => {
      if (message.method === method) {
        cb(message);
      }
    });
  }
  notify(notification) {
    const { method, params } = notification;
    return this.request().send(method, params);
  }
}

module.exports = TCPClient;

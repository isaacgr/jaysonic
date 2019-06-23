const Client = require('.');

/**
 * Constructor for Jsonic TCP client
 * @class TCPClient
 * @constructor
 * @extends Client
 * @param {Object} [options] optional settings for client
 * @return TCPClient
 */

class TCPClient extends Client {
  subscribe(method, cb) {
    /**
     * @params {String} [method] method to subscribe to
     * @params {Function} [cb] callback function to invoke on notify
     */
    this.on('notify', (message) => {
      if (message.method === method) {
        cb(message);
      }
    });
  }
}

module.exports = TCPClient;

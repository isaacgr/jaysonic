const net = require("net");
const Client = require(".");
const _ = require("lodash");
const { formatRequest } = require("../functions");
const { ERR_CODES, ERR_MSGS } = require("../constants");

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

  request() {
    return {
      message: (method, params) => {
        const request = formatRequest({
          method,
          params,
          id: this.message_id,
          options: this.options
        });
        this.message_id += 1;
        return request;
      },

      send: (method, params) =>
        new Promise((resolve, reject) => {
          const requestId = this.message_id;
          this.pendingCalls[requestId] = { resolve, reject };
          this.client.write(this.request().message(method, params));
          setTimeout(() => {
            if (this.pendingCalls[requestId]) {
              const error = this.sendError({
                id: requestId,
                code: ERR_CODES.timeout,
                message: ERR_MSGS.timeout
              });
              delete this.pendingCalls[requestId];
              reject(error);
            }
          }, this.options.timeout);
        }),
      notify: (method, params) => {
        const request = formatRequest({
          method,
          params,
          options: this.options
        });
        return new Promise((resolve, reject) => {
          this.client.write(request, () => {
            resolve("notification sent");
          });
          this.client.on("error", (error) => {
            reject(error);
          });
        });
      }
    };
  }

  batch(requests) {
    /**
     * should receive a list of request objects
     * [client.request.message(), client.request.message()]
     * send a single request with that, server should handle it
     *
     * We want to store the IDs for the requests in the batch in an array
     * Use this to reference the batch response
     * The spec has no explaination on how to do that, so this is the solution
     */

    return new Promise((resolve, reject) => {
      let batchIds = [];
      for (let request of requests) {
        const json = JSON.parse(request);
        if (json.id) {
          batchIds.push(json.id);
        }
      }
      this.pendingBatches[String(batchIds)] = { resolve, reject };

      const request = JSON.stringify(requests);
      this.client.write(request);
      this.on("batchResponse", (batch) => {
        let batchResponseIds = [];
        batch.forEach((message) => {
          if (message.error) {
            // reject the whole message if there are any errors
            console.log(message);
            reject(batch);
          }
          if (message.id) {
            batchResponseIds.push(message.id);
          }
        });
        if (_.isEmpty(batchResponseIds)) {
          resolve([]);
        }
        for (let ids of Object.keys(this.pendingBatches)) {
          if (
            _.isEmpty(
              _.difference(JSON.parse("[" + ids + "]"), batchResponseIds)
            )
          ) {
            this.pendingBatches[ids].resolve(batch);
          }
        }
      });
      this.on("batchError", (error) => {
        console.log(error);
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
}

module.exports = TCPClient;

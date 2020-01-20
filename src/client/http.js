const http = require("http");
const Client = require(".");
const { formatRequest, formatError } = require("../functions");
const { ERR_CODES, ERR_MSGS } = require("../constants");

/**
 * Constructor for Jsonic HTTP client
 * @class HTTPClient
 * @constructor
 * @extends Client
 * @param {Object} [options] optional settings for client
 * @return HTTPClient
 */
class HTTPClient extends Client {
  constructor(server, options) {
    super(server, options);

    // the content length will be calculated on a per request basis
    // according to the node http docs:
    // the encoding argument is optional and only applies when chunk is a string.
    // Defaults to 'utf8'.
    const defaults = {
      host: this.server.host,
      port: this.server.port || 80,
      encoding: "utf-8",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json"
      },
      path: "/"
    };
    this.options = {
      ...defaults,
      ...(this.options || {})
    };
  }

  initClient() {
    this.client = http.request(this.options, (response) => {
      this.writer = response;
      this.listen();
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

      send: (method, params) => new Promise((resolve, reject) => {
        const requestId = this.message_id;
        this.pendingCalls[requestId] = { resolve, reject };
        const request = this.request().message(method, params);
        this.options.headers["Content-Length"] = Buffer.byteLength(
          request,
          this.options.encoding
        );
        this.initClient();
        try {
          this.client.write(request, this.options.encoding);
          this.client.end();
          this.client.on("error", (error) => {
            reject(error);
          });
        } catch (e) {
          reject(e);
        }

        setTimeout(() => {
          if (this.pendingCalls[requestId] === undefined) {
            const error = formatError({
              jsonrpc: this.options.version,
              delimiter: this.options.delimiter,
              id: requestId,
              code: ERR_CODES.unknownId,
              message: ERR_MSGS.unknownId
            });
            return reject(error);
          }
          const error = formatError({
            jsonrpc: this.options.version,
            delimiter: this.options.delimiter,
            id: null,
            code: ERR_CODES.timeout,
            message: ERR_MSGS.timeout
          });
          delete this.pendingCalls[requestId];
          reject(error);
        }, this.options.timeout);
      }),

      /**
       * The spec for HTTP notifications states a 204 error response with an empty body
       * Want to provide a promise response for users to know notification was received
       * or rejected by server
       */
      notify: (method, params) => {
        const request = formatRequest({
          method,
          params,
          options: this.options
        });
        return new Promise((resolve, reject) => {
          this.options.headers["Content-Length"] = Buffer.byteLength(
            request,
            this.options.encoding
          );
          const notification = http.request(this.options, (response) => {
            if (response.statusCode === 204) {
              resolve(response);
            } else {
              reject(new Error("no response receieved for notification"));
            }
          });
          try {
            notification.write(request, this.options.encoding);
            notification.end();
            notification.on("error", (error) => {
              reject(error);
            });
          } catch (e) {
            reject(e);
          }
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
      const batchIds = [];
      const batchRequests = [];
      for (const request of requests) {
        const json = JSON.parse(request);
        batchRequests.push(json);
        if (json.id) {
          batchIds.push(json.id);
        }
      }
      this.pendingBatches[String(batchIds)] = { resolve, reject };

      const request = JSON.stringify(batchRequests) + this.options.delimiter;
      this.options.headers["Content-Length"] = Buffer.byteLength(
        request,
        this.options.encoding
      );
      this.initClient();
      try {
        this.client.write(request, this.options.encoding);
        this.client.end();
        this.client.on("error", (error) => {
          reject(error);
        });
      } catch (e) {
        reject(e);
      }
      setTimeout(() => {
        if (this.pendingBatches[String(batchIds)] === undefined) {
          const error = formatError({
            jsonrpc: this.options.version,
            delimiter: this.options.delimiter,
            id: null,
            code: ERR_CODES.unknownId,
            message: ERR_MSGS.unknownId
          });
          return reject(error);
        }
        const error = formatError({
          jsonrpc: this.options.version,
          delimiter: this.options.delimiter,
          id: null,
          code: ERR_CODES.timeout,
          message: ERR_MSGS.timeout
        });
        delete this.pendingBatches[String(batchIds)];
        reject(error);
      }, this.options.timeout);
      this.on("batchResponse", (batch) => {
        const batchResponseIds = [];
        batch.forEach((message) => {
          if (message.id) {
            batchResponseIds.push(message.id);
          } else {
            // assume notification in the batch
            this.emit(message.method, { detail: message });
          }
        });
        if (batchResponseIds.length === 0) {
          resolve([]);
        }
        for (const ids of Object.keys(this.pendingBatches)) {
          const arrays = [JSON.parse(`[${ids}]`), batchResponseIds];
          const difference = arrays.reduce((a, b) => a.filter(c => !b.includes(c)));
          if (difference.length === 0) {
            const response = {
              body: batch,
              ...this.writer
            };
            batch.forEach((message) => {
              if (message.error) {
                // reject the whole message if there are any errors
                if (this.pendingBatches[ids] !== undefined) {
                  this.pendingBatches[ids].reject(response);
                  delete this.pendingBatches[ids];
                }
              }
            });
            if (this.pendingBatches[ids] !== undefined) {
              this.pendingBatches[ids].resolve(response);
              delete this.pendingBatches[ids];
            }
          }
        }
      });
      this.on("batchError", (error) => {
        reject(error);
      });
    });
  }
}

module.exports = HTTPClient;

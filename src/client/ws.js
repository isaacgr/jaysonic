const WebSocket = require("ws");
const Client = require(".");
const { formatRequest, formatError } = require("../functions");
const { ERR_CODES, ERR_MSGS } = require("../constants");
const { MessageBuffer } = require("../buffer");

class WSClient extends Client {
  constructor(options) {
    super();
    if (!(this instanceof WSClient)) {
      return new WSClient(options);
    }

    const defaults = {
      url: "ws://127.0.0.1:8100",
      version: "2.0",
      delimiter: "\n",
      timeout: 30,
      retries: 2
    };

    this.message_id = 1;
    this.serving_message_id = 1;
    this.pendingCalls = {};
    this.pendingBatches = {};
    this.attached = false;

    this.responseQueue = {};
    this.options = {
      ...defaults,
      ...(options || {})
    };
    this.options.timeout = this.options.timeout * 1000;

    this.messageBuffer = new MessageBuffer(this.options.delimiter);
    const { retries } = this.options;
    this.remainingRetries = retries;
  }

  connect() {
    return new Promise((resolve, reject) => {
      const { url, perMessageDeflate } = this.options;
      this.client = new WebSocket(url, perMessageDeflate);
      this.close();
      this.listen();
      this.client.onopen = (event) => {
        resolve(event);
      };
      this.client.onerror = (error) => {
        reject(error);
      };
    });
  }

  close() {
    this.client.onclose = () => {
      if (this.remainingRetries) {
        this.remainingRetries -= 1;
        process.stdout.write(
          `Connection failed. ${this.remainingRetries} attempts left.\n`
        );
        setTimeout(() => {
          this.connect().catch(() => {});
        }, this.options.timeout);
      }
    };
  }

  listen() {
    this.client.onmessage = (message) => {
      this.handleData(message.data);
    };
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
        try {
          this.client.send(this.request().message(method, params));
        } catch (e) {
          reject(e);
        }
        setTimeout(() => {
          try {
            const error = formatError({
              jsonrpc: this.options.version,
              delimiter: this.options.delimiter,
              id: null,
              code: ERR_CODES.timeout,
              message: ERR_MSGS.timeout
            });
            this.pendingCalls[requestId].reject(error);
            delete this.pendingCalls[requestId];
          } catch (e) {
            if (e instanceof TypeError) {
              // probably a parse error, which might not have an id
              process.stdout.write(
                `Message has no outstanding calls: ${JSON.stringify(e)}\n`
              );
            }
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
          try {
            this.client.send(request);
            resolve("notification sent");
            this.client.onerror = (error) => {
              reject(error);
            };
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
      const request = JSON.stringify(batchRequests);
      try {
        this.client.send(request + this.options.delimiter);
      } catch (e) {
        // this.client is probably undefined
        reject(e.message);
      }
      setTimeout(() => {
        try {
          const error = formatError({
            jsonrpc: this.options.version,
            delimiter: this.options.delimiter,
            id: null,
            code: ERR_CODES.timeout,
            message: ERR_MSGS.timeout
          });
          this.pendingBatches[String(batchIds)].reject(error);
          delete this.pendingBatches[String(batchIds)];
        } catch (e) {
          if (e instanceof TypeError) {
            // probably a parse error, which might not have an id
            process.stdout.write(
              `Message has no outstanding calls: ${JSON.stringify(e)}\n`
            );
          }
        }
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
            batch.forEach((message) => {
              if (message.error) {
                // reject the whole message if there are any errors
                try {
                  this.pendingBatches[ids].reject(batch);
                  delete this.pendingBatches[ids];
                } catch (e) {
                  if (e instanceof TypeError) {
                    // probably a parse error, which might not have an id
                  }
                }
              }
            });
            try {
              this.pendingBatches[ids].resolve(batch);
              delete this.pendingBatches[ids];
            } catch (e) {
              if (e instanceof TypeError) {
                // probably a parse error, which might not have an id
              }
            }
          }
        }
      });
      this.on("batchError", (error) => {
        reject(error);
      });
    });
  }

  /**
   * @params {String} [method] method to subscribe to
   * @params {Function} [cb] callback function to invoke on notify
   */
  subscribe(method, cb) {
    this.on(method, cb);
  }

  /**
   * @params {String} [method] method to unsubscribe from
   * @params {Function} [cb] name of function to remove
   */
  unsubscribe(method, cb) {
    this.removeListener(method, cb);
  }

  /**
   * @params {String} [method] method to unsubscribe all listeners from
   */
  unsubscribeAll(method) {
    this.removeAllListeners([method]);
  }
}

module.exports = WSClient;

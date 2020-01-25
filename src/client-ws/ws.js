/* eslint no-console: 0 */
const { formatRequest, formatError } = require("../functions");
const { ERR_CODES, ERR_MSGS } = require("../constants");
const { MessageBuffer } = require("../buffer");

class WSClient extends EventTarget {
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
      const { url, protocols } = this.options;
      this.client = new window.WebSocket(url, protocols);
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
        console.log(
          `Connection failed. ${this.remainingRetries} attempts left.`
        );
        setTimeout(() => {
          this.connect().catch(() => {});
        }, this.options.timeout);
      } else {
        console.log("Connection to server failed.");
      }
    };
  }

  listen() {
    this.client.onmessage = (message) => {
      this.handleData(message.data);
    };
  }

  verifyData(chunk) {
    try {
      // will throw an error if not valid json
      const message = JSON.parse(chunk);
      if (Array.isArray(message)) {
        // possible batch request
        try {
          this.dispatchEvent(
            new CustomEvent("batchResponse", { detail: message })
          );
        } catch (e) {
          const error = formatError({
            jsonrpc: this.options.version,
            id: null,
            code: ERR_CODES.parseError,
            message: ERR_MSGS.parseError,
            delimiter: this.options.delimiter
          });
          this.dispatchEvent(new CustomEvent("batchError", { detail: error }));
        }
      } else if (!(message === Object(message))) {
        // error out if it cant be parsed
        const error = formatError({
          jsonrpc: this.options.version,
          delimiter: this.options.delimiter,
          id: null,
          code: ERR_CODES.parseError,
          message: ERR_MSGS.parseError
        });
        throw new Error(error);
      } else if (!message.id) {
        // no id, so assume notification
        this.dispatchEvent(
          new CustomEvent(message.method, { detail: message })
        );
      } else if (message.error) {
        // got an error back so reject the message
        const error = formatError({
          jsonrpc: this.options.version,
          delimiter: this.options.delimiter,
          id: message.id,
          code: message.error.code,
          message: message.error.message
        });
        throw new Error(error);
      } else if (!message.method) {
        // no method, so assume response
        this.serving_message_id = message.id;
        this.responseQueue[this.serving_message_id] = message;
        this.handleResponse(this.serving_message_id);
      } else {
        const error = formatError({
          jsonrpc: this.options.version,
          delimiter: this.options.delimiter,
          id: null,
          code: ERR_CODES.unknown,
          message: ERR_MSGS.unknown
        });
        throw new Error(error);
      }
    } catch (e) {
      if (e instanceof SyntaxError) {
        const error = formatError({
          jsonrpc: this.options.version,
          delimiter: this.options.delimiter,
          id: this.serving_message_id,
          code: ERR_CODES.parseError,
          message: `Unable to parse message: '${chunk}'`
        });
        throw new Error(error);
      } else {
        throw e;
      }
    }
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
              console.log(
                `Message has no outstanding calls: ${JSON.stringify(e)}`
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
            console.log(
              `Message has no outstanding calls: ${JSON.stringify(e)}`
            );
          }
        }
      }, this.options.timeout);
      this.addEventListener("batchResponse", ({ detail }) => {
        const batch = detail;
        const batchResponseIds = [];
        batch.forEach((message) => {
          if (message.id) {
            batchResponseIds.push(message.id);
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
      this.addEventListener("batchError", ({ detail }) => {
        reject(detail);
      });
    });
  }

  handleResponse(id) {
    try {
      const response = this.responseQueue[id];
      this.pendingCalls[id].resolve(response);
      delete this.responseQueue[id];
    } catch (e) {
      if (e instanceof TypeError) {
        // probably a parse error, which might not have an id
        console.log(`Message has no outstanding calls: ${JSON.stringify(e)}`);
      }
    }
  }

  handleData(data) {
    this.messageBuffer.push(data);
    while (!this.messageBuffer.isFinished()) {
      const message = this.messageBuffer.handleData();
      try {
        this.verifyData(message);
      } catch (e) {
        this.handleError(JSON.parse(e.message));
      }
    }
  }

  handleError(error) {
    const response = error;
    try {
      this.pendingCalls[error.id].reject(response);
    } catch (e) {
      if (e instanceof TypeError) {
        // probably a parse error, which might not have an id
        console.log(
          `Message has no outstanding calls: ${JSON.stringify(error)}`
        );
      }
    }
  }

  /**
   * @params {String} [method] method to subscribe to
   * @params {Function} [cb] callback function to invoke on notify
   */
  subscribe(method, cb) {
    this.addEventListener(method, ({ detail }) => {
      try {
        cb(null, detail);
      } catch (e) {
        cb(e);
      }
    });
  }

  /**
   * @params {String} [method] method to unsubscribe from
   * @params {Function} [cb] name of function to remove
   */
  unsubscribe(method, cb) {
    this.removeEventListener(method, cb);
  }
}

module.exports = WSClient;

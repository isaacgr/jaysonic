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
    this.timeouts = {};

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

  initialize() {
    const { url, protocols } = this.options;
    this.client = new window.WebSocket(url, protocols);
    this.client.onopen = (event) => {
      this.listen();
      this.connectionHandler.resolve(event);
    };
    this.client.onerror = (error) => {
      // let the onclose event handle it otherwise
      if (error.error.code !== "ECONNREFUSED") {
        this.connectionHandler.reject(error);
      }
    };
    this.client.onclose = () => {
      if (this.client.__clientClosed) {
        console.log("Connection closed.");
      } else if (this.remainingRetries) {
        this.remainingRetries -= 1;
        console.log(
          `Connection failed. ${this.remainingRetries} attempts left.`
        );
        setTimeout(() => {
          this.initialize();
        }, 5000);
      } else {
        this.connectionHandler.reject({
          error: {
            code: "ECONNREFUSED",
            message: `connection refused ${this.options.url}`
          }
        });
      }
    };
  }

  connect() {
    return new Promise((resolve, reject) => {
      this.connectionHandler = { resolve, reject };
      this.initialize();
    });
  }

  end(code, reason) {
    this.client.__clientClosed = true;
    this.client.close(code, reason);
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
        message.forEach((res) => {
          if (res && res.method && !res.id) {
            this.dispatchEvent(new CustomEvent(res.method, { detail: res }));
          }
        });
        this.dispatchEvent(
          new CustomEvent("batchResponse", { detail: message })
        );
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
      message: (method, params, id = true) => {
        const request = formatRequest({
          method,
          params,
          id: id ? this.message_id : undefined,
          options: this.options
        });
        if (id) {
          this.message_id += 1;
        }
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
        this.timeouts[requestId] = setTimeout(() => {
          this.cleanUp(requestId);
          try {
            const error = JSON.parse(
              formatError({
                jsonrpc: this.options.version,
                delimiter: this.options.delimiter,
                id: null,
                code: ERR_CODES.timeout,
                message: ERR_MSGS.timeout
              })
            );
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
            resolve(request);
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
      this.timeouts[String(batchIds)] = setTimeout(() => {
        this.cleanUp(String(batchIds));
        try {
          const error = JSON.parse(
            formatError({
              jsonrpc: this.options.version,
              delimiter: this.options.delimiter,
              id: null,
              code: ERR_CODES.timeout,
              message: ERR_MSGS.timeout
            })
          );
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
      this.addEventListener("batchResponse", this.gotBatchResponse);
    });
  }

  gotBatchResponse({ detail }) {
    const batch = detail;
    const batchResponseIds = [];
    batch.forEach((message) => {
      if (message.id) {
        batchResponseIds.push(message.id);
      }
    });
    if (batchResponseIds.length === 0) {
      // dont do anything here since its basically an invalid response
    }
    for (const ids of Object.keys(this.pendingBatches)) {
      const arrays = [JSON.parse(`[${ids}]`), batchResponseIds];
      const difference = arrays.reduce((a, b) => a.filter(c => !b.includes(c)));
      if (difference.length === 0) {
        this.cleanUp(ids);
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
  }

  handleResponse(id) {
    try {
      const response = this.responseQueue[id];
      this.pendingCalls[id].resolve(response);
      delete this.responseQueue[id];
      this.cleanUp(id);
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
        this.handleError(e);
      }
    }
  }

  handleError(error) {
    let response;
    try {
      response = JSON.parse(error.message);
    } catch (e) {
      response = JSON.parse(
        formatError({
          jsonrpc: this.options.version,
          delimiter: this.options.delimiter,
          id: null,
          code: ERR_CODES.unknown,
          message: JSON.stringify(error, Object.getOwnPropertyNames(error))
        })
      );
    }
    try {
      this.pendingCalls[response.id].reject(response);
      this.cleanUp(response.id);
    } catch (e) {
      if (e instanceof TypeError) {
        // probably a parse error, which might not have an id
        process.stdout.write(
          `Message has no outstanding calls: ${JSON.stringify(response)}\n`
        );
      }
    }
  }

  cleanUp(ids) {
    // clear pending timeouts for these request ids
    clearTimeout(this.timeouts[ids]);
    delete this.timeouts[ids];
  }

  /**
   * @params {String} [method] method to subscribe to
   * @params {Function} [cb] callback function to invoke on notify
   */
  subscribe(method, cb) {
    if (method === "batchResponse") {
      throw new Error("\"batchResponse\" is a reserved event name");
    }
    if (!this.eventListenerList) this.eventListenerList = {};
    if (!this.eventListenerList[method]) this.eventListenerList[method] = [];

    // add listener to  event tracking list
    this.eventListenerList[method].push({
      type: method,
      listener: cb
    });
    this.addEventListener(method, cb);
  }

  /**
   * @params {String} [method] method to unsubscribe from
   * @params {Function} [cb] name of function to remove
   */
  unsubscribe(method, cb) {
    if (method === "batchResponse") {
      throw new Error("\"batchResponse\" is a reserved event name");
    }
    // remove listener
    this.removeEventListener(method, cb);

    if (!this.eventListenerList) this.eventListenerList = {};
    if (!this.eventListenerList[method]) this.eventListenerList[method] = [];

    // Find the event in the list and remove it
    for (let i = 0; i < this.eventListenerList[method].length; i += 1) {
      if (this.eventListenerList[method][i].listener === cb) {
        this.eventListenerList[method].splice(i, 1);
        break;
      }
    }
    // if no more events of the removed event method are left,remove the group
    if (this.eventListenerList[method].length === 0) delete this.eventListenerList[method];
  }

  unsubscribeAll(method) {
    if (method === "batchResponse") {
      throw new Error("\"batchResponse\" is a reserved event name");
    }
    if (!this.eventListenerList) this.eventListenerList = {};
    if (!this.eventListenerList[method]) this.eventListenerList[method] = [];
    // remove listener
    for (let j = 0; j < this.eventListenerList[method].length; j += 1) {
      const cb = this.eventListenerList[method][j].listener;
      // remove listener
      this.removeEventListener(method, cb);

      if (!this.eventListenerList) this.eventListenerList = {};
      if (!this.eventListenerList[method]) this.eventListenerList[method] = [];

      // Find the event in the list and remove it
      for (let i = 0; i < this.eventListenerList[method].length; i += 1) {
        if (this.eventListenerList[method][i].listener === cb) {
          this.eventListenerList[method].splice(i, 1);
          break;
        }
      }
    }
    delete this.eventListenerList[method];
  }

  getEventListeners(type) {
    if (!this.eventListenerList) this.eventListenerList = {};

    // return requested listeners type or all them
    if (type === undefined) return this.eventListenerList;
    return this.eventListenerList[type];
  }
}

module.exports = WSClient;

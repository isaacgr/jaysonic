const _ = require("lodash");
const http = require("http");
const Client = require(".");
const { formatRequest } = require("../functions");
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
    const defaults = {
      host: this.server.host,
      port: this.server.port || 80,
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        Accept: "application/json"
      },
      path: "/"
    };
    this.messageBuffer = "";
    this.options = _.merge(defaults, this.options || {});
  }

  initClient() {
    this.client = http.request(this.options, (response) => {
      this.writer = response;
      this.listen();
      this.handleResponse();
      this.handleError();
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
          "utf-8"
        );
        this.initClient();
        this.client.write(request);
        this.client.end();
        setTimeout(() => {
          if (this.pendingCalls[requestId]) {
            const error = this.sendError({
              id: requestId,
              code: ERR_CODES.timeout,
              message: ERR_MSGS.timeout
            });
            delete this.pendingCalls[requestId];
            this.client.end();
            reject(error);
          }
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
            "utf-8"
          );
          const notification = http.request(this.options, (response) => {
            if (response.statusCode === 204) {
              resolve(response);
            } else {
              reject(new Error("no response receieved for notification"));
            }
          });
          notification.write(request);
          notification.end();
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
      for (const request of requests) {
        const json = JSON.parse(request);
        if (json.id) {
          batchIds.push(json.id);
        }
      }
      this.pendingBatches[String(batchIds)] = { resolve, reject };

      const request = JSON.stringify(requests);
      this.options.headers["Content-Length"] = Buffer.byteLength(
        request,
        "utf-8"
      );
      this.initClient();
      this.client.write(request);
      this.client.end();
      this.on("batchResponse", (batch) => {
        const batchResponseIds = [];
        batch.forEach((message) => {
          if (message.error) {
            // reject the whole message if there are any errors
            reject(batch);
          }
          if (message.id) {
            batchResponseIds.push(message.id);
          }
        });
        if (_.isEmpty(batchResponseIds)) {
          resolve([]);
        }
        for (const ids of Object.keys(this.pendingBatches)) {
          if (
            _.isEmpty(
              _.difference(JSON.parse(`[${ids}]`), batchResponseIds)
            )
          ) {
            this.pendingBatches[ids].resolve(batch);
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

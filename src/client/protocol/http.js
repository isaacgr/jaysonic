const http = require("http");
const JsonRpcClientProtocol = require("./base");

class HttpClientProtocol extends JsonRpcClientProtocol {
  constructor(factory, version, delimiter) {
    super(factory, version, delimiter);
    this.headers = this.factory.headers;
    this.encoding = this.factory.encoding;
  }

  write(request, cb) {
    const options = {
      ...this.factory.options,
      ...this.headers
    };
    this.headers["Content-Length"] = Buffer.byteLength(request, this.encoding);
    this.connector = http.request(options, (response) => {
      if (cb) {
        response.on("end", cb);
      }
      this.listener = response;
      this.listen();
    });
    this.connector.write(request, this.encoding);
    this.connector.end();
    this.connector.on("close", () => {
      this.factory.emit("serverDisconnected");
    });
    this.connector.on("error", (error) => {
      throw error;
    });
  }

  notify(method, params) {
    return new Promise((resolve, reject) => {
      const request = this.message(method, params, false);
      try {
        this.write(request, () => {
          if (this.listener.statusCode === 204) {
            resolve(this.listener);
          } else {
            reject(new Error("no response receieved for notification"));
          }
        });
      } catch (e) {
        // this.connector is probably undefined
        reject(e);
      }
    });
  }

  getResponse(id) {
    return {
      body: this.responseQueue[id],
      ...this.writer
    };
  }

  getBatchResponse(batch) {
    return {
      body: batch,
      ...this.connector
    };
  }

  rejectPendingCalls(error) {
    const err = {
      body: error,
      ...this.connector
    };
    try {
      this.pendingCalls[err.body.id].reject(err);
      this.factory.cleanUp(err.body.id);
    } catch (e) {
      if (e instanceof TypeError) {
        // probably a parse error, which might not have an id
        console.error(
          `Message has no outstanding calls: ${JSON.stringify(err.body)}`
        );
      }
    }
  }
}

module.exports = HttpClientProtocol;

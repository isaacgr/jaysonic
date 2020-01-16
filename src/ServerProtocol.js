const { MessageBuffer } = require("./buffer");

class TCPServerProtocol {
  constructor(factory, client, delimiter) {
    this.client = client;
    this.factory = factory;
    this.delimiter = delimiter;
    this.messageBuffer = new MessageBuffer(delimiter);
  }

  clientConnected() {
    this.client.on("data", (data) => {
      this.messageBuffer.push(data);
      while (!this.messageBuffer.isFinished()) {
        const chunk = this.messageBuffer.handleData();
        this.factory
          .handleValidation(chunk)
          .then((message) => {
            if (message.batch) {
              this.client.write(JSON.stringify(message.batch) + this.delimiter);
            } else if (message.notification) {
              this.factory.emit("notify", message.notification);
            } else {
              this.factory
                .getResult(message)
                .then(result => this.client.write(result))
                .catch((error) => {
                  this.client.write(error + this.delimiter);
                });
            }
          })
          .catch((error) => {
            this.client.write(error.message + this.delimiter);
          });
      }
    });
    this.client.on("close", () => {
      this.factory.emit("clientDisconnected", this.client);
    });
    this.client.on("end", () => {
      this.factory.emit("clientDisconnected", this.client);
    });
  }
}

class WSServerProtocol {
  constructor(factory, client, delimiter) {
    this.client = client;
    this.factory = factory;
    this.delimiter = delimiter;
    this.messageBuffer = new MessageBuffer(delimiter);
  }

  clientConnected() {
    this.client.on("message", (data) => {
      this.messageBuffer.push(data);
      while (!this.messageBuffer.isFinished()) {
        const chunk = this.messageBuffer.handleData();
        this.factory
          .handleValidation(chunk)
          .then((message) => {
            if (message.batch) {
              this.client.send(JSON.stringify(message.batch) + this.delimiter);
            } else if (message.notification) {
              this.factory.emit("notify", message.notification);
            } else {
              this.factory
                .getResult(message)
                .then(result => this.client.send(result))
                .catch((error) => {
                  this.client.send(error + this.delimiter);
                });
            }
          })
          .catch((error) => {
            this.client.send(error.message + this.delimiter);
          });
      }
    });
    this.client.on("close", () => {
      this.factory.emit("clientDisconnected", this.client);
    });
    this.client.on("end", () => {
      this.factory.emit("clientDisconnected", this.client);
    });
  }
}

class HttpServerProtocol {
  constructor(factory, request, response, delimiter) {
    this.client = request;
    this.response = response;
    this.delimiter = delimiter;
    this.factory = factory;
    this.messageBuffer = new MessageBuffer(delimiter);
  }

  clientConnected() {
    this.client.on("data", (data) => {
      this.messageBuffer.push(data);
    });
    this.client.on("end", () => {
      while (!this.messageBuffer.isFinished()) {
        const chunk = this.messageBuffer.handleData();
        this.factory
          .handleValidation(chunk)
          .then((message) => {
            if (message.batch) {
              this.factory.setResponseHeader({ response: this.response });
              this.response.write(
                JSON.stringify(message.batch) + this.delimiter,
                () => {
                  this.response.end();
                }
              );
            } else if (message.notification) {
              this.factory.setResponseHeader({
                response: this.response,
                notification: true
              });
              this.response.end();
            } else {
              this.factory
                .getResult(message)
                .then((result) => {
                  this.factory.setResponseHeader({ response: this.response });
                  this.response.write(result, () => {
                    this.response.end();
                  });
                })
                .catch((error) => {
                  this.sendError(error);
                });
            }
          })
          .catch((error) => {
            this.sendError(error.message);
          });
      }
    });
  }

  sendError(error) {
    this.factory.setResponseHeader({
      response: this.response,
      errorCode: JSON.parse(error).error.code || 500
    });
    this.response.write(error + this.delimiter, () => {
      this.response.end();
    });
  }
}

module.exports = { TCPServerProtocol, WSServerProtocol, HttpServerProtocol };

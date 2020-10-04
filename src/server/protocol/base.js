const { MessageBuffer } = require("../../buffer");

class JsonRpcServerProtocol {
  // base protocol class for servers
  constructor(factory, client, delimiter) {
    this.client = client;
    this.factory = factory;
    this.delimiter = delimiter;
    this.messageBuffer = new MessageBuffer(delimiter);
    this.event = "data";
  }

  writeToClient(message, notification) {
    if (notification) {
      this.factory.emit(message.notification.method, notification);
    } else {
      this.client.write(message);
    }
  }

  handleValidMessage(message) {
    if (message.batch) {
      if (message.batch.empty) {
        return;
      }
      this.writeToClient(JSON.stringify(message.batch) + this.delimiter);
    } else if (message.notification) {
      this.writeToClient(message, message.notification);
    } else {
      this.factory
        .getResult(message)
        .then(result => this.writeToClient(result))
        .catch((error) => {
          this.sendError(error);
        });
    }
  }

  sendError(error) {
    this.writeToClient(error);
  }

  _waitForData() {
    while (!this.messageBuffer.isFinished()) {
      const chunk = this.messageBuffer.handleData();
      this.factory
        .handleValidation(chunk)
        .then((message) => {
          this.handleValidMessage(message);
        })
        .catch((error) => {
          this.sendError(error.message);
        });
    }
  }

  clientConnected() {
    this.client.on(this.event, (data) => {
      this.messageBuffer.push(data);
      this._waitForData();
    });
    this.client.on("close", () => {
      this.factory.emit("clientDisconnected", this.client);
    });
    this.client.on("end", () => {
      this.factory.emit("clientDisconnected", this.client);
    });
  }
}

module.exports = JsonRpcServerProtocol;

const { expect } = require("chai");
const Jaysonic = require("../../src/");
const HttpServerFactory = require("../../src/server/http");
const HttpServerProtocol = require("../../src/server/protocol/http");

class Protocol extends HttpServerProtocol {
  constructor(factory, client, response, version, delimiter) {
    super(factory, client, response, version, delimiter);
    this.status = 404;
  }
}

class Factory extends HttpServerFactory {
  constructor(options) {
    super(options);
    this.protocol = Protocol;
  }
}

const server = new Factory({
  port: 6969
});
const client = new Jaysonic.client.http({ port: 6969 });

describe("HTTP Server Protocol Status Override", () => {
  before((done) => {
    server.listen().then(() => {
      done();
    });
  });
  after((done) => {
    server.close().then(() => {
      done();
    });
  });
  it("should overwrite status code", (done) => {
    client.send("foo").catch((e) => {
      expect(e.body.error.code).to.be.eql(-32601);
      expect(e.statusCode).to.be.eql(404);
      done();
    });
  });
  it("should overwrite errorCode if status is passed", (done) => {
    class OverwritePcol extends HttpServerProtocol {
      clientConnected() {
        this.setResponseStatus({ errorCode: 400, status: 301 });
        this.gotError(
          new Error(
            "{\"jsonrpc\": \"2.0\", \"error\": {\"code\": -32600, \"message\": \"Invalid Request\"}, \"id\": 2}"
          )
        );
      }
    }
    server.protocol = OverwritePcol;
    client.send("foo").catch((e) => {
      expect(e.body.error.code).to.be.eql(-32600);
      expect(e.statusCode).to.be.eql(301);
      done();
    });
  });
});

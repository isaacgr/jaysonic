const { expect } = require("chai");
const intercept = require("intercept-stdout");
const Jaysonic = require("../../src");
const { wss } = require("../test-server");

const wsClient = new Jaysonic.client.ws({ retries: 1 });
const infClient = new Jaysonic.client.ws({ retries: Infinity });

describe("WS Client Reconnect", () => {
  it("should attempt to reconnect to the server and reject promise if unable", (done) => {
    const conn = wsClient.connect();
    conn.catch((error) => {
      expect(error).to.be.an("object");
      done();
    });
  }).timeout(10000);
  it("should retry the connection to the server indefinitely if retries set to 'Infinity'", (done) => {
    infClient.connect();
    let capturedText = "";
    const unhook = intercept((text) => {
      capturedText += text;
    });
    setTimeout(() => {
      unhook();
      expect(capturedText).to.equal(
        "Failed to connect. Address [ws://127.0.0.1:8100]. Retrying.\n"
      );
      infClient.end();
      done();
    }, 100);
  }).timeout(10000);
  it("should clear the _connectionTimeout of the protocol instance when connection ended", (done) => {
    infClient.connect();
    let capturedText = "";
    const unhook = intercept((text) => {
      capturedText += text;
    });
    setTimeout(() => {
      unhook();
      expect(capturedText).to.equal(
        "Failed to connect. Address [ws://127.0.0.1:8100]. Retrying.\n"
      );
      const pcolConnectionTimeout = infClient.pcolInstance._connectionTimeout;
      infClient.end();
      expect(pcolConnectionTimeout._destroyed).to.equal(true);
      done();
    }, 1000);
  }).timeout(10000);
});

describe("WS Client end connection", () => {
  before((done) => {
    wss.listen().then(() => {
      done();
    });
  });
  after((done) => {
    wss.close().then(() => {
      done();
    });
  });
  it("should close the connection and log that the client did it", (done) => {
    const conn = wsClient.connect();
    conn.then(() => {
      wsClient.end();
      let capturedText = "";
      const unhook = intercept((text) => {
        capturedText += text;
      });
      setTimeout(() => {
        unhook();
        expect(capturedText).to.equal(
          "Client closed connection. Code [1005]. Reason [].\n"
        );
        done();
      }, 100);
    });
  });
});

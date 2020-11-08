const { expect } = require("chai");
const intercept = require("intercept-stdout");
const Jaysonic = require("../../src");
const { wss } = require("../test-server");

const wsClient = new Jaysonic.client.ws({ retries: 1 });

describe("WS Client Reconnect", () => {
  after((done) => {
    wsClient.end();
    done();
  });
  it("should attempt to reconnect to the server and reject promise if unable", (done) => {
    const conn = wsClient.connect();
    conn.catch((error) => {
      expect(error).to.be.an("object");
      done();
    });
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

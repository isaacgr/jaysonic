const { expect } = require("chai");
const intercept = require("intercept-stdout");
const Jaysonic = require("../../src");

const client = new Jaysonic.client.tcp({ retries: 1 });
const infClient = new Jaysonic.client.tcp({ retries: Infinity });

describe("Base Client Reconnect", () => {
  it("should retry the connection to the server and log the attempts", (done) => {
    const conn = client.connect();
    let capturedText = "";
    const unhook = intercept((text) => {
      capturedText += text;
    });
    setTimeout(() => {
      unhook();
      expect(capturedText).to.equal(
        "Failed to connect. Address [127.0.0.1:8100]. Retrying. 0 attempts left.\n"
      );
    }, 100);
    conn.catch(() => {
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
        "Failed to connect. Address [127.0.0.1:8100]. Retrying.\n"
      );
      infClient.end();
      done();
    }, 100);
  }).timeout(10000);
});

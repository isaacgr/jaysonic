const { expect } = require("chai");
const intercept = require("intercept-stdout");
const Jaysonic = require("../../src");

const client = new Jaysonic.client.tcp({ retries: 1 });

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
        "Unable to connect. Retrying. 0 attempts left.\n"
      );
    }, 100);
    conn.catch(() => {
      done();
    });
  }).timeout(10000);
});

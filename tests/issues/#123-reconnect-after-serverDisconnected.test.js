const { expect } = require("chai");
const Jaysonic = require("../../src");
const { server } = require("../test-server");
const intercept = require("intercept-stdout");

const tcpclient = new Jaysonic.client.tcp({
  retries: 10
});

describe("#123 Reconnect after serverDisconnected", () => {
  beforeEach(async () => {
    await server.listen();
  });
  afterEach(async () => {
    await tcpclient.end();
  });
  it("should attempt to reconnect at the default rate after receiving a serverDisconnected", async () => {
    let reconnectAttempts = 0;
    let capturedText = "";
    const unhook = intercept((text) => {
      capturedText += text;
    });
    tcpclient.serverDisconnected(async () => {
      reconnectAttempts += 1;
      tcpclient.pcolInstance = null;
      await tcpclient.connect();
    });
    await tcpclient.connect();
    await server.close();
    await new Promise((r) => setTimeout(r, 10000));
    unhook();
    // first re-connect attempt is done without error
    // second is done with error and does not trigger the serverDisconnected call
    // after which the test should timeout
    // 2 attempts, 5s apart 10s total
    expect(capturedText).to.equal(
      `Failed to connect. Address [127.0.0.1:8100]. Retrying. 9 attempts left.\nFailed to connect. Address [127.0.0.1:8100]. Retrying. 8 attempts left.\n`
    );
    expect(reconnectAttempts).to.equal(1);
  }).timeout(30000);
});

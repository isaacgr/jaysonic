const { expect } = require("chai");
const Jaysonic = require("../../src");
const { server } = require("../test-server");
const intercept = require("intercept-stdout");

const tcpclient = new Jaysonic.client.tcp({
  retries: 10
});

describe("#123 Reconnect after serverDisconnected", () => {
  before(async () => {
    await server.listen();
    await tcpclient.connect();
  });
  after(async () => {
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
    await server.close();
    await new Promise((r) => setTimeout(r, 10000));
    unhook();
    expect(capturedText).to.equal(
      `Failed to connect. Address [127.0.0.1:8100]. Retrying. 9 attempts left.\nFailed to connect. Address [127.0.0.1:8100]. Retrying. 8 attempts left.\n`
    );
    expect(reconnectAttempts).to.equal(1);
  }).timeout(30000);
});

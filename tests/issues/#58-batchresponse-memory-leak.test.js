const { expect } = require("chai");
const intercept = require("intercept-stdout");
const Jaysonic = require("../../src");

describe("#58 batchResponse causing memory leak", () => {
  describe("tcp", () => {
    it("shouldnt cause a 'MaxListenersExceededWarning'", async () => {
      let capturedText = "";
      const unhook = intercept((text) => {
        capturedText += text;
      });
      const server = new Jaysonic.server.tcp({ port: 8888 });
      await server.listen();
      server.method("f", () => 0);
      const client = new Jaysonic.client.tcp({ port: 8888 });
      await client.connect();
      for (let i = 0; i <= 11; i += 1) {
        await client.batch([client.request().message("f")]);
      }
      unhook();
      expect(capturedText).to.equal("");
      expect(Object.keys(client.listeners).length).to.be.equal(0);
    });
  });
  describe("ws", () => {
    it("shouldnt cause a 'MaxListenersExceededWarning'", async () => {
      let capturedText = "";
      const unhook = intercept((text) => {
        capturedText += text;
      });
      const server = new Jaysonic.server.ws({ port: 8200 });
      await server.listen();
      server.method("f", () => 0);
      const client = new Jaysonic.client.ws({ url: "ws://127.0.0.1:8200" });
      await client.connect();
      for (let i = 0; i <= 11; i += 1) {
        await client.batch([client.request().message("f")]);
      }
      unhook();
      expect(capturedText).to.equal("");
      expect(Object.keys(client.listeners).length).to.be.equal(0);
      client.end();
    });
  });
  describe("http", () => {
    it("shouldnt cause a 'MaxListenersExceededWarning'", async () => {
      let capturedText = "";
      const unhook = intercept((text) => {
        capturedText += text;
      });
      const server = new Jaysonic.server.http({ port: 8300 });
      await server.listen();
      server.method("f", () => 0);

      const client = new Jaysonic.client.http({
        port: 8300
      });
      for (let i = 0; i <= 11; i += 1) {
        await client.batch([client.request().message("f")]);
      }
      unhook();
      expect(capturedText).to.equal("");
      expect(Object.keys(client.listeners).length).to.be.equal(0);
    });
  });
});

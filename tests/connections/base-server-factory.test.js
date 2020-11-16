const { expect } = require("chai");
const intercept = require("intercept-stdout");
const net = require("net");
const Jaysonic = require("../../src");

const server = new Jaysonic.server.tcp();

describe("Base Server Factory Connections", () => {
  it("should reject .close() if error is thrown", (done) => {
    server.server = new net.Server();
    server.close().catch((error) => {
      expect(error.code).to.eql("ERR_SERVER_NOT_RUNNING");
      done();
    });
  });
});

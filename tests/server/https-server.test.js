const { expect } = require("chai");
const nodeHttps = require("https");
const Jaysonic = require("../../src");

const https = new Jaysonic.server.http({ scheme: "https" });

describe("HTTPS Server Instantiation", () => {
  after((done) => {
    https.close().then(() => {
      done();
    });
  });
  it("should create a new https server", (done) => {
    https.listen().then(() => {
      expect(https.server).to.be.instanceOf(nodeHttps.Server);
      done();
    });
  });
  it("should throw error for invalid scheme", (done) => {
    const invalid = new Jaysonic.server.http({ scheme: "foo" });
    invalid.listen().catch((error) => {
      expect(error).to.be.instanceOf(Error);
      done();
    });
  });
});

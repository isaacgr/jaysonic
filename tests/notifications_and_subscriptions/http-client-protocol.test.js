const { expect } = require("chai");
const Jaysonic = require("../../src/");

const http = new Jaysonic.client.http({
  host: "httpbin.org",
  path: "/status/200",
  scheme: "https",
  port: 443
});

describe("Http Client Protocol Notifications", () => {
  it("should reject with error if no 204 response recieved for notification", (done) => {
    http
      .request()
      .notify("guru.test")
      .catch((error) => {
        expect(error.message).to.eql("no response receieved for notification");
        done();
      });
  });
});

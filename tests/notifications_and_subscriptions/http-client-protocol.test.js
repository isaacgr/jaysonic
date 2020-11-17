const { expect } = require("chai");
const Jaysonic = require("../../src/");

const http = new Jaysonic.client.http({
  host: "gurujsonrpc.appspot.com",
  path: "/guru",
  scheme: "https",
  port: 443
});

describe("Http Client Protocol Notifications", () => {
  it("should reject with error if no 204 respnse recieved for notification", (done) => {
    http
      .request()
      .notify("guru.test", ["isaac"])
      .catch((error) => {
        console.log(error.message);
        expect(error.message).to.eql("no response receieved for notification");
        done();
      });
  });
});

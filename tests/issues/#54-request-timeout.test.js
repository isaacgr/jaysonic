const { expect } = require("chai");
const Jaysonic = require("../../src");
const JaysonicWebClient = require("../../src/client-ws");
const { server, serverHttp, wss } = require("../test-server");

const tcpclient = new Jaysonic.client.tcp({
  timeout: 0
});
// const httpclient = new Jaysonic.client.http({
//   timeout: 0
// });
const wsclient = new Jaysonic.client.ws({
  timeout: 0
});
const wsweb = new JaysonicWebClient.wsclient({
  timeout: 0
});

server.method(
  "timeout",
  () => new Promise((resolve) => {
    setTimeout(() => resolve(0), 5000);
  })
);
serverHttp.method(
  "timeout",
  () => new Promise((resolve) => {
    setTimeout(() => resolve(0), 5000);
  })
);
wss.method(
  "timeout",
  () => new Promise((resolve) => {
    setTimeout(() => resolve(0), 5000);
  })
);

describe("#54 Request timeout", () => {
  describe("tcp", () => {
    before((done) => {
      server.listen().then(() => {
        done();
      });
    });
    after((done) => {
      server.close().then(() => {
        done();
      });
    });
    it("should return object for request timeout", (done) => {
      tcpclient.connect().then(() => {
        tcpclient
          .request()
          .send("timeout")
          .catch((error) => {
            expect(error).to.be.eql({
              jsonrpc: "2.0",
              error: { code: -32000, message: "Request Timeout" },
              id: 1
            });
            done();
          });
      });
    });
  });
  describe("ws", () => {
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
    it("should return object for request timeout", (done) => {
      wsclient.connect().then(() => {
        wsclient
          .request()
          .send("timeout")
          .catch((error) => {
            expect(error).to.be.eql({
              jsonrpc: "2.0",
              error: { code: -32000, message: "Request Timeout" },
              id: 1
            });
            done();
          });
      });
    });
  });
  describe("ws web", () => {
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
    it("should return object for request timeout", (done) => {
      wsweb.connect().then(() => {
        wsweb
          .request()
          .send("timeout")
          .catch((error) => {
            expect(error).to.be.eql({
              jsonrpc: "2.0",
              error: { code: -32000, message: "Request Timeout" },
              id: 1
            });
            done();
          });
      });
    });
  });
  // describe("http", () => {
  //   before((done) => {
  //     serverHttp.listen().then(() => {
  //       done();
  //     });
  //   });
  //   after((done) => {
  //     serverHttp.close().then(() => {
  //       done();
  //     });
  //   });
  //   it("should return object for request timeout", (done) => {
  //     httpclient
  //       .request()
  //       .send("timeout")
  //       .catch((error) => {
  //         expect(error).to.be.eql({
  //           jsonrpc: "2.0",
  //           error: { code: -32000, message: "Request Timeout" },
  //           id: 1
  //         });
  //         done();
  //       });
  //   });
  // });
});

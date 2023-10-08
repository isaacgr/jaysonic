const { expect } = require("chai");
const Jaysonic = require("../../src");
const data = require("../large-data.json");
const { serverHttps } = require("../test-server");

const clienthttps = new Jaysonic.client.http({
  scheme: "https",
  rejectUnauthorized: false,
  headers: {
    Connection: "close"
  }
});

describe("HTTPS Client", () => {
  before((done) => {
    serverHttps
      .listen()
      .then(() => {
        done();
      })
      .catch(e => console.log(e));
  });
  after((done) => {
    serverHttps
      .close()
      .then(() => {
        done();
      })
      .catch(e => console.log(e));
  });
  describe("connection", () => {
    // it("should receive error trying to write while disconnected", (done) => {
    //   const badClient = new Jaysonic.client.http({
    //     host: "127.0.0.1",
    //     port: 8102,
    //     retries: 0,
    //     timeout: 0
    //   });
    //   badClient
    //     .request()
    //     .send("add", [1, 2])
    //     .catch((error) => {
    //       expect(error).to.be.instanceOf(Object);
    //       done();
    //     });
    // });
  });
  describe("requests", () => {
    it("should get a response for positional params", (done) => {
      const request = clienthttps.request().send("params", [1, 2]);
      request.then((response) => {
        expect(response.body).to.be.eql({
          result: 3,
          jsonrpc: "2.0",
          id: 1
        });
        done();
      });
    });
    it("should get a response for named params", (done) => {
      const request = clienthttps
        .request()
        .send("named.params", { name: "jaysonic" });
      request.then((response) => {
        expect(response.body).to.be.eql({
          result: "Hello jaysonic",
          jsonrpc: "2.0",
          id: 2
        });
        done();
      });
    });
    it("should get a response for large dataset", (done) => {
      const request = clienthttps.request().send("large.data", []);
      request.then((response) => {
        expect(response.body).to.be.eql({
          result: data,
          jsonrpc: "2.0",
          id: 3
        });
        done();
      });
    });
  });
  describe("request errors", () => {
    it("should get an 'invalid params' error", (done) => {
      const request = clienthttps.request().send("params", {});
      request.catch((response) => {
        expect(response.body).to.be.eql({
          jsonrpc: "2.0",
          error: {
            code: -32602,
            message: "Invalid Parameters"
          },
          id: 4
        });
        done();
      });
    });
    it("should get a 'method not found' error", (done) => {
      const request = clienthttps.request().send("foo", {});
      request.catch((response) => {
        expect(response.body).to.be.eql({
          jsonrpc: "2.0",
          error: {
            code: -32601,
            message: "Method not found"
          },
          id: 5
        });
        done();
      });
    });
    it("should handle 'unknown' error", (done) => {
      const request = clienthttps.request().send("unknown.error", [1]);
      request.catch((response) => {
        expect(response.body).to.eql({
          jsonrpc: "2.0",
          error: { code: -32001, message: "Unknown Error" },
          id: 6
        });
        done();
      });
    });
  });
  describe("batches", () => {
    it("should receive response for batch request", (done) => {
      const request = clienthttps.batch([
        clienthttps.request().message("params", [1, 2]),
        clienthttps.request().message("params", [3, 4])
      ]);
      request.then((response) => {
        expect(response.body).to.eql([
          { result: 3, jsonrpc: "2.0", id: 7 },
          { result: 7, jsonrpc: "2.0", id: 8 }
        ]);
        done();
      });
    });
    it("should receive error in batch response if one batch request is bad", (done) => {
      const request = clienthttps.batch([
        clienthttps.request().message("foo", [1, 2]),
        clienthttps.request().message("params", [3, 4])
      ]);
      request.catch((response) => {
        expect(response.body).to.eql([
          {
            jsonrpc: "2.0",
            error: { code: -32601, message: "Method not found" },
            id: 9
          },
          { result: 7, jsonrpc: "2.0", id: 10 }
        ]);
        done();
      });
    });
    // it("should reject message with error when parse error thrown with pending call", (done) => {
    //   const server1 = new http.Server();
    //   server1.listen({ host: "127.0.0.1", port: 9900 });
    //   server1.on("request", (request, response) => {
    //     request.on("data", () => {
    //       // dont care
    //     });
    //     request.on("end", () => {
    //       response.writeHead(200, { "Content-Type": "application/json" });
    //       response.write("should get a parse error\n", () => {
    //         response.end();
    //       });
    //     });
    //   });
    //   const httpclient = new Jaysonic.client.http({
    //     host: "127.0.0.1",
    //     port: 9900
    //   });
    //   httpclient
    //     .request()
    //     .send("params", [1, 2])
    //     .catch((error) => {
    //       expect(error.body).to.be.eql({
    //         jsonrpc: "2.0",
    //         error: {
    //           code: -32700,
    //           message: "Unable to parse message: 'should get a parse error'"
    //         },
    //         id: 1
    //       });
    //       done();
    //     });
    // });
  });
  describe("multiple requests", () => {
    it("should get responses for multiple requests at once", (done) => {
      const request = clienthttps.request().send("params", [1, 2]);
      const request2 = clienthttps
        .request()
        .send("named.params", { name: "jaysonic" });
      const request3 = clienthttps.batch([
        clienthttps.request().message("params", [1, 2]),
        clienthttps.request().message("params", [3, 4])
      ]);
      const request4 = clienthttps.batch([
        clienthttps.request().message("nonexistent", [1, 2]),
        clienthttps.request().message("params", [3, 4])
      ]);
      try {
        request.then((res1) => {
          expect(res1.body).to.eql({ jsonrpc: "2.0", result: 3, id: 11 });
        });
        request2.then((res2) => {
          expect(res2.body).to.eql({
            jsonrpc: "2.0",
            result: "Hello jaysonic",
            id: 12
          });
        });
        request3.then((res3) => {
          expect(res3.body).to.eql([
            { result: 3, jsonrpc: "2.0", id: 13 },
            { result: 7, jsonrpc: "2.0", id: 14 }
          ]);
        });
        request4.catch((res4) => {
          expect(res4.body).to.eql([
            {
              jsonrpc: "2.0",
              error: { code: -32601, message: "Method not found" },
              id: 15
            },
            { result: 7, jsonrpc: "2.0", id: 16 }
          ]);
        });
        done();
      } catch (e) {
        done(e);
      }
    });
  });
  describe("notifications", () => {
    it("should receive a '204' response for a notification", (done) => {
      const request = clienthttps.request().notify("notify", []);
      request.then((response) => {
        expect(response.statusCode).to.be.equal(204);
        done();
      });
    });
  });
  // describe("headers", () => {
  //   it("should send headers with content length", (done) => {
  //     const request = clienthttps.request().notify("notify", []);
  //     const length = Buffer.byteLength(
  //       clienthttps.request().message("params", [1, 2]),
  //       clienthttps.options.encoding
  //     );
  //     request.then((response) => {
  //       expect(response.headers).to.include({
  //         "Content-Length": String(length)
  //       });
  //       done();
  //     });
  //   });
  // });
});

describe("HTTPS Client Instantiation", () => {
  it("should throw error for invalid scheme", (done) => {
    const invalid = new Jaysonic.client.http({ scheme: "foo" });
    const request = invalid.request().send("params", [1, 2]);
    request.catch((error) => {
      expect(error).to.be.instanceOf(Error);
      expect(error.message).to.equal("Invalid scheme");
      done();
    });
  });
});

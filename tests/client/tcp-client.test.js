const { expect } = require("chai");
const intercept = require("intercept-stdout");
const net = require("net");
const { server } = require("../test-server");
const data = require("../large-data.json");

const Jaysonic = require("../../src");

const client = new Jaysonic.client.tcp({
  retries: 0
});
const clientV1 = new Jaysonic.client.tcp({
  retries: 0,
  version: 1
});

describe("TCP Client", () => {
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
  describe("connection", () => {
    it("should connect to server", (done) => {
      const connection = client.connect();
      connection.then((result) => {
        expect(result).to.eql({ host: "127.0.0.1", port: 8100 });
        done();
      });
    });
    it("should handle a connection refused error", (done) => {
      const badClient = new Jaysonic.client.tcp({
        host: "127.0.0.1",
        port: 8101,
        retries: 0
      });
      const connection = badClient.connect();
      connection.catch((error) => {
        expect(error.code).to.equal("ECONNREFUSED");
        done();
      });
    }).timeout(5000);
    it("should be unable to connect multiple times", (done) => {
      const conn = client.connect();
      conn.catch((error) => {
        expect(error.message).to.be.a("string");
        done();
      });
    });
    it("should receive error trying to write while disconnected", (done) => {
      const badClient = new Jaysonic.client.tcp({
        host: "127.0.0.1",
        port: 8101,
        retries: 0,
        timeout: 0.5
      });
      try {
        badClient.request().send("params", [1, 2]);
      } catch (e) {
        expect(e).to.be.instanceOf(TypeError);
        done();
      }
    });
  });
  describe("requests", () => {
    it("should receive response for positional params", (done) => {
      const request = client.request().send("params", [1, 2]);
      request.then((response) => {
        expect(response).to.eql({ jsonrpc: "2.0", result: 3, id: 1 });
        done();
      });
    });
    it("should receive response for named params", (done) => {
      const request = client
        .request()
        .send("named.params", { name: "jaysonic" });
      request.then((response) => {
        expect(response).to.eql({
          jsonrpc: "2.0",
          result: "Hello jaysonic",
          id: 2
        });
        done();
      });
    });
    it("should send notification to server", (done) => {
      const request = client.request().notify("named.params", []);
      request.then((result) => {
        expect(result).to.be.a("string");
        done();
      });
    });
    it("should retreive large dataset", (done) => {
      const request = client.request().send("large.data", []);
      request.then((result) => {
        expect(result).to.eql({
          jsonrpc: "2.0",
          result: data,
          id: 3
        });
        done();
      });
    });
    // it("should reject message with error when parse error thrown with pending call", (done) => {
    //   const server1 = new net.Server();
    //   server1.listen({ host: "127.0.0.1", port: 9700 });
    //   server1.on("connection", (someclient) => {
    //     someclient.write("should get a parse error\r\n");
    //   });
    //   const client1 = new Jaysonic.client.tcp({
    //     host: "127.0.0.1",
    //     port: 9700
    //   });
    //   client1.connect().then(() => {
    //     client1.request().send("params", [1, 2]);
    //   });
    // });
    it("should print error to stdout when error received with no pending call", (done) => {
      let capturedText = "";
      const unhook = intercept((text) => {
        capturedText += text;
      });
      const badServer = new net.Server();
      badServer.listen({ host: "127.0.0.1", port: 9800 });
      badServer.on("connection", (someclient2) => {
        someclient2.write("should get a parse error\r\n");
      });
      const client2 = new Jaysonic.client.tcp({
        host: "127.0.0.1",
        port: 9800
      });
      client2.connect().then(() => {
        // needs a bit of extra time to check the output
        setTimeout(() => {
          unhook();
          expect(capturedText).to.equal(
            "Message has no outstanding calls: {\"jsonrpc\":\"2.0\",\"error\":{\"code\":-32700,\"message\":\"Unable to parse message: 'should get a parse error\\r'\"},\"id\":null}\n"
          );
          done();
        }, 100);
      });
    });
  });
  describe("batches", () => {
    it("should receive response for batch request", (done) => {
      const request = client.batch([
        client.request().message("params", [1, 2]),
        client.request().message("params", [3, 4])
      ]);
      request.then((response) => {
        expect(response).to.eql([
          { result: 3, jsonrpc: "2.0", id: 4 },
          { result: 7, jsonrpc: "2.0", id: 5 }
        ]);
        done();
      });
    });
    it("should receive error in batch response if one batch request is bad", (done) => {
      const request = client.batch([
        client.request().message("foo", [1, 2]),
        client.request().message("params", [3, 4])
      ]);
      request.catch((response) => {
        expect(response).to.eql([
          {
            jsonrpc: "2.0",
            error: { code: -32601, message: "Method not found" },
            id: 6
          },
          { result: 7, jsonrpc: "2.0", id: 7 }
        ]);
        done();
      });
    });
    it("should receive 'invalid request' error for and empty array", (done) => {
      let capturedText = "";
      const unhook = intercept((text) => {
        capturedText += text;
      });
      client.batch([]);
      setTimeout(() => {
        unhook();
        expect(capturedText).to.equal(
          "Message has no outstanding calls: {\"jsonrpc\":\"2.0\",\"error\":{\"code\":-32600,\"message\":\"Invalid Request\"},\"id\":null}\n"
        );
        done();
      }, 100);
    });
    it("should receive 'invalid request' error in an array for non empty array", (done) => {
      const request = client.batch([1]);
      request.catch((response) => {
        expect(response).to.eql([
          {
            jsonrpc: "2.0",
            error: { code: -32600, message: "Invalid Request" },
            id: null
          }
        ]);
        done();
      });
    });
  });
  describe("multiple requests", () => {
    it("should get responses for multiple requests at once", (done) => {
      const request = client.request().send("params", [1, 2]);
      const request2 = client
        .request()
        .send("named.params", { name: "jaysonic" });
      const request3 = client.batch([
        client.request().message("params", [1, 2]),
        client.request().message("params", [3, 4])
      ]);
      const request4 = client.batch([
        client.request().message("nonexistent", [1, 2]),
        client.request().message("params", [3, 4])
      ]);
      try {
        request.then((res1) => {
          expect(res1).to.eql({ jsonrpc: "2.0", result: 3, id: 8 });
        });
        request2.then((res2) => {
          expect(res2).to.eql({
            jsonrpc: "2.0",
            result: "Hello jaysonic",
            id: 9
          });
        });
        request3.then((res3) => {
          expect(res3).to.eql([
            { result: 3, jsonrpc: "2.0", id: 10 },
            { result: 7, jsonrpc: "2.0", id: 11 }
          ]);
        });
        request4.catch((res4) => {
          expect(res4).to.eql([
            {
              jsonrpc: "2.0",
              error: { code: -32601, message: "Method not found" },
              id: 12
            },
            { result: 7, jsonrpc: "2.0", id: 13 }
          ]);
          done();
        });
      } catch (e) {
        done(e);
      }
    });
  });
  describe("request errors", () => {
    it("should handle 'method not found' error", (done) => {
      const request = client.request().send("foo", []);
      request.catch((error) => {
        expect(error).to.eql({
          jsonrpc: "2.0",
          error: { code: -32601, message: "Method not found" },
          id: 14
        });
        done();
      });
    });
    it("should handle 'invalid params' error", (done) => {
      const request = client.request().send("type.error", [1]);
      request.catch((error) => {
        expect(error).to.eql({
          jsonrpc: "2.0",
          error: { code: -32602, message: "Invalid Parameters" },
          id: 15
        });
        done();
      });
    });
    it("should handle 'unknown' error", (done) => {
      const request = client.request().send("unknown.error", [1]);
      request.catch((error) => {
        expect(error).to.eql({
          jsonrpc: "2.0",
          error: { code: -32001, message: "Unknown Error" },
          id: 16
        });
        done();
      });
    });
  });
  describe("receiving notifications", () => {
    it("should handle receiving a notification", (done) => {
      const callback = (message) => {
        expect(message).to.be.eql({
          jsonrpc: "2.0",
          method: "notification",
          params: []
        });
        done();
      };
      client.subscribe("notification", callback);
      server.notify([["notification", []]]);
    });
    it("should unsubscribe from a notificiation", (done) => {
      const callback = () => {};
      client.subscribe("newNotification", callback);
      expect(client.eventNames()).to.have.lengthOf(2);
      client.unsubscribe("newNotification", callback);
      expect(client.eventNames()).to.have.lengthOf(1);
      done();
    });
    it("should unsubscribe from all 'notification' events", (done) => {
      client.unsubscribeAll("notification");
      expect(client.eventNames()).to.have.lengthOf(0);
      done();
    });
    it("should recieve notifications if they're in a batch", (done) => {
      const callback = (message) => {
        expect(message).to.be.eql({
          jsonrpc: "2.0",
          method: "test",
          params: []
        });
        done();
      };
      client.subscribe("test", callback);
      server.notify([
        ["notification", []],
        ["test", []]
      ]);
    });
    it("should be unable to subscribe, unsub, or unsub all for \"batchResponse\"", (done) => {
      try {
        client.subscribe("batchResponse", () => {});
      } catch (e) {
        expect(e.message).to.be.a(
          "string",
          "\"batchResponse\" is a reserved event name"
        );
      }
      try {
        client.unsubscribe("batchResponse", () => {});
      } catch (e) {
        expect(e.message).to.be.a(
          "string",
          "\"batchResponse\" is a reserved event name"
        );
      }
      try {
        client.unsubscribeAll("batchResponse", () => {});
      } catch (e) {
        expect(e.message).to.be.a(
          "string",
          "\"batchResponse\" is a reserved event name"
        );
      }
      done();
    });
  });
});

describe("TCP Client V1", () => {
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
  describe("v1.0 requests", () => {
    before((done) => {
      clientV1.connect().then(() => {
        done();
      });
    });
    it("should receive response for v1.0 request", (done) => {
      const request = clientV1.request().send("params", [1, 2]);
      request.then((response) => {
        expect(response).to.eql({
          result: 3,
          error: null,
          id: 1
        });
        done();
      });
    });
    it("should receive error for v1.0 request", (done) => {
      const request = clientV1.request().send("foo", [1, 2]);
      request.catch((response) => {
        expect(response).to.eql({
          result: null,
          error: { code: -32601, message: "Method not found" },
          id: 2
        });
        done();
      });
    });
  });
});

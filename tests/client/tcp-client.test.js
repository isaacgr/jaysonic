const { expect } = require("chai");
const { server, serverV1 } = require("../test-server.js");
const data = require("../large-data.json");

const Jaysonic = require("../../src");

const client = new Jaysonic.client.tcp({
  host: "127.0.0.1",
  port: 8100,
  retries: 0
});

const clientV1 = new Jaysonic.client.tcp({
  host: "127.0.0.1",
  port: 8600,
  retries: 0,
  version: 1
});

before((done) => {
  server.listen().then(() => {
    serverV1.listen().then(() => {
      clientV1.connect();
      done();
    });
  });
});

after(() => {
  client.end().then(() => {
    server.close();
  });
});

describe("TCP Client", () => {
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
    });
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
        retries: 0
      });
      badClient
        .request()
        .send("add", [1, 2])
        .catch((error) => {
          expect(error).to.be.instanceOf(Error);
          done();
        });
    });
  });
  describe("requests", () => {
    it("should receive response for positional params", (done) => {
      const request = client.request().send("add", [1, 2]);
      request.then((response) => {
        expect(response).to.eql({ jsonrpc: "2.0", result: 3, id: 1 });
        done();
      });
    });
    it("should receive response for named params", (done) => {
      const request = client.request().send("greeting", { name: "Isaac" });
      request.then((response) => {
        expect(response).to.eql({
          jsonrpc: "2.0",
          result: "Hello Isaac",
          id: 2
        });
        done();
      });
    });
    it("should send notification to server", (done) => {
      const request = client.request().notify("greeting", []);
      request.then((result) => {
        expect(result).to.be.a("string");
        done();
      });
    });
    it("should handle 'method not found' error", (done) => {
      const request = client.request().send("nonexistent method", []);
      request.catch((error) => {
        expect(error).to.eql({
          jsonrpc: "2.0",
          error: { code: -32601, message: "Method not found" },
          id: 3
        });
        done();
      });
    });
    it("should handle 'invalid params' error", (done) => {
      const request = client.request().send("typeerror", [1]);
      request.catch((error) => {
        expect(error).to.eql({
          jsonrpc: "2.0",
          error: { code: -32602, message: "Invalid Parameters" },
          id: 4
        });
        done();
      });
    });
    it("should retreive large dataset", (done) => {
      const request = client.request().send("large.data", []);
      request.then((result) => {
        expect(result).to.eql({
          jsonrpc: "2.0",
          result: data,
          id: 5
        });
        done();
      });
    });
  });
  describe("batches", () => {
    it("should receive response for batch request", (done) => {
      const request = client.batch([
        client.request().message("add", [1, 2]),
        client.request().message("add", [3, 4])
      ]);
      request.then((response) => {
        expect(response).to.eql([
          { result: 3, jsonrpc: "2.0", id: 6 },
          { result: 7, jsonrpc: "2.0", id: 7 }
        ]);
        done();
      });
    });
    it("should receive error in batch response if one batch request is bad", (done) => {
      const request = client.batch([
        client.request().message("nonexistent", [1, 2]),
        client.request().message("add", [3, 4])
      ]);
      request.catch((response) => {
        expect(response).to.eql([
          {
            jsonrpc: "2.0",
            error: { code: -32601, message: "Method not found" },
            id: 8
          },
          { result: 7, jsonrpc: "2.0", id: 9 }
        ]);
        done();
      });
    });
    it("should receive 'invalid request' error for non empty array", (done) => {
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
      const request = client.request().send("add", [1, 2]);
      const request2 = client.request().send("greeting", { name: "Isaac" });
      const request3 = client.batch([
        client.request().message("add", [1, 2]),
        client.request().message("add", [3, 4])
      ]);
      const request4 = client.batch([
        client.request().message("nonexistent", [1, 2]),
        client.request().message("add", [3, 4])
      ]);
      request.then((res1) => {
        expect(res1).to.eql({ jsonrpc: "2.0", result: 3, id: 10 });
        request2.then((res2) => {
          expect(res2).to.eql({
            jsonrpc: "2.0",
            result: "Hello Isaac",
            id: 11
          });
          request3.then((res3) => {
            expect(res3).to.eql([
              { result: 3, jsonrpc: "2.0", id: 12 },
              { result: 7, jsonrpc: "2.0", id: 13 }
            ]);
            request4.catch((res4) => {
              expect(res4).to.eql([
                {
                  jsonrpc: "2.0",
                  error: { code: -32601, message: "Method not found" },
                  id: 14
                },
                { result: 7, jsonrpc: "2.0", id: 15 }
              ]);
              done();
            });
          });
        });
      });
    });
  });
  describe("notifications", () => {
    it("should handle receiving a notification", (done) => {
      client.subscribe("notification", (error, message) => {
        if (error) {
          return done(error);
        }
        expect(message).to.be.eql({
          jsonrpc: "2.0",
          method: "notification",
          params: []
        });
        done();
      });
      server.notify("notification", []);
    });
  });
  describe("v1.0 requests", () => {
    it("should receive response for v1.0 request", (done) => {
      const request = clientV1.request().send("add", [1, 2]);
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
      const request = clientV1.request().send("test", [1, 2]);
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

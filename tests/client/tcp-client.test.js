const { expect } = require("chai");

const { server } = require("../test-server.js");
const Jaysonic = require("../../src");

const client = new Jaysonic.client.tcp({ host: "127.0.0.1", port: 8100 });

// basing tests off of https://www.jsonrpc.org/specification

before((done) => {
  server.listen().then(() => {
    done();
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
        port: 8101
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
    it("should receive response for batch request", (done) => {
      const request = client.batch([
        client.request().message("add", [1, 2]),
        client.request().message("add", [3, 4])
      ]);
      request.then((response) => {
        expect(response).to.eql([
          { result: 3, jsonrpc: "2.0", id: 3 },
          { result: 7, jsonrpc: "2.0", id: 4 }
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
    it("should handle 'method not found' error", (done) => {
      const request = client.request().send("nonexistent method", []);
      request.catch((error) => {
        expect(error).to.eql({
          jsonrpc: "2.0",
          error: { code: -32601, message: "Method not found" },
          id: 5
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
          id: 6
        });
        done();
      });
    });
  });
  describe("notifications", () => {
    it("should handle receiving a notification", (done) => {
      client.subscribe("notification", (message) => {
        expect(message).to.eql({
          jsonrpc: "2.0",
          method: "notification",
          params: []
        });
      });
      server.notify({
        method: "notification",
        params: []
      });
      done();
    });
  });
});

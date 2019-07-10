const { expect } = require("chai");
const { wss } = require("../test-server.js");
const data = require("../large-data.json");

const WSClient = require("../../src/client/ws");

const ws = new WSClient();
const wsV1 = new WSClient({ version: 1 });

before((done) => {
  wss.listen().then(() => {
    wsV1.connect();
    done();
  });
});

describe("WebSocket Client", () => {
  describe("connection", () => {
    it("should connect to server", (done) => {
      ws.connect().then(() => {
        ws.onConnection().then(() => {
          done();
        });
      });
    });
  });
  describe("requests", () => {
    it("should receive response for positional params", (done) => {
      const request = ws.request().send("add", [1, 2]);
      request.then((response) => {
        expect(response).to.eql({ jsonrpc: "2.0", result: 3, id: 1 });
        done();
      });
    });
    it("should receive response for named params", (done) => {
      const request = ws.request().send("greeting", { name: "Isaac" });
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
      const request = ws.request().notify("greeting", []);
      request.then((result) => {
        expect(result).to.be.a("string");
        done();
      });
    });
    it("should receive response for batch request", (done) => {
      const request = ws.batch([
        ws.request().message("add", [1, 2]),
        ws.request().message("add", [3, 4])
      ]);
      request.then((response) => {
        expect(response).to.eql([
          { result: 3, jsonrpc: "2.0", id: 3 },
          { result: 7, jsonrpc: "2.0", id: 4 }
        ]);
        done();
      });
    });
    it("should handle 'method not found' error", (done) => {
      const request = ws.request().send("nonexistent method", []);
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
      const request = ws.request().send("typeerror", [1]);
      request.catch((error) => {
        expect(error).to.eql({
          jsonrpc: "2.0",
          error: { code: -32602, message: "Invalid Parameters" },
          id: 6
        });
        done();
      });
    });
    it("should retreive large dataset", (done) => {
      const request = ws.request().send("large.data", []);
      request.then((result) => {
        expect(result).to.eql({
          jsonrpc: "2.0",
          result: data,
          id: 7
        });
        done();
      });
    });
  });
  describe("notifications", () => {
    it("should handle receiving a notification", (done) => {
      ws.subscribe("notification", (error, message) => {
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
      wss.notify("notification", []);
    });
  });
  describe("v1.0 requests", () => {
    it("should receive response for v1.0 request", (done) => {
      const request = wsV1.request().send("add", [1, 2]);
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
      const request = wsV1.request().send("test", [1, 2]);
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

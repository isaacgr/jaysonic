const { expect } = require("chai");
const WebSocket = require("ws");
const intercept = require("intercept-stdout");
const { wss } = require("../test-server.js");
const data = require("../large-data.json");

const Jaysonic = require("../../src");

const ws = new Jaysonic.client.ws({ url: "ws://127.0.0.1:8900" });
const wsV1 = new Jaysonic.client.ws({ url: "ws://127.0.0.1:8900", version: 1 });

describe("WebSocket Node Client", () => {
  describe("connection", () => {
    it("should connect to server", (done) => {
      ws.connect().then(() => {
        wsV1.connect().then(() => {
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
    it("should retreive large dataset", (done) => {
      const request = ws.request().send("large.data", []);
      request.then((result) => {
        expect(result).to.eql({
          jsonrpc: "2.0",
          result: data,
          id: 3
        });
        done();
      });
    });
    it("should reject message with error when parse error thrown with pending call", (done) => {
      const server1 = new WebSocket.Server({ host: "127.0.0.1", port: 9907 });
      server1.on("connection", (someclient) => {
        someclient.on("message", () => {
          someclient.send("should get a parse error\r\n");
        });
      });
      const client1 = new Jaysonic.client.ws({ url: "ws://127.0.0.1:9907" });
      client1.connect().then(() => {
        client1
          .request()
          .send("add", [1, 2])
          .catch((error) => {
            expect(error).to.be.eql({
              jsonrpc: "2.0",
              error: {
                code: -32700,
                message: "Unable to parse message: 'should get a parse error\r'"
              },
              id: 1
            });
            done();
          });
      });
    });
    it("should print error to stdout when error received with no pending call", (done) => {
      let capturedText = "";
      const unhook = intercept((text) => {
        capturedText += text;
      });
      const badServer = new WebSocket.Server({ host: "127.0.0.1", port: 9906 });
      badServer.on("connection", (someclient2) => {
        someclient2.send("should get a parse error\r\n");
      });
      const client2 = new Jaysonic.client.ws({ url: "ws://127.0.0.1:9906" });
      client2.connect().then(() => {
        // needs a bit of extra time to check the output
        setTimeout(() => {
          unhook();
          expect(capturedText).to.equal(
            "Message has no outstanding calls: {\"jsonrpc\":\"2.0\",\"error\":{\"code\":-32700,\"message\":\"Unable to parse message: 'should get a parse error\\r'\"},\"id\":1}\n"
          );
          done();
        }, 100);
      });
    });
  });
  describe("batches", () => {
    it("should receive response for batch request", (done) => {
      const request = ws.batch([
        ws.request().message("add", [1, 2]),
        ws.request().message("add", [3, 4])
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
      const request = ws.batch([
        ws.request().message("nonexistent", [1, 2]),
        ws.request().message("add", [3, 4])
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
    it("should receive 'invalid request' error for non empty array", (done) => {
      const request = ws.batch([1]);
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
      const request = ws.request().send("add", [1, 2]);
      const request2 = ws.request().send("greeting", { name: "Isaac" });
      const request3 = ws.batch([
        ws.request().message("add", [1, 2]),
        ws.request().message("add", [3, 4])
      ]);
      const request4 = ws.batch([
        ws.request().message("nonexistent", [1, 2]),
        ws.request().message("add", [3, 4])
      ]);
      request.then((res1) => {
        expect(res1).to.eql({ jsonrpc: "2.0", result: 3, id: 8 });
        request2.then((res2) => {
          expect(res2).to.eql({
            jsonrpc: "2.0",
            result: "Hello Isaac",
            id: 9
          });
          request3.then((res3) => {
            expect(res3).to.eql([
              { result: 3, jsonrpc: "2.0", id: 10 },
              { result: 7, jsonrpc: "2.0", id: 11 }
            ]);
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
          });
        });
      });
    });
  });
  describe("request errors", () => {
    it("should handle 'method not found' error", (done) => {
      const request = ws.request().send("nonexistent method", []);
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
      const request = ws.request().send("typeerror", [1]);
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
      const request = ws.request().send("unknownerror", [1]);
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
  describe("notifications", () => {
    it("should handle receiving a notification", (done) => {
      ws.subscribe("notification", (message) => {
        expect(message).to.be.eql({
          jsonrpc: "2.0",
          method: "notification",
          params: []
        });
        done();
      });
      wss.notify("notification", []);
    });
    it("should unsubscribe from a notificiation", (done) => {
      const callback = () => {};
      ws.subscribe("newNotification", callback);
      expect(ws.eventNames()).to.have.lengthOf(4);
      ws.unsubscribe("newNotification", callback);
      expect(ws.eventNames()).to.have.lengthOf(3);
      done();
    });
    it("should unsubscribe from all 'notification' events", (done) => {
      ws.unsubscribeAll("notification");
      expect(ws.eventNames()).to.have.lengthOf(2);
      done();
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

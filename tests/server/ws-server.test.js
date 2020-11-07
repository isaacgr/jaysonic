const { expect } = require("chai");
const Jaysonic = require("../../src");
const { clientws } = require("../test-client");
const { wss } = require("../test-server");

wss.method(
  "promise.resolve",
  () => new Promise((resolve) => {
    setTimeout(() => {
      resolve("resolve");
    }, 10);
  })
);
wss.method(
  "promise.reject",
  () => new Promise((resolve, reject) => {
    setTimeout(() => {
      reject(new Error("reject"));
    }, 10);
  })
);

describe("WebSocket Server", () => {
  before((done) => {
    wss.listen().then((conn) => {
      expect(conn).to.have.all.keys("host", "port", "path");
      done();
    });
  });
  after((done) => {
    wss.close().then(() => {
      done();
    });
  });
  describe("connection", () => {
    it("should accept incoming connections", (done) => {
      wss.clientConnected((conn) => {
        expect(conn).to.have.all.keys("host", "port");
      });
      clientws.connect().then(() => {
        done();
      });
    });
    it("should handle requests from multiple clients", (done) => {
      const client1 = new Jaysonic.client.ws({ url: "ws://127.0.0.1:8100" });
      const client2 = new Jaysonic.client.ws({ url: "ws://127.0.0.1:8100" });
      client1.connect().then(() => {
        client2.connect().then(() => {
          const req1 = client1.request().send("params", [1, 2]);
          const req2 = client2
            .request()
            .send("named.params", { name: "jaysonic" });
          Promise.all([req1, req2]).then((results) => {
            const [res1, res2] = results;
            expect(res1).to.eql({
              jsonrpc: "2.0",
              result: 3,
              id: 1
            });
            expect(res2).to.eql({
              jsonrpc: "2.0",
              result: "Hello jaysonic",
              id: 1
            });
            done();
          });
        });
      });
    });
  });
  describe("requests", () => {
    it("should handle call with positional params", (done) => {
      const req = clientws.request().send("params", [1, 2]);
      req.then((result) => {
        expect(result).to.eql({
          jsonrpc: "2.0",
          result: 3,
          id: 1
        });
        done();
      });
    });
    it("should handle call with named params", (done) => {
      const req = clientws.request().send("named.params", { name: "jaysonic" });
      req.then((result) => {
        expect(result).to.eql({
          jsonrpc: "2.0",
          result: "Hello jaysonic",
          id: 2
        });
        done();
      });
    });
    it("should send 'method not found' error", (done) => {
      const req = clientws.request().send("foo", []);
      req.catch((result) => {
        expect(result).to.eql({
          jsonrpc: "2.0",
          error: { code: -32601, message: "Method not found" },
          id: 3
        });
        done();
      });
    });
    it("should send 'invalid params' error", (done) => {
      const req = clientws.request().send("type.error", [1]);
      req.catch((result) => {
        expect(result).to.eql({
          jsonrpc: "2.0",
          error: { code: -32602, message: "Invalid Parameters" },
          id: 4
        });
        done();
      });
    });
    it("should send 'parse error'", (done) => {
      const wstest = new window.WebSocket("ws://127.0.0.1:8100");
      wstest.onopen = () => {
        wstest.send("parse error\n");
        wstest.onmessage = (event) => {
          expect(event.data).to.eql(
            `${JSON.stringify({
              jsonrpc: "2.0",
              error: { code: -32700, message: "Parse Error" },
              id: null
            })}\n`
          );
          done();
        };
      };
    });
    it("should send 'invalid request' error", (done) => {
      const wstest = new window.WebSocket("ws://127.0.0.1:8100");
      wstest.onopen = () => {
        wstest.send(
          `${JSON.stringify({
            jsonrpc: "2.0",
            method: 1,
            params: [],
            id: 69
          })}\n`
        );
        wstest.onmessage = (event) => {
          expect(event.data).to.eql(
            `${JSON.stringify({
              jsonrpc: "2.0",
              error: { code: -32600, message: "Invalid Request" },
              id: 69
            })}\n`
          );
          done();
        };
      };
    });
  });
  describe("notifications", () => {
    it("should handle client notification", (done) => {
      wss.onNotify("single.notification", (message) => {
        expect(message).to.be.eql({
          jsonrpc: "2.0",
          method: "single.notification",
          params: []
        });
        done();
      });
      clientws.request().notify("single.notification", []);
    });
    it("should handle batch notifications", (done) => {
      wss.onNotify("batch.notification", (message) => {
        expect(message).to.be.eql({
          jsonrpc: "2.0",
          method: "batch.notification",
          params: []
        });
        done();
      });
      clientws.batch([
        clientws.request().message("batch.notification", [], false)
      ]);
    });
  });
  describe("promise methods", () => {
    it("should resolve promise method", (done) => {
      clientws
        .request()
        .send("promise.resolve", [])
        .then((result) => {
          expect(result).to.be.eql({
            result: ["resolve"],
            jsonrpc: "2.0",
            id: 5
          });
          done();
        });
    });
    it("should reject promise method", (done) => {
      clientws
        .request()
        .send("promise.reject", [])
        .catch((result) => {
          expect(result).to.be.eql({
            jsonrpc: "2.0",
            error: { code: -32603, message: "\"reject\"" },
            id: 6
          });
          done();
        });
    });
  });
});

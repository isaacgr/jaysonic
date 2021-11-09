const { expect } = require("chai");
const chai = require("chai");
const spies = require("chai-spies");
const Jaysonic = require("../../src");
const { clientws } = require("../test-client");
const { wss } = require("../test-server");

chai.use(spies);

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
      clientws.end(1000);
      done();
    });
  });
  describe("connection", () => {
    it("should be unable to listen multiple times", (done) => {
      const conn = wss.listen();
      conn.catch((error) => {
        expect(error.message).to.be.a("string");
        done();
      });
    });
    it("should accept incoming connections", (done) => {
      const method = chai.spy.on(wss, "clientConnected");
      clientws.connect().then(() => {
        try {
          expect(method).to.have.been.called.with(wss.clients[0]);
          clientws.end(1000);
          done();
        } catch (e) {
          clientws.end(1000);
          done(e);
        }
      });
    });
    it("should call clientDisconnected and remove client from this.clients", (done) => {
      const callback = chai.spy.on(wss, "clientDisconnected");
      clientws.connect().then(() => {
        const c = wss.clients[0];
        clientws.end(1000);
        setTimeout(() => {
          try {
            expect(callback).to.have.been.called.with(c);
            expect(wss.clients).to.have.lengthOf(0);
            done();
          } catch (e) {
            done(e);
          }
        }, 500);
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
            client1.end();
            client2.end();
            done();
          });
        });
      });
    });
  });
  describe("requests", () => {
    before((done) => {
      clientws.connect().then(() => {
        done();
      });
    });
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
            result: "resolve",
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
  describe("listener events", () => {
    it("should set the factory to stop listening and remove all connected clients", (done) => {
      const wss2 = new Jaysonic.server.ws({ port: 8101 });
      wss2.listen().then(() => {
        const client = new Jaysonic.client.ws({
          url: "ws://127.0.0.1:8101",
          retries: 0
        });
        client.connect().then(() => {
          expect(wss2.clients).to.have.lengthOf(1);
          wss2.close().then(() => {
            expect(wss2.listening).to.eql(false);
            expect(wss2.clients).to.eql([]);
            client.end();
            done();
          });
        });
      });
    });
    it("should throw an error if an 'error' event occurs when starting serer", (done) => {
      const wss3 = new Jaysonic.server.ws({ port: 0, host: "1.1.1.1" });
      wss3.listen().catch((error) => {
        expect(error).to.be.instanceOf(Error);
        expect(error.code).to.eql("EADDRNOTAVAIL");
        done();
      });
    });
  });
});

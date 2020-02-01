const { expect } = require("chai");
const Jaysonic = require("../../src");

const { clientws } = require("../test-client");

const wss = new Jaysonic.server.ws({ port: 9000 });
wss.method("add", ([a, b]) => a + b);
wss.method("greeting", ({ name }) => `Hello ${name}`);
wss.method("typeerror", ([a]) => {
  if (typeof a !== "string") {
    throw new TypeError();
  }
});
wss.method(
  "promiseresolve",
  () => new Promise((resolve) => {
    setTimeout(() => {
      resolve("worked");
    }, 10);
  })
);
wss.method(
  "promisereject",
  () => new Promise((resolve, reject) => {
    setTimeout(() => {
      reject(new Error("broke"));
    }, 10);
  })
);

before((done) => {
  wss.listen().then((conn) => {
    expect(conn).to.have.all.keys("host", "port", "path");
    done();
  });
});

describe("WebSocket Server", () => {
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
      const client1 = new Jaysonic.client.ws({ url: "ws://127.0.0.1:9000" });
      const client2 = new Jaysonic.client.ws({ url: "ws://127.0.0.1:9000" });
      client1.connect().then(() => {
        client2.connect().then(() => {
          const req1 = client1.request().send("add", [1, 2]);
          const req2 = client2.request().send("greeting", { name: "Isaac" });
          Promise.all([req1, req2]).then((results) => {
            const [res1, res2] = results;
            expect(res1).to.eql({
              jsonrpc: "2.0",
              result: 3,
              id: 1
            });
            expect(res2).to.eql({
              jsonrpc: "2.0",
              result: "Hello Isaac",
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
      const req = clientws.request().send("add", [1, 2]);
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
      const req = clientws.request().send("greeting", { name: "Isaac" });
      req.then((result) => {
        expect(result).to.eql({
          jsonrpc: "2.0",
          result: "Hello Isaac",
          id: 2
        });
        done();
      });
    });
    it("should send 'method not found' error", (done) => {
      const req = clientws.request().send("nonexistent", []);
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
      const req = clientws.request().send("typeerror", [1]);
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
      const wstest = new window.WebSocket("ws://127.0.0.1:9000");
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
      const wstest = new window.WebSocket("ws://127.0.0.1:9000");
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
      wss.onNotify("notification", (message) => {
        expect(message).to.be.eql({
          jsonrpc: "2.0",
          method: "notification",
          params: []
        });
        done();
      });
      clientws.request().notify("notification", []);
    });
    it("should handle batch notifications", (done) => {
      wss.onNotify("test", (message) => {
        expect(message).to.be.eql({
          jsonrpc: "2.0",
          method: "test",
          params: []
        });
        done();
      });
      clientws.batch([clientws.request().message("test", [], false)]);
    });
  });
  describe("promise methods", () => {
    it("should resolve promise method", (done) => {
      clientws
        .request()
        .send("promiseresolve", [])
        .then((result) => {
          expect(result).to.be.eql({
            result: ["worked"],
            jsonrpc: "2.0",
            id: 5
          });
          done();
        });
    });
    it("should reject promise method", (done) => {
      clientws
        .request()
        .send("promisereject", [])
        .catch((result) => {
          expect(result).to.be.eql({
            jsonrpc: "2.0",
            error: { code: -32603, message: "\"broke\"" },
            id: 6
          });
          done();
        });
    });
  });
});

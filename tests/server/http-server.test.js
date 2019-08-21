const { expect } = require("chai");
const chai = require("chai");
const chaiHttp = require("chai-http");

const Jaysonic = require("../../src");

const server = new Jaysonic.server.http({ port: 8000 });
const serverV1 = new Jaysonic.server.http({ port: 8400, version: 1 });
const { clienthttp } = require("../test-client");

chai.use(chaiHttp);

const httpRequest = chai.request("http://localhost:8000");
const httpRequestV1 = chai.request("http://localhost:8400");

server.method("add", ([a, b]) => a + b);
server.method("greeting", ({ name }) => `Hello ${name}`);
server.method("typeerror", ([a]) => {
  if (typeof a !== "string") {
    throw new TypeError();
  }
});
server.onNotify("notify", () => "notified");

before((done) => {
  serverV1.listen().then(() => {
    done();
  });
});

describe("HTTP Server", () => {
  describe("connection", () => {
    it("should listen for requests", (done) => {
      const conn = server.listen();
      conn.then((result) => {
        expect(result).to.be.eql({
          host: "127.0.0.1",
          port: 8000
        });
        done();
      });
    });
    it("should be unable to listen multiple times", (done) => {
      const conn = server.listen();
      conn.catch((error) => {
        expect(error.message).to.be.a("string");
        done();
      });
    });
    it("should handle requests from multiple clients", (done) => {
      const client1 = new Jaysonic.client.http({ port: 8000 });
      const client2 = new Jaysonic.client.http({ port: 8000 });
      const req1 = client1.request().send("add", [1, 2]);
      const req2 = client2.request().send("greeting", { name: "Isaac" });
      Promise.all([req1, req2]).then((results) => {
        const [res1, res2] = results;
        expect(res1.body).to.eql({
          jsonrpc: "2.0",
          result: 3,
          id: 1
        });
        expect(res2.body).to.eql({
          jsonrpc: "2.0",
          result: "Hello Isaac",
          id: 1
        });
        done();
      });
    });
  });
  describe("requests", () => {
    it("should hanlde call with positional params", (done) => {
      const request = clienthttp.request().send("add", [1, 2]);
      request.then((response) => {
        expect(response.body).to.be.eql({
          result: 3,
          jsonrpc: "2.0",
          id: 1
        });
        done();
      });
    });
    it("should handle call with named params", (done) => {
      const request = clienthttp.request().send("greeting", { name: "Isaac" });
      request.then((response) => {
        expect(response.body).to.be.eql({
          result: "Hello Isaac",
          jsonrpc: "2.0",
          id: 2
        });
        done();
      });
    });
    it("should respond with 'invalid params' error", (done) => {
      const request = clienthttp.request().send("add", {});
      request.catch((response) => {
        expect(response.body).to.be.eql({
          jsonrpc: "2.0",
          error: {
            code: -32602,
            message: "Invalid Parameters"
          },
          id: 3
        });
        done();
      });
    });
    it("should respond with 'method not found' error", (done) => {
      const request = clienthttp.request().send("nonexistent", {});
      request.catch((response) => {
        expect(response.body).to.be.eql({
          jsonrpc: "2.0",
          error: {
            code: -32601,
            message: "Method not found"
          },
          id: 4
        });
        done();
      });
    });
    it("should respond with 'parse error'", (done) => {
      httpRequest
        .post("/")
        .set("Content-Type", "application/json")
        .send("{]\n")
        .end((error, response) => {
          expect(JSON.parse(response.text)).to.be.eql({
            jsonrpc: "2.0",
            error: { code: -32700, message: "Parse Error" },
            id: null
          });
          done();
        });
    });
    it("should respond with 'invalid request' error", (done) => {
      httpRequest
        .post("/")
        .set("Content-Type", "application/json")
        .send(
          `${JSON.stringify({
            jsonrpc: "2.0",
            method: 1,
            params: [],
            id: 69
          })}\n`
        )
        .end((error, response) => {
          expect(JSON.parse(response.text)).to.be.eql({
            jsonrpc: "2.0",
            error: { code: -32600, message: "Invalid Request" },
            id: 69
          });
          done();
        });
    });
    it("should receive 'invalid request' error for non empty array", (done) => {
      httpRequest
        .post("/")
        .set("Content-Type", "application/json")
        .send("[1]\n")
        .end((error, response) => {
          expect(JSON.parse(response.text)).to.be.eql([
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
  describe("v1.0 responses", () => {
    it("should provide a v1.0 response to a 1.0 request", (done) => {
      httpRequest
        .post("/")
        .set("Content-Type", "application/json")
        .send(
          `${JSON.stringify({
            method: "add",
            params: [1, 2],
            id: 80
          })}\n`
        )
        .end((error, response) => {
          expect(JSON.parse(response.text)).to.be.eql({
            result: 3,
            error: null,
            id: 80
          });
          done();
        });
    });
    it("should provide a v1.0 error response to a 1.0 request", (done) => {
      httpRequestV1
        .post("/")
        .set("Content-Type", "application/json")
        .send(
          `${JSON.stringify({
            method: "add",
            params: {},
            id: 1
          })}\n`
        )
        .end((error, response) => {
          expect(JSON.parse(response.text)).to.be.eql({
            result: null,
            error: {
              code: -32601,
              message: "Method not found"
            },
            id: 1
          });
          done();
        });
    });
  });
});

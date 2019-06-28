const { expect } = require("chai");
const chai = require("chai");
const chaiHttp = require("chai-http");

const Jayson = require("../../src");

const server = new Jayson.server.http({ port: 8000 });
const { clienthttp } = require("../test-client");

chai.use(chaiHttp);

const httpRequest = chai.request("http://localhost:8000");

server.method("add", ([a, b]) => a + b);

server.method("greeting", ({ name }) => `Hello ${name}`);

server.method("typeerror", ([a]) => {
  if (typeof a !== "string") {
    throw new TypeError();
  }
});

server.onNotify("notify", () => "notified");

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
        .send("{]")
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
        .send({
          jsonrpc: "2.0",
          method: 1,
          params: [],
          id: 69
        })
        .end((error, response) => {
          expect(JSON.parse(response.text)).to.be.eql({
            jsonrpc: "2.0",
            error: { code: -32600, message: "Invalid Request" },
            id: 69
          });
          done();
        });
    });
  });
});

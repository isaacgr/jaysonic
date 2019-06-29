const { expect } = require("chai");
const Jaysonic = require("../../src");
const chai = require("chai");
const chaiHttp = require("chai-http");
const { serverHttp } = require("../test-server");

const clienthttp = new Jaysonic.client.http({ port: 8800 });
chai.use(chaiHttp);
const httpRequest = chai.request("http://localhost:8800");

before((done) => {
  serverHttp.listen().then(() => {
    done();
  });
});

describe("HTTP Client", () => {
  describe("connection", () => {});
  describe("requests", () => {
    it("should get a response for positional params", (done) => {
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
    it("should get a response for named params", (done) => {
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
    it("should receive a '204' response for a notification", (done) => {
      const request = clienthttp.request().notify("notify", []);
      request.then((response) => {
        expect(response.statusCode).to.be.equal(204);
        done();
      });
    });
    it("should get an 'invalid params' error", (done) => {
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
    it("should get a 'method not found' error", (done) => {
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
    it("should receive response for batch request", (done) => {
      const request = clienthttp.batch([
        clienthttp.request().message("add", [1, 2]),
        clienthttp.request().message("add", [3, 4])
      ]);
      request.then((response) => {
        expect(response).to.eql([
          { result: 3, jsonrpc: "2.0", id: 5 },
          { result: 7, jsonrpc: "2.0", id: 6 }
        ]);
        done();
      });
    });
    it("should receive 'invalid request' error for non empty array", (done) => {
      httpRequest
        .post("/")
        .set("Content-Type", "application/json")
        .send([1])
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
});

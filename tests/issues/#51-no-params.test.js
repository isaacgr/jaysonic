const { expect } = require("chai");
const Jaysonic = require("../../src");

const tcpserver = new Jaysonic.server.tcp({ port: 6666 });
const httpserver = new Jaysonic.server.http({ port: 9998 });
const wss = new Jaysonic.server.ws({ port: 6667 });

const tcpclient = new Jaysonic.client.tcp({ port: 6666 });
const httpclient = new Jaysonic.client.http({ port: 9998 });
const wsclient = new Jaysonic.client.ws({ url: "ws://127.0.0.1:6667" });

const noParams = () => "success";

tcpserver.method("noParams", noParams);
httpserver.method("noParams", noParams);
wss.method("noParams", noParams);

describe("#51 Empty params", () => {
  describe("server", () => {
    describe("tcp", () => {
      it("should handle calling method when no params in request", (done) => {
        tcpserver.listen().then(() => {
          tcpclient.connect().then(() => {
            tcpclient
              .request()
              .send("noParams")
              .then((result) => {
                expect(result).to.be.eql({
                  result: "success",
                  jsonrpc: "2.0",
                  id: 1
                });
                done();
              });
          });
        });
      });
    });
    describe("http", () => {
      it("should handle calling method when no params in request", (done) => {
        httpserver.listen().then(() => {
          httpclient
            .request()
            .send("noParams")
            .then((result) => {
              expect(result.body).to.be.eql({
                result: "success",
                jsonrpc: "2.0",
                id: 1
              });
              done();
            });
        });
      });
    });
    describe("wss", () => {
      it("should handle calling method when no params in request", (done) => {
        wss.listen().then(() => {
          wsclient.connect().then(() => {
            wsclient
              .request()
              .send("noParams")
              .then((result) => {
                expect(result).to.be.eql({
                  result: "success",
                  jsonrpc: "2.0",
                  id: 1
                });
                done();
              });
          });
        });
      });
    });
  });
});

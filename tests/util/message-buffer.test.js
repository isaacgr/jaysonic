const { expect } = require("chai");
const net = require("net");
const intercept = require("intercept-stdout");
const Jaysonic = require("../../src");

const tcpServer = new Jaysonic.server.tcp({ port: 8989 });
const tcpclient = new Jaysonic.client.tcp({
  host: "127.0.0.1",
  port: 8887
});

tcpServer.method("add", ([a, b]) => a + b);

before((done) => {
  tcpServer.listen().then(() => {
    done();
  });
});

const message1 = {
  jsonrpc: "2.0",
  id: 1,
  method: "add",
  params: [1, 2]
};
const message2 = {
  jsonrpc: "2.0",
  id: 2,
  method: "add",
  params: [1, 2]
};

const res1 = {
  jsonrpc: "2.0",
  method: "notify",
  params: 1
};

const res2 = {
  jsonrpc: "2.0",
  method: "notify",
  params: 1
};

describe("Message Buffer", () => {
  describe("server side", () => {
    it("should return 2 responses when 3rd message has no delimiter", (done) => {
      const socket = new net.Socket();
      const chunk = `${JSON.stringify(message1)}\n${JSON.stringify(
        message2
      )}\n`;
      const badChunk = "test";
      let messageBuffer = "";
      socket.connect(8989, "127.0.0.1", () => {
        socket.write(chunk + badChunk);
        socket.on("data", (data) => {
          messageBuffer += data;
          const messages = messageBuffer.split("\n");
          expect(messages).to.be.length(3);
          messages.forEach((message) => {
            let id = 1;
            try {
              expect(message).to.equal(
                `${JSON.stringify({
                  jsonrpc: "2.0",
                  result: 3,
                  id
                })}\n`
              );
              id += 1;
            } catch (e) {
              if (messages.indexOf(message) === messages.length) {
                throw e;
              }
            }
          });
          socket.destroy();
        });
        socket.on("close", () => {
          done();
        });
      });
    });
    it("should return a parse error if last message in buffer was not delimited", (done) => {
      const chunk = `${JSON.stringify(message1)}\n`;
      let messageBuffer = "";
      const socket = new net.Socket();
      socket.connect(8989, "127.0.0.1", () => {
        socket.write(chunk);
        socket.on("data", (data) => {
          messageBuffer += data;
          const messages = messageBuffer.split("\n");
          expect(messages).to.be.length(2);
          messages.forEach((message) => {
            try {
              expect(message).to.equal(
                `${JSON.stringify({
                  jsonrpc: "2.0",
                  error: { code: -32700, message: "Parse Error" },
                  id: 1
                })}\n`
              );
            } catch (e) {
              if (messages.indexOf(message) === messages.length) {
                throw e;
              }
            }
          });
          socket.destroy();
        });
        socket.on("close", () => {
          done();
        });
      });
    });
    it("should return 2 responses for valid messages after buffer is emptied", (done) => {
      const socket = new net.Socket();
      const chunk = `${JSON.stringify(message1)}\n${JSON.stringify(
        message2
      )}\n`;
      let messageBuffer = "";
      socket.connect(8989, "127.0.0.1", () => {
        socket.write(chunk);
        socket.on("data", (data) => {
          messageBuffer += data;
          const messages = messageBuffer.split("\n");
          expect(messages).to.be.length(3);
          messages.forEach((message) => {
            let id = 1;
            try {
              expect(message).to.equal(
                `${JSON.stringify({
                  jsonrpc: "2.0",
                  result: 3,
                  id
                })}\n`
              );
              id += 1;
            } catch (e) {
              if (messages.indexOf(message) === messages.length) {
                throw e;
              }
            }
          });
          socket.destroy();
        });
        socket.on("close", () => {
          done();
        });
      });
    });
  });
  describe("client side", () => {
    it("should receive a response if 2nd one is invalid and then a parse error if third one is valid", (done) => {
      let capturedText = "";
      const unhook = intercept((text) => {
        capturedText += text;
      });
      const server = new net.Server();
      server.listen({ host: "127.0.0.1", port: 8887 });
      server.on("connection", (someclient) => {
        someclient.write(
          `${JSON.stringify(res1)}\ntest${JSON.stringify(res2)}\n`
        );
      });
      tcpclient.connect().then(() => {
        tcpclient.subscribe("notify", (res) => {
          setTimeout(() => {
            expect(res).to.be.eql({
              jsonrpc: "2.0",
              method: "notify",
              params: 1
            });
            unhook();
            expect(capturedText).to.equal(
              "Message has no outstanding calls: {\"jsonrpc\":\"2.0\",\"error\":{\"code\":-32700,\"message\":\"Unable to parse message: 'test{\\\"jsonrpc\\\":\\\"2.0\\\",\\\"method\\\":\\\"notify\\\",\\\"params\\\":1}'\"},\"id\":null}\n"
            );
            done();
          }, 100);
        });
      });
    });
  });
});

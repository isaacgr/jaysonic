const { expect } = require("chai");
const {
  formatRequest,
  formatResponse,
  formatError
} = require("../../src/util/format");
const Jaysonic = require("../../src");
const baseProtocol = require("../../src/server/protocol/base");

const server = new Jaysonic.server.tcp();
const wss = new Jaysonic.server.ws();
const protocol = new baseProtocol(undefined, undefined, 2, "\n");

describe("formatRequest", () => {
  describe("methods", () => {
    it("should throw error if method is number", (done) => {
      const params = {
        method: 1,
        params: [],
        id: 1,
        options: { delimiter: "\n" }
      };
      try {
        formatRequest(params);
      } catch (e) {
        expect(e).to.be.instanceOf(TypeError);
        done();
      }
    });
    it("should throw error if method is object", (done) => {
      const params = {
        method: { foo: "bar" },
        params: [],
        id: 1,
        options: { delimiter: "\n" }
      };
      try {
        formatRequest(params);
      } catch (e) {
        expect(e).to.be.instanceOf(TypeError);
        done();
      }
    });
    it("should throw error if method is array", (done) => {
      const params = {
        method: [],
        params: [],
        id: 1,
        options: { delimiter: "\n" }
      };
      try {
        formatRequest(params);
      } catch (e) {
        expect(e).to.be.instanceOf(TypeError);
        done();
      }
    });
  });
  describe("params", () => {
    it("should throw error if params is number", (done) => {
      const params = {
        method: "foo",
        params: 1,
        id: 1,
        options: { delimiter: "\n" }
      };
      try {
        formatRequest(params);
      } catch (e) {
        expect(e).to.be.instanceOf(TypeError);
        done();
      }
    });
    it("should throw error if params is string", (done) => {
      const params = {
        method: "foo",
        params: "foo",
        id: 1,
        options: { delimiter: "\n" }
      };
      try {
        formatRequest(params);
      } catch (e) {
        expect(e).to.be.instanceOf(TypeError);
        done();
      }
    });
    it("should throw error if params is function", (done) => {
      const params = {
        method: "foo",
        params: () => "foo",
        id: 1,
        options: { delimiter: "\n" }
      };
      try {
        formatRequest(params);
      } catch (e) {
        expect(e).to.be.instanceOf(TypeError);
        done();
      }
    });
    it("should generate request with no params if not defined", (done) => {
      const params = {
        method: "foo",
        id: 1,
        delimiter: "\n"
      };
      const message = formatRequest(params);
      expect(message).to.be.eql("{\"method\":\"foo\",\"jsonrpc\":\"2.0\",\"id\":1}\n");
      done();
    });
  });
});

describe("formatResponse", () => {
  describe("errors", () => {
    it("should throw error if both params and result are given", (done) => {
      const params = {
        jsonrpc: 2,
        id: 1,
        result: 1,
        params: [],
        delimiter: "\n"
      };
      try {
        formatResponse(params);
      } catch (e) {
        expect(e).to.be.instanceOf(Error);
        done();
      }
    });
    it("should throw error if method and id are given", (done) => {
      const params = {
        jsonrpc: 2,
        id: 1,
        method: "foo",
        params: [],
        delimiter: "\n"
      };
      try {
        formatResponse(params);
      } catch (e) {
        expect(e).to.be.instanceOf(Error);
        done();
      }
    });
    it("should throw error if method is not a string", (done) => {
      const params = {
        jsonrpc: 2,
        method: [],
        params: [],
        delimiter: "\n"
      };
      try {
        formatResponse(params);
      } catch (e) {
        expect(e).to.be.instanceOf(TypeError);
        done();
      }
    });
    it("should throw error if params is not an object or array", (done) => {
      const params = {
        jsonrpc: 2,
        method: "foo",
        params: 1,
        delimiter: "\n"
      };
      try {
        formatResponse(params);
      } catch (e) {
        expect(e).to.be.instanceOf(TypeError);
        done();
      }
    });
  });
  describe("responses", () => {
    describe("2.0 responses", () => {
      it("should return properly formatted 2.0 response", (done) => {
        const params = {
          jsonrpc: 2,
          id: 1,
          result: 19,
          delimiter: "\n"
        };
        const response = formatResponse(params);
        expect(response).to.eql("{\"result\":19,\"jsonrpc\":\"2.0\",\"id\":1}\n");
        done();
      });
      it("should return notification with params", (done) => {
        const params = {
          jsonrpc: 2,
          method: "update",
          params: [1, 2, 3, 4, 5],
          delimiter: "\n"
        };
        const response = formatResponse(params);
        expect(response).to.eql(
          "{\"params\":[1,2,3,4,5],\"jsonrpc\":\"2.0\",\"method\":\"update\"}\n"
        );
        done();
      });
    });
    describe("1.0 responses", () => {
      it("should return properly formatted 1.0 response", (done) => {
        const params = {
          id: 1,
          result: "Hello JSON-RPC",
          delimiter: "\n"
        };
        const response = formatResponse(params);
        expect(response).to.eql(
          "{\"result\":\"Hello JSON-RPC\",\"error\":null,\"id\":1}\n"
        );
        done();
      });
      it("should return notification with params", (done) => {
        const params = {
          method: "update",
          params: [1, 2, 3, 4, 5],
          delimiter: "\n"
        };
        const response = formatResponse(params);
        expect(response).to.eql(
          "{\"params\":[1,2,3,4,5],\"error\":null,\"id\":null,\"method\":\"update\"}\n"
        );
        done();
      });
    });
  });
});

describe("formatError", () => {
  describe("throwing errors", () => {
    it("should return error if no message", (done) => {
      const params = {
        code: -32601,
        jsonrpc: 2,
        id: 1,
        delimiter: "\n"
      };
      try {
        formatError(params);
      } catch (e) {
        expect(e).to.be.instanceOf(Error);
        done();
      }
    });
  });
  describe("sending errors", () => {
    it("should return 2.0 response with error object", (done) => {
      const params = {
        code: -32601,
        message: "Method not found",
        jsonrpc: 2,
        id: 1,
        delimiter: "\n"
      };
      const response = formatError(params);
      expect(response).to.eql(
        "{\"jsonrpc\":\"2.0\",\"error\":{\"code\":-32601,\"message\":\"Method not found\"},\"id\":1}\n"
      );
      done();
    });
    it("should return 1.0 response with error object", (done) => {
      const params = {
        code: -32601,
        message: "Method not found",
        id: 1,
        delimiter: "\n"
      };
      const response = formatError(params);
      expect(response).to.eql(
        "{\"result\":null,\"error\":{\"code\":-32601,\"message\":\"Method not found\"},\"id\":1}\n"
      );
      done();
    });
    it("should include data in error object if given", (done) => {
      const params = {
        jsonrpc: 2,
        code: -32601,
        message: "Method not found",
        id: 1,
        data: [1, 2, 3, 4, 5],
        delimiter: "\n"
      };
      const response = formatError(params);
      expect(response).to.eql(
        "{\"jsonrpc\":\"2.0\",\"error\":{\"code\":-32601,\"message\":\"Method not found\",\"data\":[1,2,3,4,5]},\"id\":1}\n"
      );
      done();
    });
  });
});

describe("getResult()", () => {
  it("should return 'invalid params' if result is undefined", (done) => {
    protocol
      .getResult({
        jsonrpc: 2,
        method: "foo",
        id: 1,
        params: [1, 2, 3, 4, 5]
      })
      .catch((error) => {
        expect(error).to.eql(
          "{\"jsonrpc\":\"2.0\",\"error\":{\"code\":-32602,\"message\":\"Invalid Parameters\"},\"id\":1}\n"
        );
        done();
      });
  });
});

describe("server.notify()", () => {
  describe("tcp server", () => {
    it("should throw an error if notifications is not an array", (done) => {
      try {
        server.notify({});
      } catch (e) {
        expect(e.message).to.be.a("string", "Invalid arguments");
        done();
      }
    });
    it("should throw an error if notifications array is empty", (done) => {
      try {
        server.notify([]);
      } catch (e) {
        expect(e.message).to.be.a("string", "Invalid arguments");
        done();
      }
    });
    it("should throw an error if a response cannot be generated", (done) => {
      try {
        server.notify([[]]);
      } catch (e) {
        expect(e.message).to.be.a(
          "string",
          "Unable to generate a response object"
        );
        done();
      }
    });
    it("should return an error if no clients are connected", (done) => {
      const res = server.notify([["foo", []]]);
      expect(res).to.be.an("array");
      expect(res[0]).to.be.instanceOf(Error);
      expect(res[0].message).to.be.a("string", "No clients connected");
      done();
    });
    it("should return a list of error objects if there was an issue sending out to a client", (done) => {
      server.clients.push(1);
      const res = server.notify([["foo", []]]);
      expect(res).to.be.an("array");
      expect(res[0]).to.be.instanceOf(Error);
      expect(res[0].message).to.be.a("string");
      done();
    });
  });
  describe("ws server", () => {
    it("should throw an error if notifications is not an array", (done) => {
      try {
        wss.notify({});
      } catch (e) {
        expect(e.message).to.be.a("string", "Invalid arguments");
        done();
      }
    });
    it("should throw an error if notifications array is empty", (done) => {
      try {
        wss.notify([]);
      } catch (e) {
        expect(e.message).to.be.a("string", "Invalid arguments");
        done();
      }
    });
    it("should throw an error if a response cannot be generated", (done) => {
      try {
        wss.notify([[]]);
      } catch (e) {
        expect(e.message).to.be.a(
          "string",
          "Unable to generate a response object"
        );
        done();
      }
    });
    it("should return an error if no clients are connected", (done) => {
      const res = wss.notify([["foo", []]]);
      expect(res).to.be.an("array");
      expect(res[0]).to.be.instanceOf(Error);
      expect(res[0].message).to.be.a("string", "No clients connected");
      done();
    });
    it("should return a list of error objects if there was an issue sending out to a client", (done) => {
      wss.clients.push(1);
      const res = server.notify([["foo", []]]);
      expect(res).to.be.an("array");
      expect(res[0]).to.be.instanceOf(Error);
      expect(res[0].message).to.be.a("string");
      done();
    });
  });
});

const { expect } = require("chai");
const JsonRpcServerFactory = require("../../src/server");

class TestFactory extends JsonRpcServerFactory {
  handleTest() {}

  test() {}
}

const test = new TestFactory();

describe("_getAllFuncs", () => {
  it("should return a list of all server class methods which start with \"handle\"", (done) => {
    expect(test._getAllFuncs(test)).to.be.an("array");
    expect(test._getAllFuncs(test).length).to.eql(1);
    expect(test._getAllFuncs(test)[0]).to.eql("handleTest");
    done();
  });
});

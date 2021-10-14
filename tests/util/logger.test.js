const { expect } = require("chai");
const logging = require("../../src/util/logger");

describe("Logger", () => {
  it("should return new instance of logger", () => {
    const logger = logging.getInstance();
    expect(logger.log).to.be.eql(console);
  });
  it("should return logger.log", () => {
    const logger = logging.getLogger();
    expect(logger).to.be.eql(console);
  });
  it("should instantiate a new logging function", () => {
    const newLogger = {};
    logging.setLogger(newLogger);
    expect(logging.getLogger()).to.eql(newLogger);
    // set it back to console over to not mess up other tests
    logging.setLogger(console);
    expect(logging.getLogger()).to.eql(console);
  });
});

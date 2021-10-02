class Logger {
  constructor() {
    if (Logger._instance) {
      return Logger._instance;
    }
    Logger._instance = this;
    this.log = console;
  }

  setLogger(newLogger) {
    this.log = newLogger;
  }

  getLogger() {
    return Logger._instance || new Logger();
  }
}

const logging = {
  setLogger(newLogger) {
    new Logger().setLogger(newLogger);
  },
  getLogger() {
    return new Logger().getLogger().log;
  },
  getInstance() {
    return new Logger().getLogger();
  }
};

module.exports = logging;

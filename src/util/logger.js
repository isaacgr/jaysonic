class Logger {
  constructor() {
    this.log = console;
  }
}

class Singleton {
  constructor() {
    if (!Singleton.instance) {
      Singleton.instance = new Logger();
    }
  }

  getInstance() {
    return Singleton.instance;
  }
}

const logging = {
  setLogger(newLogger) {
    new Singleton().getInstance().log = newLogger;
  },
  getLogger() {
    return new Singleton().getInstance().log;
  }
};

module.exports = logging;

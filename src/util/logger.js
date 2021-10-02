class Logger {
  /**
   * Singleton logging class to provide custom logger for library
   *
   * @returns instance of Logger
   */
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
  /**
   * Singleton logging class to provide custom logger for library
   *
   * @returns instance of Logger
   */
  setLogger(newLogger) {
    new Logger().setLogger(newLogger);
  },
  /**
   * Overwrite Logger.log, default `console`, which is used for
   * messages within the library
   *
   * @param {object} newLogger Object to overwrite `console` logging
   */
  getLogger() {
    return new Logger().getLogger().log;
  },
  /**
   * Get `Logger` instance
   *
   * @returns instance of Logger
   */
  getInstance() {
    return new Logger().getLogger();
  }
};

module.exports = logging;

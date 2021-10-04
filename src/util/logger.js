class Logger {
  /**
   * Singleton logging class to provide custom logger for library.
   *
   * Define the new logger at the top of the program, before instantiating
   * any new client or server classes.
   *
   * @returns instance of `Logger`
   */
  constructor() {
    if (Logger._instance) {
      return Logger._instance;
    }
    Logger._instance = this;
    this.log = console;
  }

  /**
   * Overwrite `Logger.log`, default `console`, which is used for
   * messages within the library
   *
   * @param {object} newLogger Object to overwrite `console` logging
   */
  setLogger(newLogger) {
    this.log = newLogger;
  }

  /**
   *
   * @returns `Logger.log`
   */
  getLogger() {
    return new Logger().getInstance().log;
  }

  /**
   *
   * @returns instance of `Logger`
   */
  getInstance() {
    return Logger._instance || new Logger();
  }
}

module.exports = new Logger();

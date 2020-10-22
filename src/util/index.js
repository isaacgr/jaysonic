/**
 * @namespace Utils
 */

const Utils = module.exports;

/**
 * @static
 * @type MessageBuffer
 */
Utils.MessageBuffer = require("./buffer");

/**
 * Generate a valid JSON-RPC request, response or error object
 * with an appended delimiter.
 *
 * @static
 * @namespace Utils.format
 */
Utils.format = require("./format");

/**
 * @static
 * @namespace Utils.constants
 */
Utils.constants = require("./constants");

/**
 * Namespace available as require('jaysonic')
 * @namespace Jaysonic
 */
const Jaysonic = module.exports;

/**
 * @static
 * @type JsonRpcClientFactory
 */
Jaysonic.client = require("./client");

/**
 * @static
 * @type JsonRpcServerFactory
 */
Jaysonic.server = require("./server");

/**
 * @static
 * @type Logger
 */
Jaysonic.logging = require("./util/logger");

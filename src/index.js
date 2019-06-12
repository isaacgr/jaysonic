/**
 * Namespace available as require('jaysonic')
 * @namespace Jaysonic
 */

const Jaysonic = module.exports;

/**
 * @static
 * @type Client
 */

Jaysonic.client = Jaysonic.client = require("./client");

/**
 * @static
 * @type Server
 */

Jaysonic.server = Jaysonic.server = require("./server");

/**
 * Namespace available as require('jsonic')
 * @namespace Jsonic
 */

const Jsonic = module.exports;

/**
 * @static
 * @type Client
 */

Jsonic.client = Jsonic.client = require("./client");

/**
 * @static
 * @type Server
 */

Jsonic.server = Jsonic.server = require("./server");

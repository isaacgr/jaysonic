/**
 * @property {object} ERR_CODES
 * @property {number} ERR_CODES.parseError "-32700"
 * @property {number} ERR_CODES.invalidRequest "-32600"
 * @property {number} ERR_CODES.methodNotFound "-32601"
 * @property {number} ERR_CODES.invalidParams "-32602"
 * @property {number} ERR_CODES.internal "-32603"
 * @property {number} ERR_CODES.timeout "-32000"
 * @property {number} ERR_CODES.unknown "-32001"
 * @memberof Utils.constants
 *
 */
const ERR_CODES = {
  parseError: -32700,
  invalidRequest: -32600,
  methodNotFound: -32601,
  invalidParams: -32602,
  internal: -32603,
  timeout: -32000,
  unknown: -32001
};

/**
 * @property {object} ERR_CODES
 * @property {string} ERR_CODES.parseError "Parse Error"
 * @property {string} ERR_CODES.invalidRequest "Invalid Request"
 * @property {string} ERR_CODES.methodNotFound "Method not found"
 * @property {string} ERR_CODES.invalidParams "Invalid Parameters"
 * @property {string} ERR_CODES.internal "Internal Error"
 * @property {string} ERR_CODES.timeout "Request Timeout"
 * @property {string} ERR_CODES.unknown "Unknown Error"
 * @memberof Utils.constants
 */
const ERR_MSGS = {
  parseError: "Parse Error",
  invalidRequest: "Invalid Request",
  methodNotFound: "Method not found",
  invalidParams: "Invalid Parameters",
  internal: "Internal Error",
  timeout: "Request Timeout",
  unknown: "Unknown Error"
};

/**
 * Returns HTTP status code for a given error code
 * @property {object} errorToStatus
 * @property {number} errorToStatus.-32700 500
 * @property {number} errorToStatus.-32600 400
 * @property {number} errorToStatus.-32601 404
 * @property {number} errorToStatus.-32602 500
 * @property {number} errorToStatus.-32603 500
 * @property {number} errorToStatus.-32000 408
 * @property {number} errorToStatus.-32001 500
 * @memberof Utils.constants
 */
const errorToStatus = {
  "-32700": 500,
  "-32600": 400,
  "-32601": 404,
  "-32602": 500,
  "-32603": 500,
  "-32000": 408,
  "-32001": 500
};

module.exports = {
  ERR_CODES,
  ERR_MSGS,
  errorToStatus
};

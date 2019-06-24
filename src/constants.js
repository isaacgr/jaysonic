const ERR_CODES = {
  parseError: -32700,
  invalidRequest: -32600,
  methodNotFound: -32601,
  invalidParams: -32602,
  internal: -32603
};

const ERR_MSGS = {
  parseError: "Parse Error",
  invalidRequest: "Invalid Request",
  methodNotFound: "Method not found",
  invalidParams: "Invalid Parameters"
};

const errorToStatus = {
  "-32700": 500,
  "-32600": 400,
  "-32601": 404,
  "-32602": 500,
  "-32603": 500
};

module.exports = {
  ERR_CODES,
  ERR_MSGS,
  errorToStatus
};

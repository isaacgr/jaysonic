/**
 * Generates a stringified JSON-RPC request object with appended delimiter.
 *
 * @function formatRequest
 * @memberof Utils.format
 * @param {object} request
 * @param {string} request.method
 * @param {array|object} request.params
 * @param {string|number} request.id
 * @param {string|number} request.version
 * @param {string} request.delimiter
 */
const formatRequest = ({
  method, params, id, version, delimiter
}) => {
  if (!(typeof method === "string")) {
    throw new TypeError(`${method} must be a string`);
  }

  const request = {
    method
  };

  // assume 2.0 request unless otherwise specified
  if (!version || version !== 1) {
    request.jsonrpc = "2.0";
  }

  if (
    (params && !(params === Object(params)) && !Array.isArray(params))
    || typeof params === "function"
  ) {
    throw new TypeError(`${params} must be an object or array`);
  } else if (params) {
    request.params = params;
  }

  // assume notification otherwise
  if (!(typeof id === "undefined")) {
    request.id = id;
  }

  return JSON.stringify(request) + delimiter;
};

/**
 * Generates a stringified JSON-RPC response object with appended delimiter.
 *
 * @function formatResponse
 * @memberof Utils.format
 * @param {object} response
 * @param {string} response.method
 * @param {array|object} response.params
 * @param {string|number} response.id
 * @param {string|number} response.jsonrpc
 * @param {string} response.delimiter
 * @param response.result
 */
const formatResponse = ({
  jsonrpc, id, method, result, params, delimiter
}) => {
  const response = {};
  if (params && result) {
    throw new Error("Cannot send response with both params and result");
  }

  if (method && id) {
    throw new Error("Cannot send response with both a method and non-null id");
  }

  if (method && !(typeof method === "string")) {
    throw new TypeError(`${method} must be a string`);
  }

  if (
    (params && !(params === Object(params)) && !Array.isArray(params))
    || typeof params === "function"
  ) {
    throw new TypeError(`${params} must be an object or array`);
  } else if (params) {
    response.params = params;
  }

  if (result) {
    response.result = result;
  }

  if (!jsonrpc) {
    // 1.0 response
    response.error = null;
  } else {
    // assume 2.0 response, dont include null error and include jsonrpc version
    response.jsonrpc = "2.0";
  }

  if (!id) {
    if (method) {
      response.method = method;
    }
    if (!jsonrpc) {
      response.id = null;
    }
  } else {
    response.id = id;
  }

  return JSON.stringify(response) + delimiter;
};

/**
 * Generates a stringified JSON-RPC error object with appended delimiter.
 *
 * @function formatError
 * @memberof Utils.format
 * @param {object} error
 * @param {string} error.message
 * @param {array|object} error.code
 * @param {string|number} error.id
 * @param {string|number} error.jsonrpc
 * @param {string} error.delimiter
 * @param {string|object|array} error.data
 */
const formatError = ({
  jsonrpc, id, code, message, data, delimiter
}) => {
  if (!message) {
    throw new Error("Must include message in error response");
  }
  const response = jsonrpc === "2.0"
    ? {
      jsonrpc,
      error: { code, message },
      id
    }
    : {
      result: null,
      error: { code, message },
      id
    };

  if (data) {
    response.error.data = data;
  }
  return JSON.stringify(response) + delimiter;
};

/**
 * @static
 *
 */
module.exports = {
  formatRequest,
  formatResponse,
  formatError
};

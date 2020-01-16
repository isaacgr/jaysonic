const formatRequest = ({
  method, params, id, options
}) => {
  if (!(typeof method === "string")) {
    throw new TypeError(`${method} must be a string`);
  }

  const request = {
    method
  };

  // assume 2.0 request unless otherwise specified
  if (!options.version || options.version !== 1) {
    request.jsonrpc = "2.0";
  }

  if (!params) {
    throw new Error("params must be defined");
  }

  if (params) {
    if (
      (!(params === Object(params)) && !Array.isArray(params))
      || typeof params === "function"
    ) {
      throw new TypeError(`${params} must be an object or array`);
    }
    request.params = params;
  }

  // assume notification otherwise
  if (!(typeof id === "undefined")) {
    request.id = id;
  }

  const messageString = JSON.stringify(request) + options.delimiter;
  return messageString;
};

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

  if (params) {
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

class BatchRequest extends Error {
  constructor(message, request = undefined) {
    super(message);
    this.name = "BatchRequest";
    this.request = request;
  }
}

module.exports = {
  formatRequest,
  formatResponse,
  BatchRequest
};

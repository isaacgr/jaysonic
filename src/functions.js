const isString = require("lodash/isString");
const isUndefined = require("lodash/isUndefined");
const isObject = require("lodash/isObject");
const isArray = require("lodash/isArray");

const formatRequest = ({ method, params, id, options }) => {
  if (!isString(method)) {
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
    if (!isObject(params) && !isArray(params)) {
      throw new TypeError(`${params} must be an object or array`);
    }
    request.params = params;
  }

  // assume notification otherwise
  if (!isUndefined(id)) {
    request.id = id;
  }

  const messageString = JSON.stringify(request) + options.delimiter;
  return messageString;
};

const formatResponse = ({ jsonrpc, id, method, result, params }) => {
  const response = {};

  response.result = result;

  if (params) {
    response.params = params;
  }

  if (!jsonrpc) {
    // 1.0 response
    response.error = null;
  } else {
    // 2.0 response, dont include null error and include jsonrpc version
    response.jsonrpc = "2.0";
  }

  if (id) {
    response.id = id;
  }

  // could be notification
  if (method && !id) {
    response.method = method;
  }

  return JSON.stringify(response);
};

module.exports = {
  formatRequest,
  formatResponse
};

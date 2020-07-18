module.exports = {
  env: {
    commonjs: true,
    es6: true,
    node: true,
    mocha: true,
    browser: true
  },
  extends: ["airbnb-base"],
  globals: {
    Atomics: "readonly",
    SharedArrayBuffer: "readonly"
  },
  parserOptions: {
    ecmaVersion: 2018
  },
  rules: {
    "new-cap": "off",
    "class-methods-use-this": "off",
    "comma-dangle": "off",
    "no-await-in-loop": "off",
    "no-underscore-dangle": "off",
    quotes: ["error", "double"],
    "consistent-return": "off",
    "no-restricted-syntax": [
      "off",
      {
        selector: "ForOfStatement"
      }
    ]
  }
};

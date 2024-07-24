const opinionated = require('opinionated-eslint-config');

module.exports = opinionated({
  typescript: {
    tsconfigPath: [ './tsconfig.json', './test/tsconfig.json' ],
  },
});

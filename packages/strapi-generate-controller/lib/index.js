'use strict';

/**
 * Module dependencies
 */

// Node.js core.
const path = require('path');

/**
 * Generate a core API
 */

module.exports = {
  templatesDirectory: scope => {
    try {
      // Try to reach the path. If it fail, throw an error.
      fs.accessSync(path.resolve(__dirname, '..', 'templates', scope.args[1]), fs.constants.R_OK | fs.constants.W_OK);

      return path.resolve(__dirname, '..', 'templates', scope.args[1]);
    } catch (e) {
      // Default template is Mongoose
      return path.resolve(__dirname, '..', 'templates', 'mongoose');
    }
  },
  before: require('./before'),
  targets: {
    'api/:humanizeId/controllers/:filename': {
      template: 'controller.template'
    }
  }
};

'use strict';

/**
 * Module dependencies
 */

// Node.js core.
const path = require('path');

// Public node modules.
const _ = require('lodash');
const I18n2 = require('i18n-2');

/**
 * i18n hook
 */

module.exports = function (strapi) {
  const hook = {

    /**
     * Default options
     */

    defaults: {
      i18n: {
        defaultLocale: 'en_US',
        modes: [
          'query',
          'subdomain',
          'cookie',
          'header',
          'url',
          'tld'
        ],
        cookieName: 'locale'
      }
    },

    /**
     * Initialize the hook
     */

    initialize: function (cb) {
      if (_.isPlainObject(strapi.config.i18n) && !_.isEmpty(strapi.config.i18n)) {
        strapi.middlewares.locale(strapi.app);
        strapi.app.use(strapi.middlewares.i18n(strapi.app, {
          directory: path.resolve(strapi.config.appPath, strapi.config.paths.config, 'locales'),
          locales: strapi.config.i18n.locales,
          defaultLocale: strapi.config.i18n.defaultLocale,
          modes: strapi.config.i18n.modes,
          cookieName: strapi.config.i18n.cookieName,
          extension: '.json'
        }));

        // hacked global i18n
        let i18n = new I18n2({
          directory: path.resolve(strapi.config.appPath, strapi.config.paths.config, 'locales'),
          locales: strapi.config.i18n.locales,
          defaultLocale: strapi.config.i18n.defaultLocale,
          modes: strapi.config.i18n.modes,
          cookieName: strapi.config.i18n.cookieName,
          extension: '.json'
        })
        strapi.i18n = i18n
      }

      cb();
    }
  };

  return hook;
};

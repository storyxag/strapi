'use strict';

/**
 * Module dependencies
 */

// Public node modules.
const _ = require('lodash');

/**
 * JSON API utils
 */

module.exports = {

  /**
   * Verify ressource object
   */

  isRessourceObject: function (object) {
    return _.isObject(object) && object.hasOwnProperty('id') && object.hasOwnProperty('type');
  },

  /**
   * Verify if the route exists
   */

  isRoute: function (link) {
    return strapi.config.routes.hasOwnProperty(link);
  },

  /**
   * Find data object
   */

  getObject: function (matchedRoute) {
    switch (_.size(matchedRoute.regexp.keys)) {
      case 0:
        return 'collection';
      case 1:
        return 'ressource';
      case 2:
        return (matchedRoute.path.indexOf('relationships') !== -1) ? 'relationships' : 'related';
      default:
        return 'collection';
    }
  },

  /**
   * Find data type
   */

  getType: function (ctx, supposedType) {
    // Relationships or related ressource
    if (strapi.models.hasOwnProperty(supposedType.toLowerCase()) && ctx.params.hasOwnProperty('relation') && ctx.method === 'GET') {
      return _.first(_.reject(_.map(strapi.models[supposedType.toLowerCase()].associations, function (relation) {
        return (ctx.params.hasOwnProperty('relation') && ctx.params.relation === relation.alias) ? relation.model || relation.collection : undefined;
      }), _.isUndefined));
    } else if (strapi.models.hasOwnProperty(supposedType.toLowerCase())) {
      return supposedType.toLowerCase();
    } else if (!strapi.models.hasOwnProperty(supposedType.toLowerCase())) {
      // Deep search based on the relation alias
      const tryFindType = _.reject(_.flattenDeep(_.map(strapi.models, function (model) {
        return _.map(model.associations, function (relation) {
          return (supposedType.toLowerCase() === relation.alias) ? relation.model || relation.collection : undefined;
        });
      })), _.isUndefined);

      if (!_.isUndefined(tryFindType)) {
        return _.first(tryFindType);
      }
    }

    return undefined;
  },
  getOwnType: function (ctx, supposedType) {
    if (strapi.models.hasOwnProperty(supposedType.toLowerCase())) {
      return supposedType.toLowerCase();
    } else if (!strapi.models.hasOwnProperty(supposedType.toLowerCase())) {
      // Deep search based on the relation alias
      const tryFindType = _.reject(_.flattenDeep(_.map(strapi.models, function (model) {
        return _.map(model.associations, function (relation) {
          return (supposedType.toLowerCase() === relation.alias) ? relation.model || relation.collection : undefined;
        });
      })), _.isUndefined);

      if (!_.isUndefined(tryFindType)) {
        return _.first(tryFindType);
      }
    }

    return undefined;
  },

	/**
	 * Convert an object to a query string
	 */

	objectToQueryString: function (obj) {
    var qs = _.reduce(obj, function (result, value, key) {
        if (!_.isNull(value) && !_.isUndefined(value)) {
            if (_.isArray(value)) {
                result += _.reduce(value, function (result1, value1) {
                    if (!_.isNull(value1) && !_.isUndefined(value1)) {
                        result1 += key + '=' + value1 + '&';
                        return result1
                    } else {
                        return result1;
                    }
                }, '')
            } else {
                result += key + '=' + value + '&';
            }
            return result;
        } else {
            return result
        }
    }, '').slice(0, -1);
    return qs;
	},

  /**
   * Find router object for matched route
   */

  matchedRoute: function (ctx) {
    return _.find(strapi.router.stack, function (stack) {
      if (new RegExp(stack.regexp).test(ctx.request.url.replace(ctx.request.search, '')) && _.includes(stack.methods, ctx.request.method.toUpperCase())) {
        return stack;
      }
    });
  }

};

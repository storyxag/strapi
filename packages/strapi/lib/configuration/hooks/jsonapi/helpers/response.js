'use strict';

/**
 * Module dependencies
 */

// Public node modules.
const _ = require('lodash');
const JSONAPI = require('jsonapi-serializer');

// Local utilities.
const utils = require('../utils/');
const modelsUtils = require('../../models/utils/');

/**
 * JSON API helper
 */

module.exports = {

  /**
   * Set response
   */

  set: function * (ctx, matchedRoute, actionRoute) {
    const object = actionRoute.objectType || utils.getObject(matchedRoute);
    if (actionRoute.supposedType !== undefined) {
      actionRoute.controller = actionRoute.supposedType
    }
    const type = actionRoute.type || utils.getType(ctx, actionRoute.controller);
    const ownType = utils.getOwnType(ctx, actionRoute.controller)
    // Fetch a relationship that does not exist
    // Reject related request with `include` parameter

      if (_.isUndefined(type) || (type === 'related' && ctx.params.hasOwnProperty('include'))) {
      ctx.response.status = 404;
      ctx.response.body = '';

      return;
    } else if (ctx.method === 'DELETE') {
      // Request successful and responds with only top-level meta data or nothing.
      ctx.response.body = '';

      return;
    }
    // Fetch and format value
    const value = this.fetchValue(ctx, object);

    if (!_.isNull(value) && !_.isUndefined(value)) {
      ctx.response.body = yield this.serialize(ctx, type, object, value, ownType);
    }
  },

  /**
   * Serialize response with JSON API specification
   */
  serialize: function * (ctx, type, object, value, ownType) {
    const toSerialize = {
      topLevelLinks: {self: ctx.request.origin + ctx.request.originalUrl},
      keyForAttribute: 'dash-case',
      pluralizeType: false,
      included: true,
      ignoreRelationshipData: false,
      typeForAttribute: function (currentType) {
        if (strapi.models.hasOwnProperty(type)) {
          return _.first(_.reject(_.map(strapi.models[type].associations, function (relation) {
            return (relation.alias === currentType) ? relation.model || relation.collection : undefined;
          }), _.isUndefined)) || currentType;
        }
      }
    };

    // Assign custom configurations
    if (_.isPlainObject(strapi.config.jsonapi) && !_.isEmpty(strapi.config.jsonapi)) {
      _.assign(toSerialize, _.pick(strapi.config.jsonapi, 'keyForAttribute'));
    }

    const PK = modelsUtils.getPK(type);

    if (_.isArray(value) && !_.isEmpty(value)) {
      // Array
      if (!_.isNull(PK)) {
        _.forEach(value, function (record) {
          if (record.hasOwnProperty(PK)) {
            record[PK] = record[PK].toString();
          }
        });
      }

      toSerialize.dataLinks = {
        self: function (record) {
          if (record.hasOwnProperty(PK)) {
            return ctx.request.origin + ctx.state.url + '/' + record[PK];
          }
        }
      };

      toSerialize.attributes = ctx.state.filter.fields[type] || _.keys(_.last(value));
    } else if (_.isObject(value) && !_.isEmpty(value)) {
      // Object
      if (!_.isNull(PK) && value.hasOwnProperty(PK)) {
        value[PK] = value[PK].toString();
      }


      if (ctx.state.filter === undefined){
        ctx.state.filter = { fields: {} };
      }

      toSerialize.attributes = ctx.state.filter.fields[type] || _.keys(value);
    }
    switch (object) {
      case 'collection':
        this.includedRelationShips(ctx, toSerialize, type);
        break;
      case 'ressource':
        this.includedRelationShips(ctx, toSerialize, type);
        break;
      case 'relationships':
        // Remove data key
        delete toSerialize.dataLinks;
        delete toSerialize.attributes;

        // Dirty way to set related URL
        toSerialize.topLevelLinks.related = toSerialize.topLevelLinks.self.replace('relationships/', '');
        break;
      case 'related':
        this.includedRelationShips(ctx, toSerialize, type);
        break;
      default:
        break;
    }

    // Display JSON API pagination
    if (ctx.request.method === 'GET' && _.isPlainObject(strapi.config.jsonapi) && strapi.config.jsonapi.hasOwnProperty('paginate') && strapi.config.jsonapi.paginate === parseInt(strapi.config.jsonapi.paginate, 10)) {
      if (object === 'collection') {
        yield this.includePagination(ctx, toSerialize, object, type);
      }
      if ( (object === 'related' || object === 'relationships') && ctx.params.hasOwnProperty('relation') && !_.isEmpty(_.find(strapi.models[ownType].associations, {alias: ctx.params.relation, collection: type}))) {
        yield this.includePagination(ctx, toSerialize, object, type, ownType);
      }

    }
    const serialized = new JSONAPI.Serializer(type, value, toSerialize);
    // Display JSON API version support
    if (_.isPlainObject(strapi.config.jsonapi) && strapi.config.jsonapi.hasOwnProperty('showVersion') && strapi.config.jsonapi.showVersion === true) {
      _.assign(serialized, {
        jsonapi: {
          version: '1.0'
        }
      });
    }
    return serialized;
  },

  /**
   * Include pagination links to the object
   */

  includePagination: function * (ctx, toSerialize, object, type, ownType) {
    return new Promise(function (resolve, reject) {
      if (strapi.models.hasOwnProperty(type) && strapi.hasOwnProperty(strapi.models[type].orm) && strapi[strapi.models[type].orm].hasOwnProperty('collections')) {

        // We force page-based strategy for now.
        let countConfig
        if (ownType) {
          let aliasForOwn = _.first(_.reject(_.map(strapi.models[type].associations, function (relation) {
            return (relation.model === ownType || relation.collection === ownType) ? relation.alias : undefined;
          }), _.isUndefined));
          if (aliasForOwn) {
            countConfig = {
              ownId: ctx.params.id,
              ownType: ownType,
              type: type,
              aliasForOwn: aliasForOwn
            }
          }
        }

        const countFunc = ctx.body && !_.isEmpty(ctx.body.pagination)
          ? Promise.resolve(ctx.body.pagination.rowCount)
          : modelsUtils.getCount(countConfig || type)
        countFunc.then(function (count) {
          const links = {};
          const itemsPerPage = _.first(_.values(_.pick(ctx.state.query, 'page[size]'))) || strapi.config.jsonapi.paginate;
          const pageNumber = Math.ceil(count / itemsPerPage);

          // Get current page number

          const value = _.first(_.values(_.pick(ctx.state.query, 'page[number]')));
          const currentPage = _.isEmpty(value) || parseInt(value, 10) === 0 ? 1 : value;

          // Verify integer
          let newQueryParams = ctx.state.query;
          newQueryParams['page[number]'] = 1;
          if (currentPage.toString() === parseInt(currentPage, 10).toString()) {
            links.first = ctx.request.origin + ctx.state.url + '?' + utils.objectToQueryString(newQueryParams);
            newQueryParams['page[number]'] = (parseInt(currentPage, 10) - 1);
            links.prev = ctx.request.origin + ctx.state.url + '?' + utils.objectToQueryString(newQueryParams);
            newQueryParams['page[number]'] = (parseInt(currentPage, 10) + 1);
            links.next = ctx.request.origin + ctx.state.url + '?' + utils.objectToQueryString(newQueryParams);
            newQueryParams['page[number]'] = pageNumber;
            links.last = ctx.request.origin + ctx.state.url + '?' + utils.objectToQueryString(newQueryParams);

            // Second page
            if ((parseInt(currentPage, 10) - 1) === 0) {
              links.prev = links.first;
            }

            // Before last page
            if ((parseInt(currentPage, 10) - 1) === pageNumber) {
              links.next = links.last;
            }

            // No data
            if (pageNumber === 0) {
              links.prev = null;
              links.next = null;
              links.last = null;
            }

            // Last page
            if (parseInt(currentPage, 10) === pageNumber) {
              links.last = null;
              links.next = null;
            }

            // First page
            if (parseInt(currentPage, 10) === 1) {
              links.first = null;
              links.prev = null;
            }
          }

          _.assign(toSerialize.topLevelLinks, _.omit(links, _.isNull));

          resolve();
        })
        .catch(function (err) {
          reject(err);
        });
      } else {
        resolve();
      }
    });
  },

  /**
   * Include relationships values to the object
   */

  includedRelationShips: function (ctx, toSerialize, type) {
    if (strapi.models.hasOwnProperty(type)) {
      _.forEach(strapi.models[type].associations, function (relation) {

        const PK = modelsUtils.getPK(relation.model) || modelsUtils.getPK(relation.collection);
        const availableRoutes = {
          relSlSelf: utils.isRoute('GET /' + type + '/:' + PK + '/relationships/:relation'),
          relSlRelated: utils.isRoute('GET /' + type + '/:' + PK),
          incSelf: relation.model ? utils.isRoute('GET /' + relation.model + '/:' + PK) : utils.isRoute('GET /' + relation.collection + '/:' + PK)
        };

      debugger
        const modelType = relation.collection || relation.model
        switch (relation.nature) {
          case 'oneToOne':
          case 'manyToOne':
            // Object
            toSerialize[relation.alias] = {
              ref: PK,
              included: strapi.config.jsonapi.includedRelationshipData || true,
              ignoreRelationshipData: strapi.config.jsonapi.ignoreRelationshipData || false,
              attributes: ctx.state.filter.fields[relation.model] || _.keys(_.omit(strapi.models[modelType].attributes, _.isFunction)),
              relationshipLinks: {
                self: function (record) {
                  if (record.hasOwnProperty(PK) && availableRoutes.relSlSelf) {
                    return ctx.request.origin + '/' + type + '/' + record[PK] + '/relationships/' + relation.alias;
                  }

                  return undefined;
                },
                related: function (record) {
                  if (record.hasOwnProperty(PK) && availableRoutes.relSlRelated) {
                    return ctx.request.origin + '/' + type + '/' + record[PK];
                  }

                  return undefined;
                },
                next: function (data, record) {
                  return 'next relation';
                }
              },
              includedLinks: {
                self: function (data, record) {
                  if (!_.isUndefined(record) && record.hasOwnProperty(PK) && availableRoutes.incSelf) {
                    return ctx.request.origin + '/' + relation.model + '/' + record[PK];
                  }

                  return undefined;
                }
              }
            };
            break;
          case 'oneToMany':
          case 'manyToMany':
            // Array
            toSerialize[relation.alias] = {
              ref: PK,
              included: strapi.config.jsonapi.includedRelationshipData || true,
              ignoreRelationshipData: strapi.config.jsonapi.ignoreRelationshipData || false,
              typeForAttribute: relation.collection,
              attributes: ctx.state.filter.fields[relation.collection] || _.keys(_.omit(strapi.models[modelType].attributes, _.isFunction)),
              relationshipLinks: {
                self: function (record) {
                  if (record.hasOwnProperty(PK) && availableRoutes.relSlSelf) {
                    return ctx.request.origin + '/' + type + '/' + record[PK] + '/relationships/' + relation.alias;
                  }

                  return undefined;
                },
                related: function (record) {
                  if (record.hasOwnProperty(PK) && availableRoutes.relSlRelated) {
                    return ctx.request.origin + '/' + type + '/' + record[PK];
                  }

                  return undefined;
                }
              },
              includedLinks: {
                self: function (data, record) {
                  if (record.hasOwnProperty(PK) && availableRoutes.incSelf) {
                    return ctx.request.origin + '/' + relation.collection + '/' + record[PK];
                  }

                  return undefined;
                }
              }
            };
            break;
          default:
        }
      });
    }
  },

  /**
   * Fetch and format value
   */

  fetchValue: function (ctx, object) {
    const data = _.isFunction(_.get(ctx.body, 'toJSON')) ? ctx.body.toJSON() : ctx.body;

    switch (object) {
      case 'collection':
        if ((_.isArray(data) && _.size(data) > 1) || _.isObject(data)) {
          return data;
        } else if (_.isArray(data) && (_.size(data) === 1 || _.size(data) === 0)) {
          return _.isObject(_.first(data)) ? _.first(data[0]) : [];
        }

        return null;
      case 'ressource':
        if (_.isObject(data)) {
          return data;
        }

        return null;
      case 'related':
      case 'relationships':
        if (_.isObject(data) || _.isArray(data) && data.hasOwnProperty(ctx.params.relation)) {
          if (_.isArray(_.get(data, ctx.params.relation)) && _.size(_.get(data, ctx.params.relation)) > 1) {
            return _.get(data, ctx.params.relation);
          }

          return _.get(data, ctx.params.relation) || _.first(_.get(data, ctx.params.relation));
        }

        return null;
      default:
        return 'collection';
    }
  }
};

FROM node:6

# Set environment variables
ENV NPM_CONFIG_LOGLEVEL="warn" \
		STRAPI_DIR="/usr/strapi_install"
    
COPY ./ ${STRAPI_DIR}

WORKDIR ${STRAPI_DIR}/packages/strapi-utils
RUN npm install && \
	npm link
WORKDIR ${STRAPI_DIR}/packages/strapi
RUN npm link strapi-utils && \
	npm link && \
	npm install
WORKDIR ${STRAPI_DIR}/packages/strapi-knex
RUN npm link && \
	npm install
WORKDIR ${STRAPI_DIR}/packages/strapi-bookshelf
RUN npm link strapi && \
	npm link && \
	npm install

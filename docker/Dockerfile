FROM node:22-alpine

WORKDIR /app

ENV N8N_LOG_LEVEL=error                                              
ENV NODE_FUNCTION_ALLOW_EXTERNAL=mjml                                

COPY package*.json .

RUN npm ci

RUN apk add --no-cache sqlite

COPY . . 

RUN chmod +x scripts/entrypoint.sh

ENTRYPOINT ["scripts/entrypoint.sh"]

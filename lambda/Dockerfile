FROM public.ecr.aws/lambda/nodejs:22

RUN dnf install -y sqlite npm

COPY package*.json .
RUN npm ci

ENV NODE_ENV=prod
ENV N8N_USER_FOLDER=/tmp

COPY .env.local ${LAMBDA_TASK_ROOT}/.env
COPY lambda/index.js lambda/n8n.json ${LAMBDA_TASK_ROOT}
COPY scripts/ ${LAMBDA_TASK_ROOT}/scripts/
COPY resources/ ${LAMBDA_TASK_ROOT}/resources/
  
RUN chmod +x ${LAMBDA_TASK_ROOT}/scripts/entrypoint.sh ${LAMBDA_TASK_ROOT}/scripts/import-workflow.js

CMD [ "index.handler" ]

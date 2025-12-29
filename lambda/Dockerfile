FROM public.ecr.aws/lambda/nodejs:22

COPY package*.json .
RUN npm ci

RUN dnf install -y sqlite

ENV N8N_LOG_LEVEL=error                                              
ENV NODE_FUNCTION_ALLOW_EXTERNAL=mjml                                
ENV N8N_USER_FOLDER=/tmp

COPY lambda/index.js n8n.json ${LAMBDA_TASK_ROOT}
COPY scripts/ ${LAMBDA_TASK_ROOT}/scripts/
COPY resources/ ${LAMBDA_TASK_ROOT}/resources/
  
RUN chmod +x ${LAMBDA_TASK_ROOT}/scripts/entrypoint.sh ${LAMBDA_TASK_ROOT}/scripts/import-workflow.sh

CMD [ "index.handler" ]

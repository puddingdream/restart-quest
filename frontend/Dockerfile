FROM node:22.17.0-alpine3.22@sha256:fc3e945f920b7e3000cd1af86c4ae406ec70c72f328b667baf0f3a8910d69eed AS build

WORKDIR /workspace

COPY package.json package-lock.json ./
RUN npm ci

COPY index.html eslint.config.js tsconfig.json tsconfig.app.json tsconfig.node.json vite.config.ts ./
COPY src src
RUN npm run build

FROM nginxinc/nginx-unprivileged:1.29.0-alpine3.22@sha256:82dcf28da5a8cd97d43e8f8a64de766658b0c5fb9072368c5f0a9048c417a934 AS runtime

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /workspace/dist /usr/share/nginx/html

EXPOSE 8080

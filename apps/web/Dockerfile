FROM node:20-alpine AS build
WORKDIR /app

ARG VITE_API_BASE_URL
ARG VITE_APP_NAME=小满人生档案馆
ARG VITE_STORAGE_PREVIEW_MODE=signed-url

ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ENV VITE_APP_NAME=$VITE_APP_NAME
ENV VITE_STORAGE_PREVIEW_MODE=$VITE_STORAGE_PREVIEW_MODE

COPY package.json package-lock.json ./
COPY apps/web/package.json ./apps/web/package.json
RUN npm ci

COPY apps/web ./apps/web
RUN npm run build:web

FROM nginx:1.27-alpine AS runner
COPY deploy/nginx/spa.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
EXPOSE 80

FROM node:20-alpine AS build
WORKDIR /app

ARG VITE_API_BASE_URL
ARG VITE_ADMIN_APP_NAME=小满人生档案馆管理后台

ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ENV VITE_ADMIN_APP_NAME=$VITE_ADMIN_APP_NAME

COPY package.json package-lock.json ./
COPY apps/admin/package.json ./apps/admin/package.json
RUN npm ci

COPY apps/admin ./apps/admin
RUN npm run build:admin

FROM nginx:1.27-alpine AS runner
COPY deploy/nginx/spa.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/admin/dist /usr/share/nginx/html
EXPOSE 80

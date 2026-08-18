# Static build served by nginx, which also proxies /api and /generated so the
# browser only ever talks to one origin - the same arrangement the Vite dev
# server provides, and what keeps the in-page camera working under HTTPS.
FROM node:20-alpine AS build

WORKDIR /build

COPY package*.json ./

RUN npm ci

COPY . .

# Empty by default: same-origin, resolved by the nginx proxy below.
ARG VITE_API_URL=""
ARG VITE_AI_URL=""

ENV VITE_API_URL=$VITE_API_URL
ENV VITE_AI_URL=$VITE_AI_URL

RUN npm run build

FROM nginx:alpine

COPY --from=build /build/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

FROM node:lts-alpine as builder
WORKDIR /ark-admin-vue
# RUN npm set registry https://registry.npm.taobao.org
# cache step
COPY package.json /ark-admin-vue/package.json
RUN npm install
# build
COPY ./ /ark-admin-vue
RUN npm run build:prod

FROM nginx as production
RUN mkdir /web
COPY --from=builder /ark-admin-vue/dist/ /web
COPY --from=builder /ark-admin-vue/nginx.conf /etc/nginx/nginx.conf
EXPOSE 80


FROM node:16-alpine 
WORKDIR /app
COPY package*.json ./
COPY . /app
RUN npm install
RUN npm install @babel/core @babel/cli @babel/preset-env @babel/node -g

EXPOSE 5000
CMD ["babel-node", "app.js"]
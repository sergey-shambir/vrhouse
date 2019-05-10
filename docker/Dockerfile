FROM node:12-stretch

# Install backend dependencies
COPY backend/package.json backend/yarn.lock /backend/
WORKDIR /backend
RUN npm install

# Install frontend dependencies
COPY frontend/package.json frontend/yarn.lock /frontend/
WORKDIR /frontend
RUN npm install

# Copy backend
COPY backend /backend

# Copy and build frontend
COPY frontend /frontend
WORKDIR /frontend
RUN npm run build

# Set runtime configuration
WORKDIR /backend/app/
CMD [ "node", "/backend/app/index.js" ]

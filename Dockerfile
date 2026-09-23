FROM node:20-alpine

WORKDIR /app

# Copiar package.json y package-lock.json
COPY package*.json ./

# Instalar dependencias
RUN npm ci --only=production 2>/dev/null || npm install --production

# Copiar código fuente
COPY . .

# Build de Next.js
RUN npm run build

# Exponer puerto
EXPOSE 3000

# Variables de entorno por defecto
ENV NODE_ENV=production
ENV PORT=3000
ENV NEXT_TELEMETRY_DISABLED=1

# Arrancar
CMD ["npm", "start", "--", "-p", "3000"]

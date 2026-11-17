FROM node:22-slim AS studio-builder
WORKDIR /studio
COPY studio/package*.json ./
RUN npm ci --no-audit --no-fund
COPY studio/ ./
RUN npm run build

FROM python:3.12-slim
RUN apt-get update && apt-get install -y --no-install-recommends openscad xvfb libgl1 libglib2.0-0 && rm -rf /var/lib/apt/lists/*
WORKDIR /project
COPY app/ ./app/
COPY --from=studio-builder /studio/dist/ ./studio/dist/
COPY models/ ./models/
ENV PYTHONUNBUFFERED=1 QT_QPA_PLATFORM=offscreen
EXPOSE 8080
CMD ["python", "app/server.py"]

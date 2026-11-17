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
RUN useradd --create-home --uid 10001 appuser \
    && mkdir -p /tmp/window-fan-cache \
    && chown appuser:appuser /tmp/window-fan-cache
ENV PYTHONUNBUFFERED=1 QT_QPA_PLATFORM=offscreen HOME=/home/appuser
USER appuser
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --start-period=15s \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8080/api/health', timeout=2)" || exit 1
CMD ["python", "app/server.py"]

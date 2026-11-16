FROM python:3.12-slim
RUN apt-get update && apt-get install -y --no-install-recommends openscad xvfb libgl1 libglib2.0-0 && rm -rf /var/lib/apt/lists/*
WORKDIR /project
COPY app/ ./app/
COPY models/ ./models/
ENV PYTHONUNBUFFERED=1 QT_QPA_PLATFORM=offscreen
EXPOSE 8080
CMD ["python", "app/server.py"]

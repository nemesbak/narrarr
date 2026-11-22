FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 \
    PUID=99 PGID=100 TZ=Europe/Madrid NARRARR_PUERTO=8787 \
    NARRARR_CONFIG=/config NARRARR_BIBLIOTECA=/audiolibros NARRARR_DESCARGAS=/descargas

RUN apt-get update && apt-get install -y --no-install-recommends gosu tzdata \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir $(grep -v '^pytest' requirements.txt)
COPY app ./app
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh && rm -rf /app/app/tests

VOLUME ["/config", "/audiolibros", "/descargas"]
EXPOSE 8787
HEALTHCHECK --interval=60s --timeout=10s --start-period=20s --retries=3 \
    CMD python -c "import os,urllib.request;urllib.request.urlopen('http://127.0.0.1:'+os.environ.get('NARRARR_PUERTO','8787')+'/api/estado',timeout=8)" || exit 1

ENTRYPOINT ["/entrypoint.sh"]

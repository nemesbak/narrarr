#!/bin/sh
# Ajusta el usuario a PUID/PGID (por defecto 99:100, como en Unraid) y arranca Narrarr.
set -e
PUID="${PUID:-99}"
PGID="${PGID:-100}"
NARRARR_CONFIG="${NARRARR_CONFIG:-/config}"

if ! getent group narrarr >/dev/null 2>&1; then
    groupadd -o -g "$PGID" narrarr
else
    groupmod -o -g "$PGID" narrarr
fi
if ! id narrarr >/dev/null 2>&1; then
    useradd -o -u "$PUID" -g narrarr -d "$NARRARR_CONFIG" -s /bin/sh narrarr
else
    usermod -o -u "$PUID" -g narrarr narrarr
fi

mkdir -p "$NARRARR_CONFIG/portadas"
chown -R "$PUID:$PGID" "$NARRARR_CONFIG"

echo "Narrarr: arrancando como $PUID:$PGID en el puerto ${NARRARR_PUERTO:-8787}"
exec gosu "$PUID:$PGID" uvicorn app.main:app --host 0.0.0.0 --port "${NARRARR_PUERTO:-8787}" --proxy-headers

#!/bin/sh
# Evrakdar kurulumu (Linux ve macOS). Kullanim: sh kur.sh
set -e
cd "$(dirname "$0")"

COMPOSE="docker compose -f docker/docker-compose.prod.yml --env-file .env.production"
WEB_PORT="${WEB_PORT:-3000}"
API_PORT="${API_PORT:-3001}"

if ! docker info >/dev/null 2>&1; then
  echo "Docker calismiyor. Docker'i kurup acin, sonra tekrar deneyin: https://www.docker.com/products/docker-desktop/"
  exit 1
fi

random_value() {
  LC_ALL=C tr -dc 'A-Za-z0-9' </dev/urandom | head -c "$1"
}

if [ ! -f .env.production ]; then
  if [ -z "${ORG_NAME+x}" ]; then
    printf "Kurumunuzun adi (ekranda gorunur): "
    read -r ORG_NAME
  fi
  umask 077
  cat > .env.production <<EOF
PUBLIC_WEB_URL="http://localhost:${WEB_PORT}"
PUBLIC_API_URL="http://localhost:${API_PORT}"
APP_NAME="Evrakdar"
ORG_NAME="${ORG_NAME}"
POSTGRES_PASSWORD="$(random_value 32)"
JWT_SECRET="$(random_value 64)"
JWT_EXPIRES_IN="8h"
SEED_ADMIN_USERNAME="admin"
SEED_ADMIN_PASSWORD=""
SEED_ADMIN_EMAIL=""
WEB_BIND="127.0.0.1:${WEB_PORT}"
API_BIND="127.0.0.1:${API_PORT}"
TRUST_PROXY=""
EOF
  echo "Ayar dosyasi olusturuldu: .env.production"
fi

echo "Sistem hazirlaniyor. Ilk kurulum 5-15 dakika surebilir."
$COMPOSE up -d --build

echo "Sistemin acilmasi bekleniyor..."
tries=0
until [ "$($COMPOSE exec -T api node -e "fetch('http://127.0.0.1:3001/health').then(r=>process.stdout.write(String(r.status))).catch(()=>process.stdout.write('0'))" 2>/dev/null)" = "200" ]; do
  tries=$((tries + 1))
  if [ "$tries" -gt 60 ]; then
    echo "Sistem acilamadi. Kayitlara bakin: $COMPOSE logs api"
    exit 1
  fi
  sleep 5
done

$COMPOSE run --rm api npx prisma db seed

URL=$(sed -n 's/^PUBLIC_WEB_URL="\(.*\)"$/\1/p' .env.production)
echo ""
echo "Evrakdar calisiyor: $URL"
echo "Giris bilgileri yukarida yaziyor. Daha once kurduysaniz sifreleriniz degismedi."

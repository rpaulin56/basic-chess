#!/bin/sh
# Pubblica la versione corrente su grandmachess.com.
#
#   sh deploy/publish.sh
#
# L'applicazione e' interamente statica: si costruisce qui e si copia la cartella
# dist/ sul VPS. Non serve clonare il repo sul server ne' dargli una chiave di
# deploy, e non c'e' nessun processo da riavviare — Caddy serve i file cosi' come
# sono. La build resta riproducibile perche' e' sempre questa macchina a farla.
set -e

HOST=root@2.28.7.113
TARGET=/srv/basic-chess/dist

npm run build
tar -czf - -C dist . | ssh "$HOST" "rm -rf $TARGET && mkdir -p $TARGET && tar -xzf - -C $TARGET && chmod -R a+rX $TARGET"
echo "Pubblicato su https://grandmachess.com"

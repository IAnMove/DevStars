# Desplegar githubstars.iaen.es (RackNerd)

**No se ejecuta sin el visto bueno del propietario.** Servidor: RackNerd 192.210.232.73 (1 núcleo, 1,9 GB, Node v24.22.3, glibc 2.39). Supervisor `githubstars` lanza `node .next/standalone/server.js` desde `/var/www/githubstars` (PORT=3000, `NODE_OPTIONS=--max-old-space-size=200`, `GITHUB_TOKEN`). Apache hace de proxy en 127.0.0.1:3000 y Cloudflare va delante.

**Base de datos viva:** `/var/www/githubstars/.next/standalone/data/leaderboard.db` (+ `-wal` y `-shm`). Hay que conservarla siempre. `/var/www/githubstars/data/` es una copia vieja del 13/03 y no se usa.

## 1. Compilar en el box (nunca en el VPS)

```bash
cd /workspace/githubstars/DevStars
git fetch && git checkout <commit-aprobado>
npm ci && npm run lint && npm test && npm run build
cp -r public .next/standalone/public 2>/dev/null || true
rm -rf .next/standalone/.next/static && cp -r .next/static .next/standalone/.next/static
rm -rf .next/standalone/data            # nunca subir una .db local
# better-sqlite3: el binario pide GLIBC <= 2.29 (comprobado); en el VPS hay 2.39
objdump -T .next/standalone/node_modules/better-sqlite3/build/Release/better_sqlite3.node | grep -o 'GLIBC_[0-9.]*' | sort -Vu | tail -1
tar czf /tmp/githubstars-next.tgz .next/standalone .next/static
scp -i /home/box/.ssh/iaen_vps /tmp/githubstars-next.tgz root@192.210.232.73:/root/
```

## 2. En el VPS: copias, apt y cambio

```bash
ssh -i /home/box/.ssh/iaen_vps root@192.210.232.73
cd /var/www
F=$(date +%Y%m%d-%H%M)
tar czf /root/githubstars-bak-$F.tgz githubstars              # copia completa (incluye la .db)
apt update && apt dist-upgrade -y                             # antes del restart, como siempre
supervisorctl stop githubstars
mkdir -p /root/githubstars-db-$F && cp -a githubstars/.next/standalone/data/. /root/githubstars-db-$F/
mv githubstars/.next githubstars/.next.anterior
mkdir -p githubstars/.next && tar xzf /root/githubstars-next.tgz -C githubstars
mkdir -p githubstars/.next/standalone/data
cp -a /root/githubstars-db-$F/. githubstars/.next/standalone/data/
supervisorctl start githubstars
```

El supervisor no cambia: mismo comando, mismo puerto y mismo `GITHUB_TOKEN`. Al arrancar, la app migra la `.db` a `user_version=1` (solo añade dos índices `IF NOT EXISTS` y la tabla queda igual). La versión antigua sigue pudiendo leerla.

## 3. Comprobaciones

```bash
supervisorctl status githubstars
for u in / /leaderboard /user/torvalds /robots.txt /sitemap.xml /favicon.ico /api/leaderboard /api/leaderboard/status/IAnMove; do
  printf '%s %s\n' "$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:3000$u)" "$u"; done   # todo 200
curl -s -o /dev/null -w '%{http_code} %{redirect_url}\n' http://127.0.0.1:3000/torvalds            # 307 /user/torvalds
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3000/foo.php                             # 404
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3000/api/github/zz-no-existe-xq9         # 404
curl -s http://127.0.0.1:3000/api/leaderboard | head -c 200                                        # mismas filas que antes
ps -o rss=,args= -C node | grep -i next; free -m                                                   # RSS < ~300 MB
curl -s -o /dev/null -w '%{http_code}\n' https://githubstars.iaen.es/                              # a través de Cloudflare
```

Durante el primer día, vigila `/var/log/supervisor/githubstars.log` y la memoria. El pico de RSS medido en el box fue de unos 380 MB, con ráfagas que generan imágenes OG.

## 4. Vuelta atrás

```bash
supervisorctl stop githubstars
cd /var/www/githubstars
cp -a .next/standalone/data/. /root/githubstars-db-nueva-$(date +%H%M)/ 2>/dev/null   # por si se guardaron filas nuevas
rm -rf .next && mv .next.anterior .next
supervisorctl start githubstars
# último recurso: tar xzf /root/githubstars-bak-<F>.tgz -C /var/www
```

Cuando lleve unos días estable: `rm -rf /var/www/githubstars/.next.anterior`.

## Pendiente para el propietario

- **Cerrar el origen a Cloudflare.** Apache acepta conexiones directas en el 443, así que alguien que vaya al origen puede falsificar `CF-Connecting-IP` y saltarse el rate limit. Para cerrarlo, permite el 443 solo desde los rangos de Cloudflare (o usa Authenticated Origin Pulls).
- **Cloudflare no necesita Cache Rules.** Las respuestas ya llevan su `Cache-Control`.
- **Memoria.** Si RackNerd va justo, se pueden servir imágenes OG genéricas en lugar de una por usuario.

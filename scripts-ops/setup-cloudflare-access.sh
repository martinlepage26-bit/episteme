#!/usr/bin/env bash
# Pose Cloudflare Access devant episteme.pharos-ai.ca.
#
# Prérequis : un jeton API portant, sur le compte Martinlepage26@me.com,
#   Access: Apps and Policies — Edit    (obligatoire)
#   Access: Organizations — Read        (pour vérifier le domaine d'équipe)
# À défaut, le script tente le jeton embarqué dans ~/.cloudflared/cert.pem,
# qui sait lire les applications mais pas forcément les créer.
#
#   CF_API_TOKEN=xxxx ./setup-cloudflare-access.sh
#
# Rien n'est imprimé du jeton. Pour retirer Access : voir la fin du script.
set -euo pipefail

ACCT=1713c51cc6fbcf8d7143526b93495b76   # Martinlepage26@me.com's Account
HOST=episteme.pharos-ai.ca
EMAILS=("martinlepage.ai@gmail.com" "ml@pharos-ai.ca")

TOK="${CF_API_TOKEN:-}"
if [ -z "$TOK" ]; then
  TOK=$(python3 - <<'PY'
import base64,json,re,pathlib
raw=(pathlib.Path.home()/".cloudflared"/"cert.pem").read_text()
m=re.search(r"-----BEGIN ARGO TUNNEL TOKEN-----(.*?)-----END ARGO TUNNEL TOKEN-----",raw,re.S)
print(json.loads(base64.b64decode(re.sub(r"\s+","",m.group(1))))["apiToken"] if m else "")
PY
)
  echo "→ jeton lu depuis ~/.cloudflared/cert.pem (portée partielle attendue)"
fi
[ -n "$TOK" ] || { echo "Aucun jeton. Exportez CF_API_TOKEN."; exit 1; }

api() { curl -sS -H "Authorization: Bearer $TOK" -H 'Content-Type: application/json' "$@"; }
B=https://api.cloudflare.com/client/v4/accounts/$ACCT

echo "== 1. domaine d'équipe Zero Trust =="
ORG=$(api "$B/access/organizations")
if ! python3 -c "import sys,json;sys.exit(0 if json.load(sys.stdin).get('success') else 1)" <<<"$ORG"; then
  echo "   !! illisible avec ce jeton :"
  python3 -c "import sys,json;[print('     ',e.get('code'),e.get('message')) for e in json.load(sys.stdin).get('errors',[])]" <<<"$ORG"
  echo "   Si aucun domaine d'équipe n'existe, créez-le AVANT : "
  echo "   https://one.dash.cloudflare.com → Settings → Custom Pages / Team domain"
  echo "   Sans domaine d'équipe, l'écran de connexion Access ne peut pas aboutir."
  read -rp "   Continuer quand même ? [o/N] " a; [ "$a" = "o" ] || exit 1
else
  python3 -c "import sys,json;r=json.load(sys.stdin)['result'];print('   domaine :',r.get('auth_domain'),'| nom :',r.get('name'))" <<<"$ORG"
fi

echo "== 2. application Access =="
APP=$(api -X POST "$B/access/apps" --data "$(python3 -c "
import json,sys; print(json.dumps({
 'name':'Épistémè','domain':sys.argv[1],'type':'self_hosted',
 'session_duration':'24h','auto_redirect_to_identity':False,'app_launcher_visible':True}))" "$HOST")")
python3 -c "
import sys,json;d=json.load(sys.stdin)
if not d.get('success'):
    [print('   ERREUR',e.get('code'),e.get('message')) for e in d.get('errors',[])]; sys.exit(1)
print('   app id :',d['result']['id']); open('/tmp/cf_app_id','w').write(d['result']['id'])" <<<"$APP"
APP_ID=$(cat /tmp/cf_app_id)

echo "== 3. politique : PIN à usage unique, deux adresses =="
api -X POST "$B/access/apps/$APP_ID/policies" --data "$(python3 -c "
import json,sys; print(json.dumps({
 'name':'Martin uniquement','decision':'allow','precedence':1,
 'include':[{'email':{'email':e}} for e in sys.argv[1:]]}))" "${EMAILS[@]}")" \
| python3 -c "
import sys,json;d=json.load(sys.stdin)
print('   ok' if d.get('success') else '   ERREUR '+str([e.get('message') for e in d.get('errors',[])]))"

echo "== 4. vérification au bord =="
sleep 5
code=$(curl -s -o /dev/null -w '%{http_code}' -m 15 "https://$HOST/")
loc=$(curl -s -o /dev/null -D - -m 15 "https://$HOST/" | grep -i '^location:' || true)
echo "   HTTP $code   $loc"
case "$code" in
  302|303) echo "   ✔ Access intercepte : redirection vers l'écran de connexion." ;;
  200)     echo "   ✖ toujours 200 — la politique n'est pas appliquée. Vérifiez le tableau de bord." ;;
  *)       echo "   ? code inattendu — vérifiez avant de fermer la session." ;;
esac

cat <<TXT

Pour retirer Access (rollback) :
  curl -X DELETE -H "Authorization: Bearer \$CF_API_TOKEN" \\
    "$B/access/apps/$APP_ID"

L'authentification à l'origine (phrase de passe) reste active en dessous :
retirer Access ne rouvre pas l'outil au public.
TXT

#!/usr/bin/env bash
# Pose Cloudflare Access devant episteme.pharos-ai.ca.
#
# Usage :
#   CF_API_TOKEN=xxxx ./setup-cloudflare-access.sh            # vérifie puis pose
#   CF_API_TOKEN=xxxx ./setup-cloudflare-access.sh --check    # ne pose rien, diagnostique
#   CF_API_TOKEN=xxxx ./setup-cloudflare-access.sh --force    # passe outre l'étape 1
#
# Le jeton doit porter, sur le compte Martinlepage26@me.com :
#   Access: Apps and Policies — Edit   (obligatoire pour créer)
#   Access: Organizations — Read       (pour vérifier le domaine d'équipe)
#
# Le jeton embarqué dans ~/.cloudflared/cert.pem sert de repli : il sait lire
# les applications Access, mais PAS le domaine d'équipe — il ne suffit donc pas
# à valider l'étape 1. Vérifié le 2026-08-21.
#
# Non interactif : aucune invite, codes de sortie explicites.
set -euo pipefail

ACCT=1713c51cc6fbcf8d7143526b93495b76   # Martinlepage26@me.com's Account
HOST=episteme.pharos-ai.ca
EMAILS=("martinlepage.ai@gmail.com" "ml@pharos-ai.ca")

MODE=apply
case "${1:-}" in
  --check) MODE=check ;;
  --force) MODE=force ;;
  "")      ;;
  *)       echo "option inconnue : $1" >&2; exit 64 ;;
esac

TOK="${CF_API_TOKEN:-}"
SOURCE="CF_API_TOKEN"
if [ -z "$TOK" ]; then
  TOK=$(python3 - <<'PY'
import base64,json,re,pathlib
f=pathlib.Path.home()/".cloudflared"/"cert.pem"
if not f.exists(): print(""); raise SystemExit
m=re.search(r"-----BEGIN ARGO TUNNEL TOKEN-----(.*?)-----END ARGO TUNNEL TOKEN-----",f.read_text(),re.S)
print(json.loads(base64.b64decode(re.sub(r"\s+","",m.group(1)))).get("apiToken","") if m else "")
PY
)
  SOURCE="~/.cloudflared/cert.pem (repli)"
fi
[ -n "$TOK" ] || { echo "Aucun jeton disponible. Exportez CF_API_TOKEN." >&2; exit 78; }
echo "→ jeton : $SOURCE"

api() { curl -sS -H "Authorization: Bearer $TOK" -H 'Content-Type: application/json' "$@"; }
B=https://api.cloudflare.com/client/v4/accounts/$ACCT
ok() { python3 -c "import sys,json;sys.exit(0 if json.load(sys.stdin).get('success') else 1)"; }

echo "== 1. domaine d'équipe Zero Trust =="
ORG=$(api "$B/access/organizations" || true)
if printf '%s' "$ORG" | ok 2>/dev/null; then
  printf '%s' "$ORG" | python3 -c "
import sys,json;r=json.load(sys.stdin).get('result') or {}
print('   ✔ domaine :',r.get('auth_domain'),'| nom :',r.get('name'))"
else
  echo "   ✖ illisible avec ce jeton :"
  printf '%s' "$ORG" | python3 -c "
import sys,json
for e in json.load(sys.stdin).get('errors',[]): print('     ',e.get('code'),e.get('message'))" 2>/dev/null || echo "      (réponse illisible)"
  cat >&2 <<'TXT'

   Sans domaine d'équipe confirmé, créer l'application produirait un écran de
   connexion qui n'aboutit pas — donc un verrouillage.

   Deux issues :
     a) un jeton portant « Access: Organizations — Read », puis relancer ;
     b) le tableau de bord, qui crée le domaine d'équipe s'il manque :
        https://one.dash.cloudflare.com → Settings → Team domain
TXT
  [ "$MODE" = force ] || { echo "   Arrêt (relancez avec --force pour passer outre)." >&2; exit 75; }
  echo "   --force : on continue malgré tout."
fi

if [ "$MODE" = check ]; then
  echo "== mode --check : applications Access existantes =="
  api "$B/access/apps" | python3 -c "
import sys,json;d=json.load(sys.stdin)
r=d.get('result') if d.get('success') else None
print('   ',len(r),'application(s)') if r is not None else print('    illisible')
for a in (r or []): print('     -',a.get('name'),'→',a.get('domain'))"
  exit 0
fi

echo "== 2. application Access =="
APP=$(api -X POST "$B/access/apps" --data "$(python3 -c "
import json,sys;print(json.dumps({
 'name':'Épistémè','domain':sys.argv[1],'type':'self_hosted',
 'session_duration':'24h','auto_redirect_to_identity':False,'app_launcher_visible':True}))" "$HOST")")
APP_ID=$(printf '%s' "$APP" | python3 -c "
import sys,json;d=json.load(sys.stdin)
if not d.get('success'):
    [print('   ERREUR',e.get('code'),e.get('message'),file=sys.stderr) for e in d.get('errors',[])]
    sys.exit(1)
print(d['result']['id'])") || exit 1
echo "   ✔ app id : $APP_ID"

echo "== 3. politique : PIN à usage unique, deux adresses =="
api -X POST "$B/access/apps/$APP_ID/policies" --data "$(python3 -c "
import json,sys;print(json.dumps({
 'name':'Martin uniquement','decision':'allow','precedence':1,
 'include':[{'email':{'email':e}} for e in sys.argv[1:]]}))" "${EMAILS[@]}")" \
| python3 -c "
import sys,json;d=json.load(sys.stdin)
print('   ✔ politique posée' if d.get('success')
      else '   ✖ '+str([e.get('message') for e in d.get('errors',[])]))"

echo "== 4. vérification au bord =="
sleep 5
read -r code loc < <(curl -s -o /dev/null -D - -m 15 "https://$HOST/" \
  | awk 'BEGIN{c="";l="-"} /^HTTP/{c=$2} tolower($1)=="location:"{l=$2} END{print c, l}')
echo "   HTTP ${code:-?}   location: ${loc:--}"
case "${code:-}" in
  302|303) echo "   ✔ Access intercepte : redirection vers l'écran de connexion." ;;
  200)     echo "   ✖ toujours 200 — politique non appliquée. Vérifiez le tableau de bord." ;;
  *)       echo "   ? code inattendu — vérifiez AVANT de fermer cette session." ;;
esac

cat <<TXT

Rollback :
  curl -X DELETE -H "Authorization: Bearer \$CF_API_TOKEN" \\
    "$B/access/apps/$APP_ID"

L'authentification à l'origine (phrase de passe) reste active en dessous :
retirer Access ne rouvre pas l'outil au public.
TXT

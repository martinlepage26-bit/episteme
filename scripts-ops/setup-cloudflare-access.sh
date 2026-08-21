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
# Le jeton embarqué dans ~/.cloudflared/cert.pem NE SUFFIT PAS : exécution du
# 2026-08-21, il lit access/apps (0) mais la création renvoie 1010
# (portée insuffisante). Il faut donc un jeton créé pour l'occasion.
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
    for e in d.get('errors',[]):
        code=e.get('code'); msg=e.get('message') or e.get('error_chain',[{}])[0].get('message') or repr(e)
        print(f'   ERREUR {code}: {msg}',file=sys.stderr)
        if code==1010:
            print('   → le jeton n\'a pas « Access: Apps and Policies — Edit ».',file=sys.stderr)
            print('     Créez-en un : dash.cloudflare.com → My Profile → API Tokens.',file=sys.stderr)
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

echo "== 4. vérification au bord, avec retour arrière automatique =="
rollback() {
  echo "   ↩ retour arrière : suppression de l'application $APP_ID"
  api -X DELETE "$B/access/apps/$APP_ID" \
    | python3 -c "
import sys,json;d=json.load(sys.stdin)
print('   ✔ application supprimée, le site est rendu à son état précédent' if d.get('success')
      else '   ✖ ÉCHEC DU RETOUR ARRIÈRE — supprimez à la main : '+str([e.get('message') for e in d.get('errors',[])]))"
}

sleep 6
HDRS=$(curl -s -o /dev/null -D - -m 20 "https://$HOST/" || true)
code=$(printf '%s' "$HDRS" | awk '/^HTTP/{c=$2} END{print c}')
loc=$(printf '%s' "$HDRS"  | awk 'tolower($1)=="location:"{print $2}' | tr -d '\r')
echo "   HTTP ${code:-?}   location: ${loc:--}"

if [ "${code:-}" != "302" ] && [ "${code:-}" != "303" ]; then
  echo "   ✖ Access n'intercepte pas (attendu 302/303)."
  rollback; exit 1
fi

# L'écran de connexion doit exister réellement : sans domaine d'équipe, la
# redirection pointe vers un hôte qui ne répond pas — c'est exactement le cas
# qu'on ne pouvait pas exclure d'avance.
team=$(printf '%s' "$loc" | sed -E 's#^https?://([^/]+)/.*#\1#')
echo "   domaine d'équipe visé : ${team:-?}"
login=$(curl -s -o /dev/null -m 20 -w '%{http_code}' "https://$team/cdn-cgi/access/login/$HOST" || echo 000)
echo "   écran de connexion : HTTP $login"
if [ "$login" != "200" ]; then
  echo "   ✖ l'écran de connexion ne répond pas — verrouillage évité."
  rollback; exit 1
fi

echo "   ✔ Access actif et écran de connexion joignable."
cat <<TXT

Connexion : PIN à usage unique envoyé à
  ${EMAILS[*]}

Rollback manuel :
  curl -X DELETE -H "Authorization: Bearer \$CF_API_TOKEN" \\
    "$B/access/apps/$APP_ID"

L'authentification à l'origine (phrase de passe) reste active en dessous :
retirer Access ne rouvre pas l'outil au public.
TXT

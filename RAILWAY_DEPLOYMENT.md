# Railway Deployment Guide - Feature Branch Testing

## Webhook API Feature auf Railway testen

Diese Anleitung zeigt, wie du die `feature/webhook-send-message` Branch auf Railway testest.

---

## Schritt 1: Branch auf Railway umstellen

### Via Railway Dashboard:

1. **Gehe zu Railway**: https://railway.app
2. **Öffne dein Baileys Projekt**
3. **Wähle dein Service** (z.B. "baileys-bot")
4. **Settings → Source**
5. **Branch ändern:**
   - Klicke auf das Branch Dropdown
   - Wähle: `feature/webhook-send-message`
6. **Save** - Railway startet automatisch ein neues Deployment

---

## Schritt 2: Environment Variables hinzufügen

### Erforderliche Variables:

```bash
# 1. Webhook API Token generieren
openssl rand -base64 32
# Kopiere die Ausgabe
```

### Im Railway Dashboard:

1. **Variables Tab**
2. **+ New Variable**
3. **Füge hinzu:**

```
WEBHOOK_API_TOKEN=<füge-hier-den-generierten-token-ein>
NODE_ENV=production
```

**Beispiel:**
```
WEBHOOK_API_TOKEN=X7k9mP2vR5nQ8wL4hT6zC3bN1jM0sY9eA2dF8gH5
NODE_ENV=production
```

4. **Save Variables**
5. Railway deployed automatisch neu

---

## Schritt 3: Deployment überwachen

1. **Deployments Tab**
2. **Warte auf "Success" Status** (ca. 2-3 Minuten)
3. **Logs Tab** - Überprüfe die Logs:

**Erwartete Log-Ausgabe:**
```
🟢 Express Server läuft auf Port 3000
📊 Bereit für Railway Health Check
🔗 Webhook Endpunkt: POST /send-message
🔒 API Token Authentifizierung: AKTIV
✅ WhatsApp erfolgreich verbunden!
📋 3 Gruppen insgesamt verfügbar für Webhook API
```

---

## Schritt 4: Railway URL herausfinden

1. **Settings Tab**
2. **Domains Section**
3. **Kopiere die URL:** z.B. `https://baileys-production.up.railway.app`

**Oder via Logs:**
Die URL wird auch in den Logs angezeigt.

---

## Schritt 5: Health Check testen

```bash
# Ersetze URL mit deiner Railway URL
curl https://deine-url.up.railway.app/health | jq .
```

**Erwartete Antwort:**
```json
{
  "status": "OK",
  "timestamp": "2026-02-11T23:30:00.000Z",
  "whatsapp": "connected",
  "groups": 3,
  "qrAvailable": false
}
```

---

## Schritt 6: Webhook API testen

### A) Ohne Authentifizierung (sollte fehlschlagen):
```bash
curl -X POST https://deine-url.up.railway.app/send-message \
  -H "Content-Type: application/json" \
  -d '{"groupName":"Test","message":"Test"}'
```

**Erwartete Antwort (401):**
```json
{
  "success": false,
  "error": "Unauthorized: Missing Bearer token"
}
```

### B) Mit Authentifizierung:
```bash
# Setze deine Railway URL und Token
RAILWAY_URL="https://deine-url.up.railway.app"
RAILWAY_TOKEN="dein-railway-token-hier"

curl -X POST $RAILWAY_URL/send-message \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $RAILWAY_TOKEN" \
  -d '{
    "groupName": "Social Media Multiplikator 2025",
    "message": "🧪 Test von Railway Webhook Feature",
    "link": "https://github.com/WhiskeySockets/Baileys"
  }'
```

**Erwartete Antwort (200):**
```json
{
  "success": true,
  "messageId": "3EB0ABC123...",
  "groupJid": "120363419791987486@g.us",
  "groupName": "Social Media Multiplikator 2025",
  "timestamp": 1707691234567
}
```

---

## Schritt 7: Test mit Make.com

1. **Erstelle neues Make.com Szenario**
2. **Füge HTTP Module hinzu:**
   - **Method:** POST
   - **URL:** `https://deine-railway-url.up.railway.app/send-message`
   - **Headers:**
     ```
     Content-Type: application/json
     Authorization: Bearer <dein-railway-token>
     ```
   - **Body:**
     ```json
     {
       "groupName": "{{groupName}}",
       "message": "{{message}}",
       "link": "{{link}}"
     }
     ```
3. **Test Run** - Nachricht sollte in WhatsApp Gruppe erscheinen

---

## Zurück zu Master (nach Test)

### Wenn Test erfolgreich:

**Option A: Feature Branch mergen**
```bash
# Lokal
git checkout master
git merge feature/webhook-send-message
git push origin master
```

**Dann im Railway Dashboard:**
- Settings → Source
- Branch zurück auf `master`
- Save

**Option B: Weiter auf Feature-Branch bleiben**
- Nichts tun, Railway bleibt auf Feature-Branch

### Wenn Test nicht erfolgreich:

**Im Railway Dashboard:**
1. Settings → Source
2. Branch zurück auf `master`
3. Save
4. Fixes lokal machen und erneut pushen

---

## Troubleshooting

### Problem: Bot verbindet nicht mit WhatsApp

**Logs checken:**
```
❌ Verbindung geschlossen. Du wurdest ausgeloggt.
```

**Lösung:**
1. Railway Logs öffnen
2. QR Code URL finden: `/qr` Endpunkt
3. Öffne: `https://deine-url.up.railway.app/qr`
4. Scanne QR Code mit WhatsApp
5. Warte auf "✅ WhatsApp erfolgreich verbunden!"

### Problem: 401 Unauthorized bei allen Requests

**Ursache:** Token nicht gesetzt oder falsch

**Lösung:**
1. Railway Dashboard → Variables
2. Prüfe ob `WEBHOOK_API_TOKEN` gesetzt ist
3. Generiere neuen Token: `openssl rand -base64 32`
4. Update Variable
5. Service neu deployen

### Problem: 404 Group not found

**Ursache:** Gruppe existiert nicht oder Bot ist kein Mitglied

**Lösung:**
1. Health Check durchführen: `/health`
2. Prüfe `groups` Anzahl
3. Logs checken - alle Gruppen werden beim Connect aufgelistet
4. Exakte Schreibweise des Gruppennamens verwenden
5. Oder JID statt Name verwenden

### Problem: Port 3000 bereits belegt

**Ursache:** Lokaler Test noch aktiv

**Lösung:**
```bash
# Process finden und killen
lsof -ti:3001 | xargs kill -9
```

---

## Environment Variables Übersicht

| Variable | Erforderlich | Beispiel | Beschreibung |
|----------|--------------|----------|--------------|
| `WEBHOOK_API_TOKEN` | ✅ Ja | `X7k9mP2v...` | Bearer Token für API Auth |
| `NODE_ENV` | ⚠️ Empfohlen | `production` | Environment Mode |
| `PORT` | ❌ Nein | `3000` | Railway setzt automatisch |
| `WHATSAPP_PHONE_NUMBER` | ❌ Nein | `4917123456789` | Nur für Pairing Code |

---

## Nächste Schritte nach erfolgreichem Test

1. ✅ Feature-Branch mit master mergen
2. ✅ Railway auf master Branch zurückstellen
3. ✅ Production Environment Variables aktualisieren
4. ✅ Make.com Szenarien auf Production URL umstellen
5. ✅ Dokumentation für Team teilen (WEBHOOK_API.md)

---

## Support & Dokumentation

- **Vollständige API Docs:** Siehe `WEBHOOK_API.md`
- **Railway Docs:** https://docs.railway.app
- **Baileys Docs:** https://baileys.whiskeysockets.io

---

**🎉 Viel Erfolg beim Testen!**

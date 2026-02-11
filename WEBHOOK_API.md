# Webhook API Dokumentation

## Übersicht

Der Bot bietet jetzt eine REST API, um Nachrichten per Webhook an WhatsApp-Gruppen zu senden. Dies ermöglicht die Integration mit externen Services wie Make.com, Zapier oder eigenen Anwendungen.

## Authentifizierung

Die API verwendet Bearer Token Authentifizierung für Sicherheit.

### Token einrichten

Füge die folgende Zeile zur `.env` Datei hinzu:

```env
WEBHOOK_API_TOKEN=dein-geheimer-token-hier
```

**Empfehlung:** Verwende einen starken, zufälligen Token (mindestens 32 Zeichen).

### Token verwenden

Füge den Token im `Authorization` Header jeder Request hinzu:

```
Authorization: Bearer dein-geheimer-token-hier
```

## API Endpunkte

### POST /send-message

Sendet eine Textnachricht an eine WhatsApp-Gruppe.

#### Request

**URL:** `POST http://localhost:3000/send-message`

**Headers:**
```
Content-Type: application/json
Authorization: Bearer YOUR_TOKEN_HERE
```

**Body Parameters:**

| Parameter | Typ | Required | Beschreibung |
|-----------|-----|----------|--------------|
| `groupJid` | string | Optional* | JID der Zielgruppe (z.B. `120363419791987486@g.us`) |
| `groupName` | string | Optional* | Name der Zielgruppe (z.B. `Social Media Multiplikator 2025`) |
| `message` | string | Optional** | Die zu sendende Nachricht |
| `link` | string | Optional** | Ein Link (wird automatisch zur Nachricht hinzugefügt) |

\* Entweder `groupJid` ODER `groupName` muss angegeben werden
\*\* Entweder `message` ODER `link` muss angegeben werden

#### Beispiel Request

**Mit cURL:**
```bash
curl -X POST http://localhost:3000/send-message \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -d '{
    "groupName": "Social Media Multiplikator 2025",
    "message": "Hallo! Hier ist ein interessanter Artikel:",
    "link": "https://example.com/artikel"
  }'
```

**Mit JavaScript/Fetch:**
```javascript
const response = await fetch('http://localhost:3000/send-message', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer YOUR_TOKEN_HERE'
  },
  body: JSON.stringify({
    groupName: 'Social Media Multiplikator 2025',
    message: 'Hallo! Hier ist ein interessanter Artikel:',
    link: 'https://example.com/artikel'
  })
});

const data = await response.json();
console.log(data);
```

**Mit Make.com:**
1. Füge ein HTTP Module hinzu
2. Wähle "Make a request"
3. Setze URL: `https://deine-railway-url.up.railway.app/send-message`
4. Method: POST
5. Headers:
   - `Content-Type`: `application/json`
   - `Authorization`: `Bearer YOUR_TOKEN_HERE`
6. Body type: Raw
7. Content type: JSON
8. Request content:
```json
{
  "groupName": "{{groupName}}",
  "message": "{{message}}",
  "link": "{{link}}"
}
```

#### Response

**Success (200 OK):**
```json
{
  "success": true,
  "messageId": "3EB0123ABC456DEF789",
  "groupJid": "120363419791987486@g.us",
  "groupName": "Social Media Multiplikator 2025",
  "timestamp": 1234567890123
}
```

**Error Responses:**

**401 Unauthorized** - Fehlender oder ungültiger Token:
```json
{
  "success": false,
  "error": "Unauthorized: Invalid token"
}
```

**400 Bad Request** - Ungültige Request Parameter:
```json
{
  "success": false,
  "error": "Either groupJid or groupName is required"
}
```

**404 Not Found** - Gruppe nicht gefunden:
```json
{
  "success": false,
  "error": "Group not found: Social Media Test",
  "hint": "Make sure the bot is a member of this group"
}
```

**503 Service Unavailable** - Bot nicht verbunden:
```json
{
  "success": false,
  "error": "Bot not connected to WhatsApp"
}
```

**500 Internal Server Error** - Interner Fehler:
```json
{
  "success": false,
  "error": "Internal server error",
  "details": "Error details here"
}
```

### GET /health

Prüft den Status des Bots.

#### Request

```bash
curl http://localhost:3000/health
```

#### Response

```json
{
  "status": "OK",
  "timestamp": "2025-02-11T10:30:00.000Z",
  "whatsapp": "connected",
  "groups": 3,
  "qrAvailable": false
}
```

### GET /qr

Lädt das QR-Code Bild herunter (falls verfügbar).

#### Request

```bash
curl http://localhost:3000/qr -o qr.png
```

## Verwendungsbeispiele

### 1. Link aus Make.com senden

**Szenario:** Du hast einen Make.com Workflow, der RSS Feeds überwacht und neue Artikel in eine WhatsApp-Gruppe posten soll.

**Make.com Setup:**
1. **RSS Module:** Überwache Feed
2. **Filter:** Nur neue Artikel
3. **HTTP Module:** Sende an Bot
   ```json
   {
     "groupName": "Social Media Multiplikator 2025",
     "message": "Neuer Artikel: {{item.title}}",
     "link": "{{item.link}}"
   }
   ```

### 2. Automatische Newsletter Distribution

**Szenario:** Versende einen Link automatisch an mehrere Gruppen.

```javascript
const groups = [
  'Social Media Multiplikator 2025',
  'Erfolgstagebuch',
  'EUR LinkedIn Engagement Community'
];

const link = 'https://example.com/newsletter-2025-02';

for (const groupName of groups) {
  await fetch('http://localhost:3000/send-message', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer YOUR_TOKEN_HERE'
    },
    body: JSON.stringify({
      groupName,
      message: '📰 Neuer Newsletter verfügbar!',
      link
    })
  });

  // Warte 2 Sekunden zwischen Gruppen
  await new Promise(resolve => setTimeout(resolve, 2000));
}
```

### 3. Zapier Integration

1. Erstelle einen Zap
2. Trigger: Beliebiger Auslöser (z.B. Google Sheets, Airtable)
3. Action: Webhooks by Zapier
4. Action Event: Custom Request
5. URL: `https://deine-railway-url.up.railway.app/send-message`
6. Method: POST
7. Headers:
   - `Content-Type`: `application/json`
   - `Authorization`: `Bearer YOUR_TOKEN_HERE`
8. Data:
   ```json
   {
     "groupName": "Meine Gruppe",
     "message": "{{your_message}}",
     "link": "{{your_link}}"
   }
   ```

## Gruppen-Targeting

Die API kann Nachrichten an **ALLE** Gruppen senden, in denen der Bot Mitglied ist - nicht nur an überwachte Gruppen aus der Config.

### Gruppe per JID ansprechen

```json
{
  "groupJid": "120363419791987486@g.us",
  "message": "Test Nachricht"
}
```

### Gruppe per Name ansprechen

```json
{
  "groupName": "Social Media Multiplikator 2025",
  "message": "Test Nachricht"
}
```

**Hinweis:** Der Name muss exakt übereinstimmen (case-insensitive).

## Sicherheitshinweise

1. **Token geheim halten:** Teile den `WEBHOOK_API_TOKEN` niemals öffentlich
2. **HTTPS verwenden:** In Production immer HTTPS URLs verwenden
3. **Rate Limiting:** Vermeide zu viele Requests in kurzer Zeit
4. **Fehlerbehandlung:** Implementiere Retry-Logik für fehlgeschlagene Requests

## Deployment auf Railway

Die API funktioniert automatisch mit Railway Deployment:

1. Setze `WEBHOOK_API_TOKEN` als Environment Variable in Railway
2. Die URL ist: `https://dein-projekt.up.railway.app/send-message`
3. Railway Volume Storage wird für Auth State verwendet

## Troubleshooting

### Problem: 401 Unauthorized

**Lösung:**
- Prüfe ob `WEBHOOK_API_TOKEN` in `.env` gesetzt ist
- Stelle sicher, dass der Header korrekt formatiert ist: `Bearer TOKEN`
- Prüfe ob der Token im Request mit dem in `.env` übereinstimmt

### Problem: 404 Group not found

**Lösung:**
- Prüfe ob der Bot Mitglied der Gruppe ist
- Verwende die exakte Schreibweise des Gruppennamens
- Oder verwende die JID statt des Namens

### Problem: 503 Bot not connected

**Lösung:**
- Warte bis der Bot vollständig mit WhatsApp verbunden ist
- Prüfe die Logs: `✅ WhatsApp erfolgreich verbunden!`
- Scanne ggf. den QR-Code neu

## Logs

Der Bot loggt alle Webhook-Aktivitäten:

```
📤 Nachricht gesendet an Social Media Multiplikator 2025: Hallo! Hier ist ein interessanter...
```

Bei Fehlern:
```
❌ Fehler beim Senden der Nachricht: Error details
```

const express = require('express')
const app = express()
const PORT = 3001

app.use(express.json())

// Helper function für schöne Ausgabe
const logLink = (link, sender, groupName, timestamp, originalMessage, endpoint) => {
  console.log(`\n🔗 NEUER LINK EMPFANGEN! (${endpoint})`)
  console.log('═══════════════════════════════════════')
  console.log(`📅 Zeit: ${new Date(timestamp).toLocaleString()}`)
  console.log(`👤 Von: ${sender}`)
  console.log(`👥 Gruppe: ${groupName}`)
  console.log(`🔗 Link: ${link}`)
  console.log(`💬 Nachricht: ${originalMessage}`)
  console.log('═══════════════════════════════════════\n')
}

// Standard Webhook endpoint
app.post('/webhook', (req, res) => {
  const { link, sender, groupName, timestamp, originalMessage } = req.body
  logLink(link, sender, groupName, timestamp, originalMessage, '/webhook')
  res.status(200).json({ success: true, message: 'Link empfangen', endpoint: '/webhook' })
})

// Webhook für Social Media Multiplikator
app.post('/webhook/social-media', (req, res) => {
  const { link, sender, groupName, timestamp, originalMessage } = req.body
  logLink(link, sender, groupName, timestamp, originalMessage, '/webhook/social-media')
  res.status(200).json({ success: true, message: 'Social Media Link empfangen', endpoint: '/webhook/social-media' })
})

// Webhook für Erfolgstagebuch
app.post('/webhook/success-diary', (req, res) => {
  const { link, sender, groupName, timestamp, originalMessage } = req.body
  logLink(link, sender, groupName, timestamp, originalMessage, '/webhook/success-diary')
  res.status(200).json({ success: true, message: 'Erfolgstagebuch Link empfangen', endpoint: '/webhook/success-diary' })
})

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() })
})

app.listen(PORT, () => {
  console.log(`🚀 Webhook Server läuft auf http://localhost:${PORT}`)
  console.log(`📡 Webhook Endpoint: http://localhost:${PORT}/webhook`)
  console.log(`❤️  Health Check: http://localhost:${PORT}/health`)
})
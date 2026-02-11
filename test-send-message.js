#!/usr/bin/env node

/**
 * Test Script für /send-message API Endpunkt
 *
 * Usage:
 *   node test-send-message.js
 *
 * Voraussetzungen:
 *   - Bot muss laufen (npm run example)
 *   - WEBHOOK_API_TOKEN muss in .env gesetzt sein
 *   - Bot muss mit WhatsApp verbunden sein
 */

import dotenv from 'dotenv'

// Load environment variables
dotenv.config()

const API_URL = process.env.API_URL || 'http://localhost:3000'
const API_TOKEN = process.env.WEBHOOK_API_TOKEN

if (!API_TOKEN) {
  console.error('❌ WEBHOOK_API_TOKEN nicht in .env gesetzt!')
  console.error('Füge folgende Zeile zur .env Datei hinzu:')
  console.error('WEBHOOK_API_TOKEN=dein-token-hier')
  process.exit(1)
}

console.log('🧪 Test Script für /send-message API\n')

// Test 1: Health Check
async function testHealthCheck() {
  console.log('📋 Test 1: Health Check')
  try {
    const response = await fetch(`${API_URL}/health`)
    const data = await response.json()

    if (response.ok) {
      console.log('✅ Health Check erfolgreich')
      console.log(`   Status: ${data.status}`)
      console.log(`   WhatsApp: ${data.whatsapp}`)
      console.log(`   Gruppen: ${data.groups}`)

      if (data.whatsapp !== 'connected') {
        console.log('\n⚠️  WhatsApp nicht verbunden! Warte auf Verbindung...')
        return false
      }
      return true
    } else {
      console.log('❌ Health Check fehlgeschlagen')
      return false
    }
  } catch (error) {
    console.log('❌ Fehler beim Health Check:', error.message)
    console.log('   Stelle sicher dass der Bot läuft (npm run example)')
    return false
  }
}

// Test 2: Nachricht ohne Token (sollte 401 zurückgeben)
async function testWithoutToken() {
  console.log('\n📋 Test 2: Request ohne Token (erwartet 401)')
  try {
    const response = await fetch(`${API_URL}/send-message`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        groupName: 'Test',
        message: 'Test'
      })
    })

    if (response.status === 401) {
      console.log('✅ 401 Unauthorized wie erwartet')
      return true
    } else {
      console.log(`❌ Unerwarteter Status: ${response.status}`)
      return false
    }
  } catch (error) {
    console.log('❌ Fehler:', error.message)
    return false
  }
}

// Test 3: Nachricht ohne Parameter (sollte 400 zurückgeben)
async function testWithoutParameters() {
  console.log('\n📋 Test 3: Request ohne Parameter (erwartet 400)')
  try {
    const response = await fetch(`${API_URL}/send-message`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_TOKEN}`
      },
      body: JSON.stringify({})
    })

    if (response.status === 400) {
      const data = await response.json()
      console.log('✅ 400 Bad Request wie erwartet')
      console.log(`   Error: ${data.error}`)
      return true
    } else {
      console.log(`❌ Unerwarteter Status: ${response.status}`)
      return false
    }
  } catch (error) {
    console.log('❌ Fehler:', error.message)
    return false
  }
}

// Test 4: Nachricht an nicht-existierende Gruppe (sollte 404 zurückgeben)
async function testNonExistentGroup() {
  console.log('\n📋 Test 4: Request an nicht-existierende Gruppe (erwartet 404)')
  try {
    const response = await fetch(`${API_URL}/send-message`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_TOKEN}`
      },
      body: JSON.stringify({
        groupName: 'Diese Gruppe Existiert Nicht 12345',
        message: 'Test'
      })
    })

    if (response.status === 404) {
      const data = await response.json()
      console.log('✅ 404 Not Found wie erwartet')
      console.log(`   Error: ${data.error}`)
      return true
    } else {
      console.log(`❌ Unerwarteter Status: ${response.status}`)
      return false
    }
  } catch (error) {
    console.log('❌ Fehler:', error.message)
    return false
  }
}

// Test 5: Erfolgreiche Nachricht (OPTIONAL - wird nicht automatisch ausgeführt)
async function testSuccessfulMessage(groupName) {
  console.log(`\n📋 Test 5: Erfolgreiche Nachricht an "${groupName}"`)
  console.log('⚠️  WARNUNG: Dies sendet eine echte Nachricht an die Gruppe!')

  try {
    const testMessage = `🧪 Test von Webhook API - ${new Date().toLocaleString()}`

    const response = await fetch(`${API_URL}/send-message`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_TOKEN}`
      },
      body: JSON.stringify({
        groupName: groupName,
        message: testMessage,
        link: 'https://github.com/WhiskeySockets/Baileys'
      })
    })

    const data = await response.json()

    if (response.ok && data.success) {
      console.log('✅ Nachricht erfolgreich gesendet!')
      console.log(`   Message ID: ${data.messageId}`)
      console.log(`   Gruppe: ${data.groupName}`)
      console.log(`   JID: ${data.groupJid}`)
      return true
    } else {
      console.log('❌ Fehler beim Senden')
      console.log(`   Status: ${response.status}`)
      console.log(`   Error: ${data.error || 'Unknown'}`)
      if (data.hint) {
        console.log(`   Hinweis: ${data.hint}`)
      }
      return false
    }
  } catch (error) {
    console.log('❌ Fehler:', error.message)
    return false
  }
}

// Hauptfunktion
async function runTests() {
  console.log(`🔗 API URL: ${API_URL}`)
  console.log(`🔑 Token: ${API_TOKEN.substring(0, 10)}...`)
  console.log('\n' + '='.repeat(60))

  // Health Check ist erforderlich
  const healthOk = await testHealthCheck()
  if (!healthOk) {
    console.log('\n❌ Health Check fehlgeschlagen - Tests werden abgebrochen')
    console.log('Stelle sicher dass:')
    console.log('  1. Der Bot läuft (npm run example)')
    console.log('  2. WhatsApp verbunden ist')
    process.exit(1)
  }

  // Basis Tests
  await testWithoutToken()
  await testWithoutParameters()
  await testNonExistentGroup()

  console.log('\n' + '='.repeat(60))
  console.log('\n✅ Basis-Tests abgeschlossen!\n')

  // Optional: Echte Nachricht senden
  const args = process.argv.slice(2)
  if (args.includes('--send-real-message')) {
    const groupNameIndex = args.indexOf('--group')
    if (groupNameIndex !== -1 && args[groupNameIndex + 1]) {
      const groupName = args[groupNameIndex + 1]
      console.log('\n⚠️  Echte Nachricht wird gesendet...\n')
      await testSuccessfulMessage(groupName)
    } else {
      console.log('⚠️  --send-real-message Flag gesetzt aber --group nicht angegeben')
      console.log('Usage: node test-send-message.js --send-real-message --group "Gruppenname"')
    }
  } else {
    console.log('ℹ️  Um eine echte Nachricht zu senden, führe aus:')
    console.log('   node test-send-message.js --send-real-message --group "Gruppenname"')
  }

  console.log('\n✨ Alle Tests abgeschlossen!')
}

runTests().catch(console.error)

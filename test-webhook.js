// Test-Payload für Make.com Webhook (eigener Link)
const testPayload = {
  link: "https://example.com/mein-eigener-link",
  sender: "Eigener Account",
  groupName: "Erfolgstagebuch",
  timestamp: Date.now(),
  originalMessage: "Mein eigener Link: https://example.com/mein-eigener-link",
  isOwnMessage: true
}

const webhookUrl = "https://hook.eu2.make.com/ah311m191quk34co4ivp8glazcl1reiq"

async function sendTestPayload() {
  try {
    console.log('🚀 Sende Test-Payload an Make.com Webhook...')
    console.log('📤 URL:', webhookUrl)
    console.log('📋 Payload:', JSON.stringify(testPayload, null, 2))
    
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testPayload)
    })
    
    console.log('\n📊 Response Status:', response.status, response.statusText)
    
    if (response.ok) {
      const responseData = await response.text()
      console.log('✅ Erfolgreich gesendet!')
      console.log('📥 Response:', responseData || 'Keine Response-Daten')
    } else {
      console.log('❌ Fehler beim Senden')
      const errorText = await response.text()
      console.log('🚨 Error Response:', errorText)
    }
    
  } catch (error) {
    console.log('❌ Fehler:', error.message)
  }
}

// Test ausführen
sendTestPayload()
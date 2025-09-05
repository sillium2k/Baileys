import { Boom } from '@hapi/boom'
import NodeCache from '@cacheable/node-cache'
import readline from 'readline'
import makeWASocket, { type AnyMessageContent, BinaryInfo, delay, DisconnectReason, downloadAndProcessHistorySyncNotification, encodeWAM, fetchLatestBaileysVersion, getAggregateVotesInPollMessage, getHistoryMsg, isJidNewsletter, jidDecode, makeCacheableSignalKeyStore, normalizeMessageContent, type PatchedMessageWithRecipientJID, proto, useMultiFileAuthState, type WAMessageContent, type WAMessageKey } from '../src'
//import MAIN_LOGGER from '../src/Utils/logger'
// import open from 'open' // Not needed in production
import fs from 'fs'
import P from 'pino'
import QRCode from 'qrcode'
import dotenv from 'dotenv'
import http from 'http'

// Load environment variables
dotenv.config()

// Health Check Server für Railway (wird nach MONITORED_GROUPS geladen)

const logger = P({ timestamp: () => `,"time":"${new Date().toJSON()}"` }, P.destination('./wa-logs.txt'))
logger.level = 'trace'

const doReplies = process.argv.includes('--do-reply')
const usePairingCode = process.argv.includes('--use-pairing-code')

// Multi-Gruppen Konfiguration aus JSON-Datei
interface GroupConfig {
  jid: string
  name: string
  webhook: string
  enabled: boolean
  description?: string
}

interface GroupsConfiguration {
  monitoredGroups: GroupConfig[]
  settings: {
    defaultWebhook: string
    enableLogging: boolean
    logLevel: string
  }
}

const loadGroupsConfig = (): GroupConfig[] => {
  try {
    // Wähle Konfigurationsdatei basierend auf Environment
    const isProduction = process.env.NODE_ENV === 'production'
    const configPath = isProduction ? './groups-config.prod.json' : './groups-config.json'
    const configData = fs.readFileSync(configPath, 'utf-8')
    const config: GroupsConfiguration = JSON.parse(configData)
    
    // Nur aktive Gruppen zurückgeben
    const activeGroups = config.monitoredGroups.filter(group => group.enabled)
    
    console.log('🔧 Gruppen-Konfiguration geladen:')
    console.log(`   📁 Datei: ${configPath}`)
    console.log(`   📊 ${activeGroups.length} aktive Gruppen von ${config.monitoredGroups.length} insgesamt`)
    console.log('')
    
    activeGroups.forEach(group => {
      console.log(`   📋 ${group.name}`)
      console.log(`      🆔 JID: ${group.jid}`)
      console.log(`      🔗 Webhook: ${group.webhook}`)
      if (group.description) {
        console.log(`      📝 Info: ${group.description}`)
      }
      console.log('')
    })
    
    return activeGroups
    
  } catch (error) {
    console.log('⚠️  Fehler beim Laden der groups-config.json:', error instanceof Error ? error.message : String(error))
    console.log('⚙️  Verwende Fallback-Konfiguration')
    
    // Fallback-Konfiguration
    const fallbackGroups: GroupConfig[] = [
      {
        jid: '120363419791987486@g.us',
        name: 'Social Media Multiplikator 2025',
        webhook: 'https://hook.eu2.make.com/ah311m191quk34co4ivp8glazcl1reiq',
        enabled: true
      },
      {
        jid: '120363173935785980@g.us', 
        name: 'Erfolgstagebuch',
        webhook: 'https://hook.eu2.make.com/ah311m191quk34co4ivp8glazcl1reiq',
        enabled: true
      }
    ]
    
    console.log(`🔧 ${fallbackGroups.length} Fallback-Gruppen aktiviert`)
    return fallbackGroups
  }
}

const MONITORED_GROUPS = loadGroupsConfig()

// Health Check Server für Railway (startet sofort)
let whatsappConnected = false

const healthServer = http.createServer((req, res) => {
  if (req.url === '/health' || req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ 
      status: 'OK', 
      timestamp: new Date().toISOString(),
      whatsapp: whatsappConnected ? 'connected' : 'connecting',
      groups: MONITORED_GROUPS.length
    }))
  } else {
    res.writeHead(404, { 'Content-Type': 'text/plain' })
    res.end('Not Found')
  }
})

// Health Check Server sofort starten (nicht warten auf WhatsApp)
const port = process.env.PORT || 3000
healthServer.listen(port, () => {
  console.log(`🟢 Health Check Server läuft auf Port ${port}`)
  console.log(`📊 Bereit für Railway Health Check`)
})

// Link-Extraktion Funktion
const extractLinks = (text: string): string[] => {
  const urlRegex = /(https?:\/\/[^\s]+)/g
  const matches = text.match(urlRegex)
  return matches || []
}

// Webhook-Funktion mit dynamischer URL
const sendToWebhook = async (webhookUrl: string, linkData: { 
  link: string, 
  sender: string, 
  groupName: string, 
  timestamp: number,
  originalMessage: string,
  isOwnMessage?: boolean
}) => {
  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(linkData)
    })
    
    if (response.ok) {
      console.log(`✅ Link erfolgreich an Webhook gesendet (${linkData.groupName}):`, linkData.link)
    } else {
      console.log(`❌ Webhook-Fehler für ${linkData.groupName}:`, response.status, response.statusText)
    }
  } catch (error) {
    console.log(`❌ Fehler beim Senden an Webhook für ${linkData.groupName}:`, error)
  }
}

// Hilfsfunktion: Gruppe finden
const findGroupConfig = (jid: string): GroupConfig | undefined => {
  return MONITORED_GROUPS.find(group => group.jid === jid)
}

// external map to store retry counts of messages when decryption/encryption fails
// keep this out of the socket itself, so as to prevent a message decryption/encryption loop across socket restarts
const msgRetryCounterCache = new NodeCache() as any

const onDemandMap = new Map<string, string>()

// Read line interface
const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
const question = (text: string) => new Promise<string>((resolve) => rl.question(text, resolve))

// start a connection
const startSock = async() => {
	// Verwende Railway Volume oder Pairing Code für Production
	const authPath = process.env.NODE_ENV === 'production' ? '/app/data/baileys_auth_info' : 'baileys_auth_info'
	const { state, saveCreds } = await useMultiFileAuthState(authPath)
	// fetch latest version of WA Web
	const { version, isLatest } = await fetchLatestBaileysVersion()
	console.log(`using WA v${version.join('.')}, isLatest: ${isLatest}`)

	const sock = makeWASocket({
		version,
		logger,
		auth: {
			creds: state.creds,
			/** caching makes the store faster to send/recv messages */
			keys: makeCacheableSignalKeyStore(state.keys, logger),
		},
		msgRetryCounterCache,
		generateHighQualityLinkPreview: true,
		syncFullHistory: true, // Get full chat history
		// ignore all broadcast messages -- to receive the same
		// comment the line below out
		// shouldIgnoreJid: jid => isJidBroadcast(jid),
		// implement to handle retries & poll updates
		getMessage
	})

	// Pairing code handling wird im connection.update Event gemacht (siehe unten)

	const sendMessageWTyping = async(msg: AnyMessageContent, jid: string) => {
		await sock.presenceSubscribe(jid)
		await delay(500)

		await sock.sendPresenceUpdate('composing', jid)
		await delay(2000)

		await sock.sendPresenceUpdate('paused', jid)

		await sock.sendMessage(jid, msg)
	}

	// the process function lets you process all events that just occurred
	// efficiently in a batch
	sock.ev.process(
		// events is a map for event name => event data
		async(events) => {
			// something about the connection changed
			// maybe it closed, or we received all offline message or connection opened
			if(events['connection.update']) {
				const update = events['connection.update']
				const { connection, lastDisconnect, qr } = update
				
				// QR-Code oder Pairing Code handling (nach Baileys Docs)
				if(qr && !usePairingCode) {
					// QR-Code Methode (Standard)
					console.log('\n🔗 QR-Code zum Scannen:')
					console.log('Öffne WhatsApp → Verknüpfte Geräte → Gerät verknüpfen')
					console.log(await QRCode.toString(qr, { type: 'terminal' }))
				}
				
				// Pairing Code nur bei erstem Connect ohne registrierte Credentials
				if(usePairingCode && qr && !sock.authState.creds.registered) {
					try {
						// Pairing Code Methode (E.164 Format ohne +)
						const phoneNumber = process.env.WHATSAPP_PHONE_NUMBER
						if (!phoneNumber) {
							console.error('❌ WHATSAPP_PHONE_NUMBER environment variable not set!')
							console.error('Set it to your phone number without + (e.g. 4917123456789)')
							process.exit(1)
						}
						console.log(`📱 Requesting pairing code for: ${phoneNumber}`)
						const code = await sock.requestPairingCode(phoneNumber)
						console.log(`📱 Pairing Code: ${code}`)
						console.log('Gehe zu WhatsApp → Verknüpfte Geräte → Code eingeben')
					} catch (error) {
						console.error('❌ Fehler beim Anfordern des Pairing Codes:', error)
					}
				}
				
				if(connection === 'close') {
					const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode
					
					// Handle restartRequired (nach dem QR-Scan normal)
					if(statusCode === DisconnectReason.restartRequired) {
						console.log('🔄 Restart erforderlich nach QR-Scan (normal)')
						startSock()
					} else if(statusCode !== DisconnectReason.loggedOut) {
						console.log('🔄 Reconnecting...', DisconnectReason[statusCode || 0])
						startSock()
					} else {
						console.log('❌ Verbindung geschlossen. Du wurdest ausgeloggt.')
					}
				}
				
				if(connection === 'open') {
					console.log('✅ WhatsApp erfolgreich verbunden!')
					console.log('🚀 Link-Monitoring ist aktiv!')
					whatsappConnected = true
					
					// Nur überwachte Gruppen anzeigen
					try {
						const allGroups = await sock.groupFetchAllParticipating()
						console.log('\n📱 Überwachte Gruppen Status:')
						
						for (const monitoredGroup of MONITORED_GROUPS) {
							const group = allGroups[monitoredGroup.jid]
							if (group) {
								console.log(`✅ ${monitoredGroup.name}`)
								console.log(`   👥 ${group.participants?.length || 0} Teilnehmer`)
								console.log(`   🔗 Webhook: ${monitoredGroup.webhook}`)
								console.log(`   📅 Erstellt: ${group.creation ? new Date(group.creation * 1000).toLocaleString() : 'Unbekannt'}`)
								if (monitoredGroup.description) {
									console.log(`   📝 ${monitoredGroup.description}`)
								}
								console.log('')
							} else {
								console.log(`❌ ${monitoredGroup.name}`)
								console.log(`   ⚠️  Gruppe nicht gefunden oder nicht Mitglied`)
								console.log(`   🆔 JID: ${monitoredGroup.jid}`)
								console.log('')
							}
						}
					} catch (error) {
						console.log('❌ Fehler beim Abrufen der Gruppen-Status:', error)
					}
				}

				// WARNING: THIS WILL SEND A WAM EXAMPLE AND THIS IS A ****CAPTURED MESSAGE.****
				// DO NOT ACTUALLY ENABLE THIS UNLESS YOU MODIFIED THE FILE.JSON!!!!!
				// THE ANALYTICS IN THE FILE ARE OLD. DO NOT USE THEM.
				// YOUR APP SHOULD HAVE GLOBALS AND ANALYTICS ACCURATE TO TIME, DATE AND THE SESSION
				// THIS FILE.JSON APPROACH IS JUST AN APPROACH I USED, BE FREE TO DO THIS IN ANOTHER WAY.
				// THE FIRST EVENT CONTAINS THE CONSTANT GLOBALS, EXCEPT THE seqenceNumber(in the event) and commitTime
				// THIS INCLUDES STUFF LIKE ocVersion WHICH IS CRUCIAL FOR THE PREVENTION OF THE WARNING
				const sendWAMExample = false;
				if(connection === 'open' && sendWAMExample) {
					/// sending WAM EXAMPLE
					const {
						header: {
							wamVersion,
							eventSequenceNumber,
						},
						events,
					} = JSON.parse(await fs.promises.readFile("./boot_analytics_test.json", "utf-8"))

					const binaryInfo = new BinaryInfo({
						protocolVersion: wamVersion,
						sequence: eventSequenceNumber,
						events: events
					})

					const buffer = encodeWAM(binaryInfo);

					const result = await sock.sendWAMBuffer(buffer)
					console.log(result)
				}

				console.log('connection update', update)
			}

			// credentials updated -- save them
			if(events['creds.update']) {
				await saveCreds()
			}

			if(events['labels.association']) {
				console.log(events['labels.association'])
			}


			if(events['labels.edit']) {
				console.log(events['labels.edit'])
			}

			if(events.call) {
				console.log('recv call event', events.call)
			}

			// history received
			if(events['messaging-history.set']) {
				const { chats, contacts, messages, isLatest, progress, syncType } = events['messaging-history.set']
				if (syncType === proto.HistorySync.HistorySyncType.ON_DEMAND) {
					console.log('received on-demand history sync, messages=', messages)
				}
				console.log(`recv ${chats.length} chats, ${contacts.length} contacts, ${messages.length} msgs (is latest: ${isLatest}, progress: ${progress}%), type: ${syncType}`)
			}

			// received a new message
      if (events['messages.upsert']) {
        const upsert = events['messages.upsert']
        console.log('recv messages ', JSON.stringify(upsert, undefined, 2))

        if (!!upsert.requestId) {
          console.log("placeholder message received for request of id=" + upsert.requestId, upsert)
        }



        if (upsert.type === 'notify') {
          for (const msg of upsert.messages) {
            if (msg.message?.conversation || msg.message?.extendedTextMessage?.text) {
              const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text
              const isGroup = msg.key.remoteJid?.endsWith('@g.us')
              const groupConfig = isGroup ? findGroupConfig(msg.key.remoteJid!) : undefined
              
              // Gruppe oder private Nachricht identifizieren
              if (isGroup) {
                const groupName = groupConfig?.name || 'Unbekannte Gruppe'
                console.log(`👥 Gruppennachricht von ${msg.key.participant} in "${groupName}": "${text}"`)
              } else {
                console.log(`💬 Private Nachricht: "${text}"`)
              }

              // 🔗 LINK MONITORING für überwachte Gruppen
              if (groupConfig) {
                console.log(`🐛 DEBUG: Nachricht in überwachter Gruppe "${groupConfig.name}":`)
                console.log(`   📨 Von mir: ${msg.key.fromMe}`)
                console.log(`   👤 Sender: ${msg.key.participant || msg.key.remoteJid || 'Unbekannt'}`)
                console.log(`   💬 Text: "${text}"`)
                
                // Links aus ALLEN Nachrichten extrahieren (auch eigene)
                const links = extractLinks(text || '')
                console.log(`   🔍 Links gefunden: ${links.length}`)
                
                if (links.length > 0) {
                  const senderType = msg.key.fromMe ? "Eigener" : "Fremder"
                  console.log(`🔗 ${links.length} ${senderType} Link(s) gefunden in "${groupConfig.name}"!`)
                  links.forEach(link => console.log(`   🌐 Link: ${link}`))
                  
                  for (const link of links) {
                    const linkData = {
                      link,
                      sender: msg.key.fromMe ? 'Eigener Account' : (msg.key.participant || 'Unbekannt'),
                      groupName: groupConfig.name,
                      timestamp: typeof msg.messageTimestamp === 'number' ? msg.messageTimestamp : (msg.messageTimestamp?.toNumber() || Date.now()),
                      originalMessage: text || '',
                      isOwnMessage: msg.key.fromMe || false
                    }
                    
                    console.log(`📤 Sende ${senderType.toLowerCase()}en Link an Webhook: ${groupConfig.webhook}`)
                    // Link an gruppenspezifischen Webhook senden
                    await sendToWebhook(groupConfig.webhook, linkData)
                  }
                } else {
                  console.log(`   ℹ️  Keine Links in dieser Nachricht`)
                }
              } else {
                console.log(`🐛 DEBUG: Nachricht in nicht-überwachter Gruppe: ${msg.key.remoteJid}`)
              }

              if (text == "requestPlaceholder" && !upsert.requestId) {
                const messageId = await sock.requestPlaceholderResend(msg.key)
                console.log('requested placeholder resync, id=', messageId)
              }

              // go to an old chat and send this
              if (text == "onDemandHistSync") {
                const messageId = await sock.fetchMessageHistory(50, msg.key, msg.messageTimestamp!)
                console.log('requested on-demand sync, id=', messageId)
              }

              // Gruppen-spezifische Befehle
              if (text === "!gruppeninfo" && isGroup) {
                try {
                  const groupMeta = await sock.groupMetadata(msg.key.remoteJid!)
                  const response = `📊 Gruppeninfo:\n🔹 Name: ${groupMeta.subject}\n👥 Teilnehmer: ${groupMeta.participants.length}\n📅 Erstellt: ${groupMeta.creation ? new Date(groupMeta.creation * 1000).toLocaleString() : 'Unbekannt'}`
                  await sock.sendMessage(msg.key.remoteJid!, { text: response })
                } catch (error) {
                  console.log('❌ Fehler beim Abrufen der Gruppeninfos:', error)
                }
              }

              // Debug-Befehl für Erfolgstagebuch Historie
              if (text === "!debug" && groupConfig?.name === "Erfolgstagebuch") {
                try {
                  console.log('🔍 Lade letzte Nachrichten aus Erfolgstagebuch...')
                  const messages = await sock.fetchMessageHistory(10, msg.key, msg.messageTimestamp!)
                  console.log(`📜 Historie angefordert (ID: ${messages})`)
                } catch (error) {
                  console.log('❌ Fehler beim Abrufen der Historie:', error)
                }
              }

              // Auto-Reply deaktiviert - Bot antwortet nicht mehr automatisch
              // if (!msg.key.fromMe && doReplies && !isJidNewsletter(msg.key?.remoteJid!)) {
              //   console.log('replying to', msg.key.remoteJid)
              //   await sock!.readMessages([msg.key])
              //   await sendMessageWTyping({ text: 'Hello!' }, msg.key.remoteJid!)
              // }
            }
          }
        }
      }

			// messages updated like status delivered, message deleted etc.
			if(events['messages.update']) {
				console.log(
					JSON.stringify(events['messages.update'], undefined, 2)
				)

				for(const { key, update } of events['messages.update']) {
					if(update.pollUpdates) {
						const pollCreation: proto.IMessage = {} // get the poll creation message somehow
						if(pollCreation) {
							console.log(
								'got poll update, aggregation: ',
								getAggregateVotesInPollMessage({
									message: pollCreation,
									pollUpdates: update.pollUpdates,
								})
							)
						}
					}
				}
			}

			if(events['message-receipt.update']) {
				console.log(events['message-receipt.update'])
			}

			if(events['messages.reaction']) {
				console.log(events['messages.reaction'])
			}

			if(events['presence.update']) {
				console.log(events['presence.update'])
			}

			if(events['chats.update']) {
				console.log(events['chats.update'])
			}

			if(events['contacts.update']) {
				for(const contact of events['contacts.update']) {
					if(typeof contact.imgUrl !== 'undefined') {
						const newUrl = contact.imgUrl === null
							? null
							: await sock!.profilePictureUrl(contact.id!).catch(() => null)
						console.log(
							`contact ${contact.id} has a new profile pic: ${newUrl}`,
						)
					}
				}
			}

			if(events['chats.delete']) {
				console.log('chats deleted ', events['chats.delete'])
			}
		}
	)

	return sock

	async function getMessage(key: WAMessageKey): Promise<WAMessageContent | undefined> {
	  // Implement a way to retreive messages that were upserted from messages.upsert
			// up to you

		// only if store is present
		return proto.Message.fromObject({ conversation: 'test' })
	}
}

startSock()

const { makeWASocket, useSingleFileAuthState, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const fs = require('fs');
const fetch = require('node-fetch');
const OpenAI = require('openai');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const { state, saveState } = useSingleFileAuthState('./auth_info.json');

async function getAIReply(message, name) {
  // Try OpenAI GPT-3.5 Turbo
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [{ role: "system", content: "Aap Sir Ali Hamza ka assistant ho." },
                 { role: "user", content: message }]
    });
    const text = response.choices[0].message.content.trim();
    if (text) return text;
  } catch (e) {
    console.error("OpenAI error:", e.message);
  }

  // Fallback: Affiliate+ free chatbot
  try {
    const res = await fetch(`https://api.affiliateplus.xyz/api/chatbot?message=${encodeURIComponent(message)}&name=${name}&user=alihamza`);
    const data = await res.json();
    return data.message;
  } catch {
    return '🤖 AI temporarily unavailable. Try later.';
  }
}

async function startBot() {
  const { version } = await fetchLatestBaileysVersion();
  const sock = makeWASocket({
    version,
    auth: state,
    printQRInTerminal: false,
    browser: ['AliHamzaAI', 'Chrome', '110.0.0.0'],
  });

  sock.ev.on('creds.update', saveState);

  if (!fs.existsSync('./auth_info.json')) {
    const code = await sock.requestPairingCode('923XXXXXXXXX');
    console.log(`🔑 Your 8-digit pairing code: ${code}`);
    console.log('👉 Use WhatsApp → Linked Devices → Enter the code');
  }

  let greeted = {};

  sock.ev.on('messages.upsert', async ({ messages }) => {
    const m = messages[0];
    if (!m.message || m.key.fromMe) return;

    const jid = m.key.remoteJid;
    const name = m.pushName || 'User';
    const text = m.message.conversation ||
                 m.message.extendedTextMessage?.text ||
                 m.message.imageMessage?.caption || "";

    if (!greeted[jid]) {
      await sock.sendMessage(jid, {
        text: `👋 Assalamualaikum *${name}*!\n\n🤖 Main *Sir Ali Hamza* ka assistant hoon.\n🕐 Sir busy hain, main AI ke zariye aapki help karunga.\n\n📢 Follow our WhatsApp Channel:\n👉 https://whatsapp.com/channel/0029Vb09gVg1t`
      });
      greeted[jid] = true;
    }

    const aiReply = await getAIReply(text, name);
    await sock.sendMessage(jid, {
      text: `🧠 *${name}*: ${aiReply}\n\n📢 Follow our WhatsApp Channel:\n👉 https://whatsapp.com/channel/0029Vb09gVg1t`
    });
  });

  sock.ev.on('connection.update', ({ connection }) => {
    if (connection === 'open') console.log('✅ Connected to WhatsApp Web');
  });
}

startBot();
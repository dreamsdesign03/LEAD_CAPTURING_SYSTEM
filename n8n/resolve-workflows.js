// Resolves $env.* tokens in n8n workflow JSONs using secrets.local.json
// Usage: node n8n/resolve-workflows.js
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const srcDir = path.join(__dirname, 'workflows')
const outDir = path.join(__dirname, 'workflows-resolved')

const secrets = JSON.parse(fs.readFileSync(path.join(__dirname, 'secrets.local.json'), 'utf8'))

const tokens = {
  SUPABASE_URL: secrets.SUPABASE_URL,
  SUPABASE_SERVICE_KEY: secrets.SUPABASE_SERVICE_KEY,
  N8N_URL: secrets.N8N_URL,
  OPENAI_API_KEY: secrets.OPENAI_API_KEY,
  OPENAI_BASE_URL: secrets.OPENAI_BASE_URL,
  OPENAI_MODEL: secrets.OPENAI_MODEL,
  QUALIFY_THRESHOLD: secrets.QUALIFY_THRESHOLD,
  VAPI_API_KEY: secrets.VAPI_API_KEY,
  VAPI_PHONE_NUMBER_ID: secrets.VAPI_PHONE_NUMBER_ID,
  VAPI_URL: secrets.VAPI_URL,
  WHATSAPP_TOKEN: secrets.WHATSAPP_TOKEN,
  WHATSAPP_PHONE_NUMBER_ID: secrets.WHATSAPP_PHONE_NUMBER_ID,
}

fs.mkdirSync(outDir, { recursive: true })

let leftover = null
for (const file of fs.readdirSync(srcDir)) {
  if (!file.endsWith('.json')) continue
  let content = fs.readFileSync(path.join(srcDir, file), 'utf8')
  for (const [token, value] of Object.entries(tokens)) {
    if (!value) continue
    // 1. Remove expression braces directly around a token: {{ $env.X }} -> literal value
    content = content.replace(new RegExp(`\\{\\{\\s*\\$env\\.${token}\\s*\\}\\}`, 'g'), value)
    // 2. Bare tokens inside Code-node JS (backticks): only for values that are safe to inline literally
    if (['SUPABASE_URL', 'SUPABASE_SERVICE_KEY', 'N8N_URL'].includes(token)) {
      content = content.split(`$env.${token}`).join(value)
    }
  }
  if (!leftover) {
    leftover = content.match(/\$env\.(SUPABASE_URL|SUPABASE_SERVICE_KEY)/g)
  }
  fs.writeFileSync(path.join(outDir, file), content)
  console.log('resolved ->', path.join(outDir, file))
}

console.log('\nDone. Import the files from n8n/workflows-resolved/ into n8n.')
if (leftover) console.log('WARN: unresolved tokens found:', leftover)
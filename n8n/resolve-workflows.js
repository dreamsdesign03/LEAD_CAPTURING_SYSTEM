// Resolves $env.* tokens in n8n workflow JSONs using secrets.local.json
// Usage: node n8n/resolve-workflows.js
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const srcDir = path.join(__dirname, 'workflows')
const outDir = path.join(__dirname, 'workflows-resolved')

const secrets = JSON.parse(fs.readFileSync(path.join(__dirname, 'secrets.local.json'), 'utf8'))

// Tokens that may appear bare inside Code-node JS (safely quoted when inlined)
const INLINE_AS_JS = ['SUPABASE_URL', 'SUPABASE_SERVICE_KEY', 'N8N_URL']

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

/** Processes any string value: resolves {{ $env.X }} braces, then bare $env.X */
function resolveString(str) {
  let out = str
  for (const [token, value] of Object.entries(tokens)) {
    if (!value) continue
    // 1. {{ $env.X }} (expression braces) -> literal value
    out = out.replace(new RegExp(`\\{\\{\\s*\\$env\\.${token}\\s*\\}\\}`, 'g'), value)
    // 2. bare $env.X left (only appears inside Code-node JS) -> quoted JS string
    if (INLINE_AS_JS.includes(token) && out.includes(`$env.${token}`)) {
      out = out.split(`$env.${token}`).join(JSON.stringify(value))
    }
  }
  return out
}

/** Walks a parsed node/params tree and resolves every string */
function walk(node) {
  if (typeof node === 'string') return resolveString(node)
  if (Array.isArray(node)) {
    for (let i = 0; i < node.length; i++) node[i] = walk(node[i])
    return node
  }
  if (node && typeof node === 'object') {
    for (const k of Object.keys(node)) node[k] = walk(node[k])
    return node
  }
  return node
}

fs.mkdirSync(outDir, { recursive: true })

const unresolved = []
for (const file of fs.readdirSync(srcDir)) {
  if (!file.endsWith('.json')) continue
  const workflow = JSON.parse(fs.readFileSync(path.join(srcDir, file), 'utf8'))
  walk(workflow)
  fs.writeFileSync(path.join(outDir, file), JSON.stringify(workflow, null, 2))
  console.log('resolved ->', path.join(outDir, file))
}

// Final sanity check on decoded output
for (const file of fs.readdirSync(outDir)) {
  const text = fs.readFileSync(path.join(outDir, file), 'utf8')
  const json = JSON.parse(text)
  const hits = JSON.stringify(json).match(/\$env\.(SUPABASE_URL|SUPABASE_SERVICE_KEY)/g)
  if (hits) unresolved.push(`${file}: ${hits.join(', ')}`)
}
if (unresolved.length) console.log('WARN unresolved:', unresolved)
else console.log('\nAll workflows resolved. Import from n8n/workflows-resolved/ into n8n.')
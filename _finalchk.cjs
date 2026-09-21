const fs = require('fs')
const B = 'E:/Mansi/Lead_capturing_system/'
// 1) leads table columns from schema
const sch = fs.readFileSync(B + 'supabase/schema.sql', 'utf8')
const leadBlock = sch.slice(sch.indexOf('CREATE TABLE IF NOT EXISTS public.leads'), sch.indexOf(');', sch.indexOf('CREATE TABLE IF NOT EXISTS public.leads')))
console.log('=== leads table block (boolean flags) ===')
console.log('has company : ' + leadBlock.includes('company'))
console.log('has role    : ' + leadBlock.includes('role'))
console.log('has industry: ' + leadBlock.includes('industry'))
console.log('has city    : ' + leadBlock.includes('city'))
console.log('has budget  : ' + leadBlock.includes('budget'))
console.log('has website : ' + leadBlock.includes('website'))
console.log('has whatsapp: ' + leadBlock.includes('whatsapp'))
console.log('status CHECK: ' + (leadBlock.match(/CHECK \(status IN \(([^)]+)\)\)/) || ['', '(none)'])[1])
// 2) 00 Update Status node
const j00 = JSON.parse(fs.readFileSync(B + 'n8n/workflows/00_universal_lead_webhook.json', 'utf8'))
const u00 = j00.nodes.find((n) => n.id === 'unq-status')
console.log('\n=== 00 Update Status ===')
console.log('URL : ' + u00.parameters.url)
console.log('BODY: ' + u00.parameters.jsonBody)
const p00 = j00.nodes.find((n) => n.id === 'unq-parse')
console.log('PARSE jsCode:')
console.log(p00.parameters.jsCode)
// 3) 07 branch PATCHes
const j07 = JSON.parse(fs.readFileSync(B + 'n8n/workflows/07_ai_qualifier.json', 'utf8'))
for (const id of ['q-hot', 'q-cold']) {
  const n = j07.nodes.find((x) => x.id === id)
  console.log('\n=== 07 ' + id + ' (' + n.name + ') ===')
  console.log('URL : ' + n.parameters.url)
  console.log('BODY: ' + n.parameters.jsonBody)
}
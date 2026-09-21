const fs = require('fs')
function dump(file, cats) {
  const B = 'E:/Mansi/Lead_capturing_system/'
  const p = B + file
  if (!fs.existsSync(p)) { console.log('\n[MISSING] ' + file); return }
  const j = JSON.parse(fs.readFileSync(p, 'utf8'))
  console.log('\n############ ' + file + ' ############')
  j.nodes.forEach((n) => {
    const hit = cats && cats.some((c) => new RegExp(c, 'i').test(n.name))
    if (cats && !hit) return
    const par = n.parameters || {}
    const extra = []
    if (par.url) extra.push('url=' + par.url)
    if (par.jsonBody) extra.push('\\n  body=' + par.jsonBody)
    if (par.jsCode) extra.push('\\n  js=' + par.jsCode)
    if (par.jsCode2) extra.push('\\n  js2=' + par.jsCode2)
    const content = par.content || par.contents || par.jsonBody || par.jsCode
    if (par.text) extra.push('\\n  text=' + par.text)
    if (!cats && content) {
      console.log('  [' + (n.id || n.name) + '] ' + n.name + ' : ' + String(content).slice(0, 200).replace(/\\n/g, ' '))
    } else if (extra.length) {
      console.log('  [' + (n.id || n.name) + '] ' + n.name)
      extra.forEach((e) => console.log(e))
    } else if (!cats) {
      console.log('  [' + (n.id || n.name) + '] ' + n.name)
    }
  })
}
// resolved set
dump('n8n/workflows-resolved/00_universal_lead_webhook.json', ['update status', 'parse', 'insert lead'])
dump('n8n/workflows-resolved/07_ai_qualifier.json', ['update status', 'parse', 'qualified', 'cold'])

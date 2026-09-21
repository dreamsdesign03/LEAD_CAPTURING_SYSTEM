const fs = require('fs');
const B = 'supabase/';
const s = fs.readFileSync(B + 'schema.sql', 'utf8');
const hasBudget = s.includes('budget') && s.includes('5,00,000');
const hasHot = s.replace(/\s+/g, ' ').includes("'new', 'hot', 'warm', 'cold'");
const hasDetail = s.includes('company') && s.includes('whatsapp');
console.log('schema.sql: budget+band=' + hasBudget + '  hotwarmcold-check=' + hasHot + '  detail-cols=' + hasDetail);
console.log('migration file real tree: ' + fs.existsSync(B + 'migrations/migration_lead_details.sql'));

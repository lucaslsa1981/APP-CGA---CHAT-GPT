const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
let errors = 0;
for (const name of fs.readdirSync(root).filter(name => /\.(html|js|json)$/.test(name))) {
  const text = fs.readFileSync(path.join(root, name), 'utf8');
  try {
    if (name.endsWith('.json')) JSON.parse(text);
    else if (name.endsWith('.js')) new vm.Script(text, { filename: name });
    else {
      let count = 0;
      for (const match of text.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)) {
        const type = /\btype\s*=\s*["']([^"']+)/i.exec(match[1]);
        if (/\bsrc\s*=/i.test(match[1]) || (type && !['text/javascript', 'application/javascript'].includes(type[1]))) continue;
        new vm.Script(match[2], { filename: `${name}:script-${++count}` });
      }
    }
    console.log(`OK ${name}`);
  } catch (error) { errors++; console.error(`ERRO ${name}: ${error.message}`); }
}
process.exitCode = errors ? 1 : 0;

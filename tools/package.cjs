const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
const out = path.join(root, 'dist', 'APP-CGA');
fs.mkdirSync(out, { recursive: true });
const files = fs.readdirSync(root).filter(name => name.endsWith('.html') || ['logo-pcce.png', 'cga-auth.js', 'cga-export.js', 'package.json', 'Iniciar-CGA.cmd', 'Preparar-Download.ps1', '.gitignore', 'README.md', 'ANALISE-CODIGO.md', 'IMPLANTACAO.md'].includes(name));
for (const name of files) fs.copyFileSync(path.join(root, name), path.join(out, name));
for (const name of ['assets', 'tools', 'google-apps-script', '.github']) {
  if (fs.existsSync(path.join(root, name))) fs.cpSync(path.join(root, name), path.join(out, name), { recursive: true });
}
fs.writeFileSync(path.join(out, 'cga-dados.js'), '/* Distribuição limpa: configure o gestor master no primeiro acesso. */\nwindow.CGA_DADOS = null;\n');
fs.writeFileSync(path.join(out, 'cga-estado.json'), '{}\n');
const hashes = {};
function walk(dir) { for (const entry of fs.readdirSync(dir, { withFileTypes: true })) { const file = path.join(dir, entry.name); if (entry.isDirectory()) walk(file); else if (entry.name !== 'SHA256.json') hashes[path.relative(out, file).replace(/\\/g, '/')] = crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'); } }
walk(out);
fs.writeFileSync(path.join(out, 'SHA256.json'), JSON.stringify(hashes, null, 2));
console.log(`Pacote limpo preparado: ${out}`);

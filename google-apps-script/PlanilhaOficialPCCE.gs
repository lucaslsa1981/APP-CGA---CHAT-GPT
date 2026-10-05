/* Apps Script: cole em Extensões > Apps Script da planilha convertida para Google Planilhas */
const CHAVE = 'TROQUE-ESTA-CHAVE';
const ABA = 'PLANILHA OFICIAL PCCE', ABA_LOG = 'ALTERAÇÕES CGA (APP)';
function out_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
function serial_(d) { return (d.getTime() - d.getTimezoneOffset() * 60000) / 864e5 + 25569; }
function aba_() { const sh = SpreadsheetApp.getActive().getSheetByName(ABA); if (!sh) throw new Error('Aba ' + ABA + ' não encontrada'); return sh; }
function doGet(e) {
  try {
    if ((e.parameter.chave || '') !== CHAVE) return out_({ ok: false, msg: 'Chave inválida' });
    const ss = SpreadsheetApp.getActive(), v = aba_().getDataRange().getValues();
    const rows = v.map(r => r.map(c => c instanceof Date ? serial_(c) : c));
    return out_({ ok: true, nome: ss.getName(), aba: ABA, atualizadoEm: DriveApp.getFileById(ss.getId()).getLastUpdated().toISOString(), rows });
  } catch (err) { return out_({ ok: false, msg: String(err) }); }
}
function doPost(e) {
  const lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    const j = JSON.parse(e.postData.contents);
    if (j.chave !== CHAVE) return out_({ ok: false, msg: 'Chave inválida' });
    const sh = aba_(), v = sh.getDataRange().getValues(), H = v[0].map(x => String(x).trim());
    const iSeq = H.findIndex(x => x.toUpperCase() === 'SEQ'); if (iSeq < 0) throw new Error('Coluna SEQ não encontrada');
    const byColName = n => H.findIndex(x => x === String(n).trim());
    const rowOf = {}; v.forEach((r, i) => { if (i > 0 && String(r[iSeq]).trim() !== '') rowOf[String(r[iSeq]).replace(/\.0$/, '').trim()] = i + 1; });
    const toCell = c => c.data && typeof c.valor === 'number' ? new Date(Math.round((c.valor - 25569) * 864e5) + new Date().getTimezoneOffset() * 60000) : c.valor;
    let ok = 0; const falhas = [], log = [];
    (j.alteracoes || []).forEach(c => { const r = rowOf[String(c.seq).trim()], col = byColName(c.coluna); if (!r || col < 0) { falhas.push(c.seq + ' / ' + c.coluna); return; } const cell = sh.getRange(r, col + 1), antes = cell.getValue(); cell.setValue(toCell(c)); ok++; log.push([new Date(), j.usuario || '', c.seq, c.coluna, antes, toCell(c)]); });
    (j.novos || []).forEach(n => { if (rowOf[String(n.seq).trim()]) { falhas.push('SEQ ' + n.seq + ' já existe'); return; } const row = H.map(hd => { const c = (n.campos || []).find(x => x.coluna === hd); return c ? toCell(c) : ''; }); sh.appendRow(row); ok++; log.push([new Date(), j.usuario || '', n.seq, 'NOVO CADASTRO', '', 'incluído pelo app']); });
    if (log.length) { let lg = SpreadsheetApp.getActive().getSheetByName(ABA_LOG); if (!lg) { lg = SpreadsheetApp.getActive().insertSheet(ABA_LOG); lg.appendRow(['DATA/HORA', 'USUÁRIO', 'SEQ', 'COLUNA', 'VALOR ANTERIOR', 'VALOR NOVO']); } lg.getRange(lg.getLastRow() + 1, 1, log.length, 6).setValues(log); }
    return out_({ ok: true, aplicadas: ok, falhas });
  } catch (err) { return out_({ ok: false, msg: String(err) }); } finally { lock.releaseLock(); }
}
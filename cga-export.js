/* CGA/DRA – exportação dos documentos da prévia (DOCX e XLSX) */
(function () {
  if (window.CGAExport) return;
  var p2 = function (x) { return String(x).padStart(2, '0'); };
  var stamp = function () { var d = new Date(); return d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate()); };
  var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, ''); };
  var skip = function (el) { return el.hasAttribute('data-noprint') || /^(BUTTON|INPUT|SELECT|TEXTAREA|SCRIPT|STYLE|IMG|CANVAS)$/.test(el.tagName); };
  var clean = function (t) { return String(t || '').replace(/\u00a0/g, ' ').replace(/[ \t]+\n/g, '\n').trim(); };

  function styleOf(el) {
    var cs = getComputedStyle(el), fw = parseInt(cs.fontWeight, 10) || 400;
    var al = cs.textAlign; al = al === 'center' ? 'center' : al === 'right' || al === 'end' ? 'right' : al === 'justify' ? 'both' : 'left';
    return { b: fw >= 600, i: cs.fontStyle === 'italic', u: /underline/.test(cs.textDecorationLine || cs.textDecoration), sz: Math.max(12, Math.round(parseFloat(cs.fontSize) * 0.75 * 2)), al: al, ind: Math.round((parseFloat(cs.textIndent) || 0) * 15), upper: cs.textTransform === 'uppercase' };
  }
  function leafish(el) { for (var i = 0; i < el.children.length; i++) { var c = el.children[i]; if (skip(c)) continue; var d = getComputedStyle(c).display; if (d !== 'inline' && d !== 'contents') return false; } return true; }
  function cellText(el) { var parts = []; (function w(n) { if (n.nodeType === 3) { parts.push(n.textContent); return; } if (n.nodeType !== 1 || skip(n)) return; var d = getComputedStyle(n).display; if (d === 'none') return; var blk = d !== 'inline' && d !== 'contents'; if (blk && parts.length) parts.push('\n'); for (var i = 0; i < n.childNodes.length; i++) w(n.childNodes[i]); })(el); return clean(parts.join('').replace(/\n{2,}/g, '\n')); }

  function walk(el, out) {
    if (el.nodeType !== 1 || skip(el)) return;
    var cs = getComputedStyle(el); if (cs.display === 'none' || cs.visibility === 'hidden') return;
    var kids = [].filter.call(el.children, function (c) { return !skip(c) && getComputedStyle(c).display !== 'none'; });
    if (cs.display === 'grid' && kids.length > 1) {
      var cols = cs.gridTemplateColumns.split(/\s+/).filter(Boolean), n = Math.max(1, cols.length);
      if (n > 1) {
        var w = cols.map(function (c) { return parseFloat(c) || 1; }), bordered = cs.borderBottomStyle !== 'none' || kids.some(function (k) { var s = getComputedStyle(k); return s.borderBottomStyle !== 'none' || s.borderTopStyle !== 'none'; }) || parseFloat(cs.columnGap) < 3;
        var head = kids.every(function (k) { return (parseInt(getComputedStyle(k).fontWeight, 10) || 400) >= 600; });
        for (var r = 0; r < kids.length; r += n) {
          var row = kids.slice(r, r + n);
          out.push({ t: 'row', w: w, bordered: bordered, head: head && r === 0, cells: row.map(function (k) { return { text: cellText(k), st: styleOf(k) }; }) });
        }
        return;
      }
    }
    if (cs.display === 'flex' && !/column/.test(cs.flexDirection) && kids.length > 1 && kids.every(function (k) { return cellText(k); })) {
      out.push({ t: 'row', w: kids.map(function (k) { return k.getBoundingClientRect().width || 1; }), bordered: false, head: false, cells: kids.map(function (k, i) { var st = styleOf(k); if (kids.length === 2 && i === 1) st.al = 'right'; return { text: cellText(k), st: st }; }) });
      return;
    }
    if (!kids.length || leafish(el)) { var tx = cellText(el); if (tx) out.push({ t: 'p', text: tx, st: styleOf(el) }); return; }
    for (var i = 0; i < kids.length; i++) walk(kids[i], out);
  }

  function collect() {
    var pages = [].slice.call(document.querySelectorAll('[data-page]'));
    if (!pages.length) return null;
    var items = [], seenHead = {};
    pages.forEach(function (pg, pi) {
      var body = pg.querySelector('[data-pbody]') || pg.children[1] || pg;
      var arr = []; walk(body, arr);
      arr.forEach(function (it) { if (it.t === 'row' && it.head) { var k = it.cells.map(function (c) { return c.text; }).join('|'); if (seenHead[k]) return; seenHead[k] = 1; } items.push(it); });
      if (pi < pages.length - 1) items.push({ t: 'break' });
    });
    var r = pages[0].getBoundingClientRect();
    var imgs = [].slice.call(pages[0].querySelectorAll('img'));
    var ftxt = pages[0].lastElementChild ? cellText(pages[0].lastElementChild).split('\n').filter(function (l) { return !/^P[aá]gina \d+ de \d+$/.test(l) && !/^(Of[ií]cio n|ID )/.test(l); }) : [];
    var htxt = pages[0].firstElementChild ? cellText(pages[0].firstElementChild).split('\n').filter(Boolean) : [];
    return { items: items, landscape: r.width > r.height, imgs: imgs, header: htxt, footer: ftxt };
  }

  function imgData(img) {
    return new Promise(function (res) {
      try {
        var go = function () { try { var c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight; c.getContext('2d').drawImage(img, 0, 0); var b64 = c.toDataURL('image/png').split(',')[1]; var bin = atob(b64), u = new Uint8Array(bin.length); for (var i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); res({ bytes: u, w: img.naturalWidth, h: img.naturalHeight }); } catch (e) { res(null); } };
        if (img.complete && img.naturalWidth) go(); else { img.onload = go; img.onerror = function () { res(null); }; }
      } catch (e) { res(null); }
    });
  }

  /* ZIP (sem compressão) */
  var CRC = (function () { var t = new Uint32Array(256); for (var n = 0; n < 256; n++) { var c = n; for (var k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  function crc32(u) { var c = 0xFFFFFFFF; for (var i = 0; i < u.length; i++) c = CRC[(c ^ u[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
  function zip(files, mime) {
    var enc = new TextEncoder(), parts = [], central = [], off = 0;
    files.forEach(function (f) {
      var name = enc.encode(f.name), data = typeof f.data === 'string' ? enc.encode(f.data) : f.data, crc = crc32(data);
      var h = new DataView(new ArrayBuffer(30)); h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true); h.setUint16(8, 0, true); h.setUint32(14, crc, true); h.setUint32(18, data.length, true); h.setUint32(22, data.length, true); h.setUint16(26, name.length, true);
      parts.push(new Uint8Array(h.buffer), name, data);
      var c = new DataView(new ArrayBuffer(46)); c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true); c.setUint32(16, crc, true); c.setUint32(20, data.length, true); c.setUint32(24, data.length, true); c.setUint16(28, name.length, true); c.setUint32(42, off, true);
      central.push(new Uint8Array(c.buffer), name);
      off += 30 + name.length + data.length;
    });
    var csize = central.reduce(function (a, b) { return a + b.length; }, 0);
    var e = new DataView(new ArrayBuffer(22)); e.setUint32(0, 0x06054b50, true); e.setUint16(8, files.length, true); e.setUint16(10, files.length, true); e.setUint32(12, csize, true); e.setUint32(16, off, true);
    return new Blob(parts.concat(central, [new Uint8Array(e.buffer)]), { type: mime || 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
  }

  function run(text, st, extraSz) {
    var rp = '<w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/>' + (st.b ? '<w:b/>' : '') + (st.i ? '<w:i/>' : '') + (st.upper ? '<w:caps/>' : '') + '<w:sz w:val="' + (extraSz || st.sz) + '"/><w:szCs w:val="' + (extraSz || st.sz) + '"/>' + (st.u ? '<w:u w:val="single"/>' : '') + '</w:rPr>';
    return String(text).split('\n').map(function (l, i) { return '<w:r>' + rp + (i ? '<w:br/>' : '') + '<w:t xml:space="preserve">' + esc(l) + '</w:t></w:r>'; }).join('');
  }
  function para(text, st, after) { return '<w:p><w:pPr><w:spacing w:before="0" w:after="' + (after == null ? 80 : after) + '"/>' + (st.ind ? '<w:ind w:firstLine="' + st.ind + '"/>' : '') + '<w:jc w:val="' + st.al + '"/></w:pPr>' + run(text, st) + '</w:p>'; }
  function drawing(rid, id, cx, cy) {
    return '<w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="' + cx + '" cy="' + cy + '"/><wp:docPr id="' + id + '" name="img' + id + '"/><a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="' + id + '" name="img' + id + '.png"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="' + rid + '"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="' + cx + '" cy="' + cy + '"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>';
  }
  var NS = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"';

  function docx(prefix) {
    var c = collect(); if (!c) { alert('Nenhum documento na visualização prévia.'); return; }
    var pgW = c.landscape ? 16838 : 11906, pgH = c.landscape ? 11906 : 16838, mar = 1020, usable = pgW - 2 * mar;
    var body = [], rows = null;
    var flush = function () {
      if (!rows) return;
      var n = Math.max.apply(null, rows.map(function (r) { return r.cells.length; })), w = rows[0].w.slice(0, n), tot = w.reduce(function (a, b) { return a + b; }, 0) || 1;
      var gw = w.map(function (x) { return Math.max(300, Math.round(x / tot * usable)); });
      var bd = rows[0].bordered ? '<w:tblBorders><w:top w:val="single" w:sz="4" w:color="1F2328"/><w:bottom w:val="single" w:sz="4" w:color="1F2328"/><w:insideH w:val="single" w:sz="2" w:color="AEB6BF"/><w:left w:val="nil"/><w:right w:val="nil"/><w:insideV w:val="nil"/></w:tblBorders>' : '<w:tblBorders><w:top w:val="nil"/><w:left w:val="nil"/><w:bottom w:val="nil"/><w:right w:val="nil"/><w:insideH w:val="nil"/><w:insideV w:val="nil"/></w:tblBorders>';
      var x = '<w:tbl><w:tblPr><w:tblW w:w="' + usable + '" w:type="dxa"/>' + bd + '<w:tblLayout w:type="fixed"/><w:tblCellMar><w:top w:w="40" w:type="dxa"/><w:left w:w="60" w:type="dxa"/><w:bottom w:w="40" w:type="dxa"/><w:right w:w="60" w:type="dxa"/></w:tblCellMar></w:tblPr><w:tblGrid>' + gw.map(function (g) { return '<w:gridCol w:w="' + g + '"/>'; }).join('') + '</w:tblGrid>';
      rows.forEach(function (r) {
        x += '<w:tr>' + (r.head ? '<w:trPr><w:tblHeader/><w:cantSplit/></w:trPr>' : '<w:trPr><w:cantSplit/></w:trPr>');
        for (var i = 0; i < n; i++) { var cell = r.cells[i] || { text: '', st: { al: 'left', sz: 18 } }; x += '<w:tc><w:tcPr><w:tcW w:w="' + gw[i] + '" w:type="dxa"/>' + (r.head && r.bordered ? '<w:shd w:val="clear" w:color="auto" w:fill="F1F4F6"/>' : '') + '</w:tcPr>' + para(cell.text, cell.st, 0) + '</w:tc>'; }
        x += '</w:tr>';
      });
      body.push(x + '</w:tbl><w:p><w:pPr><w:spacing w:after="60"/></w:pPr></w:p>'); rows = null;
    };
    c.items.forEach(function (it) {
      if (it.t === 'row') { if (rows && (rows[0].cells.length !== it.cells.length || rows[0].bordered !== it.bordered)) flush(); (rows = rows || []).push(it); return; }
      flush();
      if (it.t === 'break') body.push('<w:p><w:r><w:br w:type="page"/></w:r></w:p>');
      else body.push(para(it.text, it.st));
    });
    flush();
    var imgs = c.imgs.slice(0, 3);
    Promise.all(imgs.map(imgData)).then(function (data) {
      var media = [], rel = [], hdrRel = [], ftrRel = [], id = 1;
      var addImg = function (d, list, hEmu, wEmu) { if (!d) return ''; var n = media.length + 1, rid = 'rImg' + n; media.push({ name: 'word/media/image' + n + '.png', data: d.bytes }); list.push('<Relationship Id="' + rid + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/image' + n + '.png"/>'); return drawing(rid, id++, wEmu || Math.round(hEmu * d.w / d.h), hEmu); };
      var logoL = addImg(data[0], hdrRel, 470000), logoR = addImg(data[1], hdrRel, 500000), faixa = addImg(data[2], ftrRel, 130000, Math.round(usable * 635));
      var hdrLines = c.header.map(function (l, i) { return para(l, { b: true, al: 'center', sz: i ? 18 : 20 }, 0); }).join('');
      var header = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:hdr ' + NS + '>' + (logoL || logoR ? '<w:tbl><w:tblPr><w:tblW w:w="' + usable + '" w:type="dxa"/><w:tblBorders><w:top w:val="nil"/><w:left w:val="nil"/><w:bottom w:val="nil"/><w:right w:val="nil"/><w:insideH w:val="nil"/><w:insideV w:val="nil"/></w:tblBorders><w:tblLayout w:type="fixed"/></w:tblPr><w:tblGrid><w:gridCol w:w="' + (usable / 2) + '"/><w:gridCol w:w="' + (usable / 2) + '"/></w:tblGrid><w:tr><w:tc><w:tcPr><w:tcW w:w="' + (usable / 2) + '" w:type="dxa"/></w:tcPr><w:p>' + logoL + '</w:p></w:tc><w:tc><w:tcPr><w:tcW w:w="' + (usable / 2) + '" w:type="dxa"/></w:tcPr><w:p><w:pPr><w:jc w:val="right"/></w:pPr>' + logoR + '</w:p></w:tc></w:tr></w:tbl>' : '') + hdrLines + '<w:p><w:pPr><w:pBdr><w:bottom w:val="single" w:sz="8" w:space="1" w:color="1F2328"/></w:pBdr><w:spacing w:after="120"/></w:pPr></w:p></w:hdr>';
      var footer = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:ftr ' + NS + '>' + (faixa ? '<w:p><w:pPr><w:spacing w:after="40"/></w:pPr>' + faixa + '</w:p>' : '') + c.footer.map(function (l) { return para(l, { al: 'center', sz: 14 }, 0); }).join('') + '<w:p><w:pPr><w:spacing w:after="0"/><w:jc w:val="right"/></w:pPr>' + run('Página ', { sz: 14 }) + '<w:r><w:rPr><w:sz w:val="14"/></w:rPr><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:rPr><w:sz w:val="14"/></w:rPr><w:instrText xml:space="preserve"> PAGE </w:instrText></w:r><w:r><w:rPr><w:sz w:val="14"/></w:rPr><w:fldChar w:fldCharType="end"/></w:r>' + run(' de ', { sz: 14 }) + '<w:r><w:rPr><w:sz w:val="14"/></w:rPr><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:rPr><w:sz w:val="14"/></w:rPr><w:instrText xml:space="preserve"> NUMPAGES </w:instrText></w:r><w:r><w:rPr><w:sz w:val="14"/></w:rPr><w:fldChar w:fldCharType="end"/></w:r></w:p></w:ftr>';
      var doc = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document ' + NS + '><w:body>' + body.join('') + '<w:sectPr><w:headerReference w:type="default" r:id="rHdr"/><w:footerReference w:type="default" r:id="rFtr"/><w:pgSz w:w="' + pgW + '" w:h="' + pgH + '"' + (c.landscape ? ' w:orient="landscape"' : '') + '/><w:pgMar w:top="2600" w:right="' + mar + '" w:bottom="1700" w:left="' + mar + '" w:header="560" w:footer="400" w:gutter="0"/></w:sectPr></w:body></w:document>';
      var R = function (list) { return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' + list.join('') + '</Relationships>'; };
      var files = [
        { name: '[Content_Types].xml', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/header1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/><Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/></Types>' },
        { name: '_rels/.rels', data: R(['<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>']) },
        { name: 'word/_rels/document.xml.rels', data: R(rel.concat(['<Relationship Id="rHdr" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/header" Target="header1.xml"/>', '<Relationship Id="rFtr" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/>'])) },
        { name: 'word/_rels/header1.xml.rels', data: R(hdrRel) },
        { name: 'word/_rels/footer1.xml.rels', data: R(ftrRel) },
        { name: 'word/document.xml', data: doc }, { name: 'word/header1.xml', data: header }, { name: 'word/footer1.xml', data: footer }
      ].concat(media);
      save(zip(files), (prefix || 'Documento') + '_' + stamp() + '.docx');
      if (window.CGAAuth) try { CGAAuth.log('Documento exportado em DOCX: ' + prefix); } catch (e) { }
    });
  }

  function xlsx(prefix) {
    var c = collect(); if (!c) { alert('Nenhum documento na visualização prévia.'); return; }
    if (!window.XLSX) { alert('Leitor de planilhas não carregado.'); return; }
    var aoa = [], merges = [], maxc = 1, heads = [];
    c.header.forEach(function (l) { aoa.push([l]); heads.push(aoa.length - 1); });
    aoa.push([]);
    c.items.forEach(function (it) {
      if (it.t === 'break') { aoa.push([]); return; }
      if (it.t === 'row') { maxc = Math.max(maxc, it.cells.length); aoa.push(it.cells.map(function (x) { return x.text; })); return; }
      aoa.push([it.text]); heads.push(aoa.length - 1);
    });
    aoa.push([]); c.footer.forEach(function (l) { aoa.push([l]); heads.push(aoa.length - 1); });
    heads.forEach(function (r) { if (maxc > 1) merges.push({ s: { r: r, c: 0 }, e: { r: r, c: maxc - 1 } }); });
    var ws = XLSX.utils.aoa_to_sheet(aoa); ws['!merges'] = merges;
    var widths = []; aoa.forEach(function (r, ri) { if (heads.indexOf(ri) >= 0) return; r.forEach(function (v, i) { var l = Math.max.apply(null, String(v || '').split('\n').map(function (s) { return s.length; })); widths[i] = Math.min(60, Math.max(widths[i] || 8, l + 2)); }); });
    ws['!cols'] = widths.map(function (w) { return { wch: w || 12 }; });
    var wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Documento');
    XLSX.writeFile(wb, (prefix || 'Documento') + '_' + stamp() + '.xlsx');
    if (window.CGAAuth) try { CGAAuth.log('Documento exportado em XLSX: ' + prefix); } catch (e) { }
  }

  function save(blob, name) { var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 800); }

  /* PPTX a partir de um modelo de slides: {title, sub, kpis[], items[], heads[], fr[], rows[][], note} */
  function pptx(slides, o) {
    o = o || {}; var font = o.font || 'Arial', sc = (o.size || 100) / 100, W = 12192000, H = 6858000, total = slides.length;
    var NSA = 'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"';
    var hex = function (c) { return String(c || '000000').replace('#', '').toUpperCase(); };
    var R0 = function (n) { return Math.round(n); };
    function para(p) {
      var rp = '<a:rPr lang="pt-BR" sz="' + R0((p.sz || 14) * sc * 100) + '"' + (p.b ? ' b="1"' : '') + (p.i ? ' i="1"' : '') + (p.u ? ' u="sng"' : '') + ' dirty="0"><a:solidFill><a:srgbClr val="' + hex(p.color || '1F2328') + '"/></a:solidFill><a:latin typeface="' + esc(font) + '"/><a:cs typeface="' + esc(font) + '"/></a:rPr>';
      return String(p.t == null ? '' : p.t).split('\n').map(function (l) { return '<a:p><a:pPr algn="' + (p.al || 'l') + '"><a:lnSpc><a:spcPct val="' + R0((o.lh || 1.15) * 100000) + '"/></a:lnSpc></a:pPr><a:r>' + rp + '<a:t>' + esc(l) + '</a:t></a:r></a:p>'; }).join('');
    }
    var sid;
    function sp(x, y, w, h, op) {
      op = op || {}; var id = ++sid;
      var fill = op.fill ? '<a:solidFill><a:srgbClr val="' + hex(op.fill) + '"/></a:solidFill>' : '<a:noFill/>';
      var ln = op.line ? '<a:ln w="9525"><a:solidFill><a:srgbClr val="' + hex(op.line) + '"/></a:solidFill></a:ln>' : '<a:ln><a:noFill/></a:ln>';
      var tx = op.paras ? '<p:txBody><a:bodyPr wrap="square" lIns="' + (op.ins == null ? 72000 : op.ins) + '" tIns="36000" rIns="72000" bIns="36000" anchor="' + (op.anchor || 't') + '"/><a:lstStyle/>' + op.paras.map(para).join('') + '</p:txBody>' : '<p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:endParaRPr lang="pt-BR"/></a:p></p:txBody>';
      return '<p:sp><p:nvSpPr><p:cNvPr id="' + id + '" name="Forma ' + id + '"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="' + R0(x) + '" y="' + R0(y) + '"/><a:ext cx="' + R0(w) + '" cy="' + R0(h) + '"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom>' + fill + ln + '</p:spPr>' + tx + '</p:sp>';
    }
    function pic(x, y, w, h) { var id = ++sid; return '<p:pic><p:nvPicPr><p:cNvPr id="' + id + '" name="Logo"/><p:cNvPicPr/><p:nvPr/></p:nvPicPr><p:blipFill><a:blip r:embed="rId2"/><a:stretch><a:fillRect/></a:stretch></p:blipFill><p:spPr><a:xfrm><a:off x="' + R0(x) + '" y="' + R0(y) + '"/><a:ext cx="' + R0(w) + '" cy="' + R0(h) + '"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr></p:pic>'; }
    var M = 420000, CW = W - 2 * M;
    return new Promise(function (res) { var im = new Image(); im.onload = function () { imgData(im).then(res); }; im.onerror = function () { res(null); }; im.src = 'assets/logo-pcce.png'; }).then(function (logo) {
      var files = [], ctypes = '', presIds = '', presRels = '';
      slides.forEach(function (s, i) {
        sid = 1; var sh = '';
        sh += sp(0, 0, W, 880000, { fill: '16191D' }) + sp(0, 880000, W, 36000, { fill: 'BFAB5F' });
        sh += sp(M, 100000, CW - 1300000, 440000, { anchor: 'ctr', ins: 0, paras: [{ t: s.title, sz: 24, b: 1, color: 'FFFFFF' }] });
        sh += sp(M, 540000, CW - 1300000, 300000, { ins: 0, paras: [{ t: s.sub || '', sz: 12, color: 'BFAB5F' }] });
        if (logo) { var lh = 600000, lw = Math.min(1100000, lh * logo.w / logo.h); sh += sp(W - M - lw - 120000, 140000, lw + 120000, 640000, { fill: 'FFFFFF' }) + pic(W - M - lw - 60000, 170000, lw, lh - 0); }
        var y0 = 1150000, y1 = H - 500000;
        if (s.kpis && s.kpis.length) {
          var bw = (CW - 2 * 150000) / 3, bh = 1500000;
          s.kpis.slice(0, 9).forEach(function (k, j) { var cx = M + (j % 3) * (bw + 150000), cy = y0 + Math.floor(j / 3) * (bh + 150000);
            sh += sp(cx, cy, bw, bh, { fill: 'F5F6F8', line: 'E2E5E9', paras: [{ t: String(k.l || '').toUpperCase(), sz: 10, b: 1, color: '5F6B76' }, { t: String(k.v), sz: 28, b: 1 }, { t: k.s || '', sz: 10, color: '5F6B76' }] }); });
        }
        if (s.items && s.items.length) {
          var n = Math.min(10, s.items.length), rh = Math.min(420000, (y1 - y0) / n), tw = 6200000;
          s.items.slice(0, n).forEach(function (it, j) { var cy = y0 + j * rh;
            sh += sp(M, cy, 3400000, rh, { anchor: 'ctr', ins: 0, paras: [{ t: it.label, sz: 12 }] });
            sh += sp(M + 3500000, cy + rh * .22, tw, rh * .56, { fill: 'EEF0F3' });
            sh += sp(M + 3500000, cy + rh * .22, Math.max(30000, tw * (it.pctN || 0)), rh * .56, { fill: it.color || '405A68' });
            sh += sp(M + 3500000 + tw + 100000, cy, CW - 3500000 - tw - 100000, rh, { anchor: 'ctr', ins: 0, paras: [{ t: it.n, sz: 12, b: 1, al: 'r' }] }); });
        }
        if (s.heads && s.rows) {
          var fr = s.fr && s.fr.length === s.heads.length ? s.fr : s.heads.map(function () { return 1; }), ft = fr.reduce(function (a, b) { return a + b; }, 0), rh2 = 440000, x = M, xs = [], ws = [];
          fr.forEach(function (f) { var w = CW * f / ft; xs.push(x); ws.push(w); x += w; });
          sh += sp(M, y0, CW, rh2, { fill: 'F1F4F6' });
          s.heads.forEach(function (hd, c) { sh += sp(xs[c], y0, ws[c], rh2, { anchor: 'ctr', paras: [{ t: String(hd).toUpperCase(), sz: 9, b: 1, color: '3A4450' }] }); });
          s.rows.forEach(function (r, j) { var cy = y0 + rh2 + j * rh2; sh += sp(M, cy + rh2 - 6000, CW, 6350, { fill: 'D5DAE0' });
            r.forEach(function (cell, c) { if (c < xs.length) sh += sp(xs[c], cy, ws[c], rh2, { anchor: 'ctr', paras: [{ t: String(cell), sz: 10 }] }); }); });
        }
        if (s.note) sh += sp(M, y0, CW, y1 - y0, { ins: 0, paras: [{ t: s.note, sz: 16, al: o.align || 'l', b: o.b, i: o.i, u: o.u }] });
        sh += sp(M, H - 420000, CW, 6350, { fill: 'D5DAE0' }) + sp(M, H - 400000, CW, 300000, { ins: 0, anchor: 'ctr', paras: [{ t: 'Célula de Gestão de Ativos – CGA/DRA · ' + (o.footer || '') + '     ' + (i + 1) + ' / ' + total, sz: 9, color: '7D8590' }] });
        files.push({ name: 'ppt/slides/slide' + (i + 1) + '.xml', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:sld ' + NSA + '><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/>' + sh + '</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>' });
        files.push({ name: 'ppt/slides/_rels/slide' + (i + 1) + '.xml.rels', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>' + (logo ? '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/logo.png"/>' : '') + '</Relationships>' });
        ctypes += '<Override PartName="/ppt/slides/slide' + (i + 1) + '.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>';
        presIds += '<p:sldId id="' + (256 + i) + '" r:id="rId' + (i + 2) + '"/>';
        presRels += '<Relationship Id="rId' + (i + 2) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide' + (i + 1) + '.xml"/>';
      });
      var X = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>', RELNS = 'xmlns="http://schemas.openxmlformats.org/package/2006/relationships"', RT = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/';
      var clr = ['dk1:000000', 'lt1:FFFFFF', 'dk2:16191D', 'lt2:F5F6F8', 'accent1:405A68', 'accent2:3FA9C7', 'accent3:BFAB5F', 'accent4:4AAE35', 'accent5:F59D12', 'accent6:E3301A', 'hlink:245A73', 'folHlink:6B7A86'].map(function (c) { var p = c.split(':'); return '<a:' + p[0] + '><a:srgbClr val="' + p[1] + '"/></a:' + p[0] + '>'; }).join('');
      var fl = '<a:solidFill><a:schemeClr val="phClr"/></a:solidFill>', lnS = '<a:ln w="9525"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln>';
      var theme = X + '<a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="CGA"><a:themeElements><a:clrScheme name="CGA">' + clr + '</a:clrScheme><a:fontScheme name="CGA"><a:majorFont><a:latin typeface="' + esc(font) + '"/><a:ea typeface=""/><a:cs typeface=""/></a:majorFont><a:minorFont><a:latin typeface="' + esc(font) + '"/><a:ea typeface=""/><a:cs typeface=""/></a:minorFont></a:fontScheme><a:fmtScheme name="CGA"><a:fillStyleLst>' + fl + fl + fl + '</a:fillStyleLst><a:lnStyleLst>' + lnS + lnS + lnS + '</a:lnStyleLst><a:effectStyleLst><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle></a:effectStyleLst><a:bgFillStyleLst>' + fl + fl + fl + '</a:bgFillStyleLst></a:fmtScheme></a:themeElements></a:theme>';
      var tree = '<p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/></p:spTree>';
      files.push(
        { name: '[Content_Types].xml', data: X + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/><Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/><Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/><Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/><Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>' + ctypes + '</Types>' },
        { name: '_rels/.rels', data: X + '<Relationships ' + RELNS + '><Relationship Id="rId1" Type="' + RT + 'officeDocument" Target="ppt/presentation.xml"/></Relationships>' },
        { name: 'ppt/presentation.xml', data: X + '<p:presentation ' + NSA + '><p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst><p:sldIdLst>' + presIds + '</p:sldIdLst><p:sldSz cx="12192000" cy="6858000"/><p:notesSz cx="6858000" cy="9144000"/></p:presentation>' },
        { name: 'ppt/_rels/presentation.xml.rels', data: X + '<Relationships ' + RELNS + '><Relationship Id="rId1" Type="' + RT + 'slideMaster" Target="slideMasters/slideMaster1.xml"/>' + presRels + '</Relationships>' },
        { name: 'ppt/slideMasters/slideMaster1.xml', data: X + '<p:sldMaster ' + NSA + '><p:cSld><p:bg><p:bgPr><a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill><a:effectLst/></p:bgPr></p:bg>' + tree + '</p:cSld><p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/><p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rId1"/></p:sldLayoutIdLst></p:sldMaster>' },
        { name: 'ppt/slideMasters/_rels/slideMaster1.xml.rels', data: X + '<Relationships ' + RELNS + '><Relationship Id="rId1" Type="' + RT + 'slideLayout" Target="../slideLayouts/slideLayout1.xml"/><Relationship Id="rId2" Type="' + RT + 'theme" Target="../theme/theme1.xml"/></Relationships>' },
        { name: 'ppt/slideLayouts/slideLayout1.xml', data: X + '<p:sldLayout ' + NSA + ' type="blank"><p:cSld name="Em branco">' + tree + '</p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sldLayout>' },
        { name: 'ppt/slideLayouts/_rels/slideLayout1.xml.rels', data: X + '<Relationships ' + RELNS + '><Relationship Id="rId1" Type="' + RT + 'slideMaster" Target="../slideMasters/slideMaster1.xml"/></Relationships>' },
        { name: 'ppt/theme/theme1.xml', data: theme });
      if (logo) files.push({ name: 'ppt/media/logo.png', data: logo.bytes });
      save(zip(files, 'application/vnd.openxmlformats-officedocument.presentationml.presentation'), (o.name || 'Portal_CGA') + '_' + stamp() + '.pptx');
    });
  }

  window.CGAExport = { docx: docx, xlsx: xlsx, pptx: pptx };
})();

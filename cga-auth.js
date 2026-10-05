(function () {
  if (window.CGAAuth) return;
  var MEM = {}, _memReady = false, _pend = [], _memDb = !!window.indexedDB, _dadosDone = false;
  var KU = 'cga.auth.users.v1', KS = 'cga.auth.session.v1', KL = 'cga.auth.log.v1', KSUM = 'cga.summary.';
  var APPS = { judiciais: { label: 'Veículos Judiciais', file: 'Gestao de Veiculos Judiciais.dc.html', list: 'veiculos' }, act: { label: 'Veículos Administrativos · ACT', file: 'Gestao de Veiculos Administrativos ACT.dc.html', list: 'veículos' }, senad: { label: 'Bens SENAD', file: 'Gestao de Bens SENAD.dc.html', list: 'ativos' }, uso: { label: 'Veículos de Uso Institucional', file: 'Gestao de Veiculos de Uso Institucional.dc.html', list: 'veículos' }, suite: { label: 'Processos SUITE / SEI', file: 'Gestao de Processos SUITE-SEI.dc.html', list: 'processos' }, pga: { label: 'Controle de Ativos Passíveis de Reversão', file: 'Controle de Ativos Passiveis de Reversao.dc.html', list: 'ativos' } };
  var PERFIS = {
    master: { label: 'Gestor master', desc: 'Acesso total: usuários, fonte de dados, edição e documentos', edit: true, control: true, fonte: true, users: true },
    gestor: { label: 'Gestor', desc: 'Corrige dados, cadastra, controle CGA, relatórios e despachos', edit: true, control: true },
    operador: { label: 'Operador', desc: 'Status e observações CGA, relatórios e despachos', control: true },
    consulta: { label: 'Consulta', desc: 'Somente leitura e impressão de relatórios' }
  };
  var SESSION_H = 10;
  function get(k, d) { try { var v = JSON.parse(localStorage.getItem(k) || 'null'); return v == null ? d : v; } catch (e) { return d; } }
  function set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { } }
  function norm(s) { return String(s || '').trim().toLowerCase(); }
  function rnd() { var a = new Uint8Array(12); (window.crypto || {}).getRandomValues ? crypto.getRandomValues(a) : a.forEach(function (_, i) { a[i] = Math.floor(Math.random() * 256); }); return Array.from(a).map(function (b) { return b.toString(16).padStart(2, '0'); }).join(''); }
  function fallbackHash(s) { var h1 = 0x811c9dc5, h2 = 0x1000193; for (var r = 0; r < 2000; r++) for (var i = 0; i < s.length; i++) { h1 = Math.imul(h1 ^ s.charCodeAt(i), 16777619) >>> 0; h2 = Math.imul(h2 + s.charCodeAt(i) + r, 2246822519) >>> 0; } return 'f' + h1.toString(16) + h2.toString(16); }
  function hash(pass, salt) {
    var s = salt + '|' + pass;
    if (window.crypto && crypto.subtle && window.TextEncoder) return crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)).then(function (b) { return Array.from(new Uint8Array(b)).map(function (x) { return x.toString(16).padStart(2, '0'); }).join(''); }).catch(function () { return fallbackHash(s); });
    return Promise.resolve(fallbackHash(s));
  }
  function users() { return get(KU, []); }
  function saveUsers(u) { set(KU, u); }
  function find(login) { var l = norm(login); return users().find(function (u) { return u.login === l; }); }
  function log(evt, who) { var s = who || (current() || {}).login || '—'; var l = get(KL, []); l.unshift({ at: Date.now(), who: s, evt: evt }); set(KL, l.slice(0, 1000)); }
  function current() {
    var s = get(KS, null); if (!s || s.exp < Date.now()) return null;
    var u = find(s.login); if (!u || u.active === false) return null;
    return { login: u.login, name: u.name, perfil: u.perfil, apps: u.perfil === 'master' ? Object.keys(APPS) : (u.apps || []), mustChange: !!u.mustChange };
  }
  function can(action) { var c = current(); return !!(c && PERFIS[c.perfil] && PERFIS[c.perfil][action]); }
  function canApp(app) { var c = current(); return !!(c && APPS[app] && (c.perfil === 'master' || c.apps.indexOf(app) >= 0)); }
  var api = {
    APPS: APPS, PERFIS: PERFIS,
    users: function () { return users().map(function (u) { return Object.assign({}, u, { hash: undefined, salt: undefined }); }); },
    hasUsers: function () { return users().length > 0; },
    createMaster: function (name, login, pass) {
      if (users().some(function (u) { return u.perfil === 'master'; })) return Promise.resolve({ ok: false, msg: 'Já existe gestor master.' });
      return api.saveUser({ name: name, login: login, perfil: 'master', apps: Object.keys(APPS), active: true }, pass, true).then(function (r) { if (r.ok) return api.login(login, pass); return r; });
    },
    saveUser: function (u, pass, isNew) {
      var list = users(), l = norm(u.login);
      if (!l || !/^[a-z0-9._-]{3,}$/.test(l)) return Promise.resolve({ ok: false, msg: 'Login com ao menos 3 caracteres (letras, números, ponto, hífen).' });
      if (!String(u.name || '').trim()) return Promise.resolve({ ok: false, msg: 'Informe o nome.' });
      var i = list.findIndex(function (x) { return x.login === l; });
      if (isNew && i >= 0) return Promise.resolve({ ok: false, msg: 'Login já cadastrado.' });
      if (!isNew && i < 0) return Promise.resolve({ ok: false, msg: 'Usuário não encontrado.' });
      if ((isNew || pass) && String(pass || '').length < 6) return Promise.resolve({ ok: false, msg: 'Senha com ao menos 6 caracteres.' });
      var old = i >= 0 ? list[i] : {};
      if (old.perfil === 'master' && (u.perfil !== 'master' || u.active === false) && list.filter(function (x) { return x.perfil === 'master' && x.active !== false; }).length <= 1) return Promise.resolve({ ok: false, msg: 'É preciso manter ao menos um gestor master ativo.' });
      var rec = Object.assign({}, old, { login: l, name: String(u.name).trim(), matricula: String(u.matricula || '').trim(), perfil: PERFIS[u.perfil] ? u.perfil : 'consulta', apps: u.perfil === 'master' ? Object.keys(APPS) : (u.apps || []).filter(function (a) { return APPS[a]; }), active: u.active !== false, createdAt: old.createdAt || Date.now() });
      var p = pass ? (function () { var salt = rnd(); return hash(pass, salt).then(function (h) { rec.salt = salt; rec.hash = h; rec.mustChange = !!u.mustChange; rec.pwAt = Date.now(); }); })() : Promise.resolve();
      return p.then(function () { if (i >= 0) list[i] = rec; else list.push(rec); saveUsers(list); log((isNew ? 'Usuário criado: ' : 'Usuário alterado: ') + l + (pass && !isNew ? ' (senha redefinida)' : '')); return { ok: true }; });
    },
    removeUser: function (login) {
      var list = users(), l = norm(login), u = find(l); if (!u) return { ok: false, msg: 'Usuário não encontrado.' };
      if ((current() || {}).login === l) return { ok: false, msg: 'Não é possível excluir o próprio usuário.' };
      if (u.perfil === 'master' && list.filter(function (x) { return x.perfil === 'master'; }).length <= 1) return { ok: false, msg: 'É preciso manter ao menos um gestor master.' };
      saveUsers(list.filter(function (x) { return x.login !== l; })); log('Usuário excluído: ' + l); return { ok: true };
    },
    login: function (login, pass) {
      var u = find(login);
      if (!u) return Promise.resolve({ ok: false, msg: (window.CGA_DADOS ? 'Usuário ou senha inválidos.' : 'Usuário ou senha inválidos. Se o acesso foi criado agora, feche esta janela e abra o Portal novamente pela pasta compartilhada para receber o cadastro.') });
      if (u.active === false) return Promise.resolve({ ok: false, msg: 'Usuário desativado. Procure o gestor master.' });
      return hash(pass, u.salt).then(function (h) {
        if (h !== u.hash) { log('Tentativa de acesso com senha incorreta', u.login); return { ok: false, msg: 'Usuário ou senha inválidos.' }; }
        set(KS, { login: u.login, at: Date.now(), exp: Date.now() + SESSION_H * 3600e3 });
        var list = users(); list.forEach(function (x) { if (x.login === u.login) x.lastLogin = Date.now(); }); saveUsers(list);
        log('Entrada no sistema', u.login); return { ok: true, mustChange: !!u.mustChange };
      });
    },
    changeOwnPassword: function (pass) {
      var c = current(); if (!c) return Promise.resolve({ ok: false, msg: 'Sessão encerrada.' });
      if (String(pass || '').length < 6) return Promise.resolve({ ok: false, msg: 'Senha com ao menos 6 caracteres.' });
      var list = users(), u = list.find(function (x) { return x.login === c.login; }), salt = rnd();
      return hash(pass, salt).then(function (h) { u.salt = salt; u.hash = h; u.mustChange = false; u.pwAt = Date.now(); saveUsers(list); log('Senha alterada pelo próprio usuário'); return { ok: true }; });
    },
    logout: function () { var c = current(); if (c) log('Saída do sistema'); try { localStorage.removeItem(KS); } catch (e) { } if (!isPortal) setTimeout(function () { try { sessionStorage.removeItem('cga.next'); } catch (e) { } location.replace(PORTAL); }, 50); },
    current: current, can: can, canApp: canApp, log: log,
    logs: function () { return get(KL, []); },
    publishSummary: function (app, sum) { var prev = get(KSUM + app, null); if (prev) { var p = Object.assign({}, prev); delete p.at; try { if (JSON.stringify(p) === JSON.stringify(sum)) return; } catch (e) { } } set(KSUM + app, Object.assign({ at: Date.now() }, sum)); },
    summary: function (app) { return get(KSUM + app, null); },
    exportPack: function () { return JSON.stringify({ tipo: 'cga-acesso', geradoEm: new Date().toISOString(), users: users() }, null, 1); },
    importPack: function (txt) {
      var j; try { j = JSON.parse(txt); } catch (e) { return { ok: false, msg: 'Arquivo inválido.' }; }
      if (!j || j.tipo !== 'cga-acesso' || !Array.isArray(j.users) || !j.users.some(function (u) { return u.perfil === 'master'; })) return { ok: false, msg: 'Pacote de acesso inválido.' };
      saveUsers(j.users); log('Pacote de acesso importado (' + j.users.length + ' usuários)'); return { ok: true, n: j.users.length };
    },
    SESSION_KEY: KS
  };
  var PORTAL = 'Portal CGA.dc.html', isPortal = /Portal(%20| )CGA|\/index\.html$|\/$/i.test(decodeURIComponent(location.pathname));
  function toPortal() { if (isPortal) return; try { sessionStorage.setItem('cga.next', location.pathname.split('/').pop() + location.hash); } catch (e) { } location.replace(PORTAL); }
  api.toPortal = toPortal; api.isPortal = isPortal;
  var KAN = 'cga.analise.v1';
  api.analise = {
    get: function (app, key) { var a = get(KAN, {})[app + '|' + key]; return a && a.exp > Date.now() ? a : null; },
    toggle: function (app, key, take) { var c = current(); if (!c) return null; var m = get(KAN, {}), id = app + '|' + key, o = m[id]; if (o && o.exp > Date.now() && o.login === c.login && !take) delete m[id]; else m[id] = { login: c.login, name: c.name, at: Date.now(), exp: Date.now() + 8 * 3600e3 }; set(KAN, m); log((m[id] ? 'Item em análise: ' : 'Análise liberada: ') + app + ' #' + key); return m[id] || null; }
  };
  var XL = { judiciais: 'Veículos Judiciais', senad: 'Bens SENAD' }, nPl = function (s) { return String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, ''); }, nPr = function (s) { return String(s || '').replace(/\D/g, ''); };
  api.xref = {
    publish: function (app, items) { if (!XL[app]) return; try { localStorage.setItem('cga.xref.' + app, JSON.stringify(items.map(function (i) { return { k: i.k, p: nPl(i.p), pr: (i.pr || []).map(nPr).filter(function (x) { return x.length >= 15; }) }; }))); } catch (e) { } },
    find: function (app, placa, procs) {
      var p = nPl(placa), prs = (procs || []).map(nPr).filter(function (x) { return x.length >= 15; }), out = [];
      Object.keys(XL).forEach(function (o) { if (o === app || !canApp(o)) return; var l = get('cga.xref.' + o, []); l.forEach(function (i) { var by = p.length >= 6 && p !== 'SEMPLACA' && i.p === p ? 'placa' : prs.some(function (x) { return i.pr.indexOf(x) >= 0; }) ? 'processo' : ''; if (by) out.push({ app: o, label: XL[o], key: i.k, by: by }); }); });
      return out;
    }
  };
  var KT = 'cga.ui.theme';
  function applyTheme(t) { try { document.documentElement.setAttribute('data-cga-theme', t === 'escuro' ? 'escuro' : 'claro'); } catch (e) { } }
  api.theme = function () { try { return localStorage.getItem(KT) === 'escuro' ? 'escuro' : 'claro'; } catch (e) { return 'claro'; } };
  api.setTheme = function (t) { try { localStorage.setItem(KT, t); } catch (e) { } applyTheme(t); };
  applyTheme(api.theme());
  window.addEventListener('storage', function (e) { if (e.key === KT) applyTheme(api.theme()); });

  /* ---------- Versão, continuidade e sincronização ---------- */
  var VERSION = '2026.10.08', KV = 'cga.sys.version', KUPD = 'cga.sys.update', KSY = 'cga.sys.sync', KSNAP = 'cga.sys.snapshot';
  var NOTES = {
    '2026.10.08': ['A pasta do sistema fica memorizada no navegador: nas próximas aberturas basta um clique para reautorizar, sem escolher a pasta de novo', 'Quem cancelar a escolha da pasta recebe um aviso com botão para refazer e é lembrado na abertura seguinte'],
    '2026.10.07': ['Sincronização em tempo real entre todos os computadores ligados à pasta do sistema: o que qualquer usuário cria, edita ou atualiza chega aos demais em segundos', 'Quem está analisando um item aparece em tempo real em todos os computadores', 'Indicações entre usuários circulam entre computadores'],
    '2026.10.06': ['Controle CGA, despachos, SUITE/SEI, cadastros e indicações passam a ser publicados pelo gestor master junto com as bases', 'A publicação agora soma ao trabalho local dos usuários, sem apagar o que eles registraram', 'Chave da planilha Google e seleções pessoais nunca são publicadas'],
    '2026.10.05': ['Pesquisa do Portal em tempo real, a cada letra digitada', 'Aviso com o nome de quem está analisando o item e indicação de itens entre usuários, com quem ativa e quem desativa', 'Busca das listas em todas as colunas da planilha'],
    '2026.10.04': ['Gestor master define o tempo de inatividade da sessão (15 min, 30 min ou 1 h)', 'Bate-papo com avisos gerais, avisos a usuários apontados e mensagens internas, liberado pelo gestor master', 'Assistente Claude para criar ambientes e cenários de trabalho'],
    '2026.10.03': ['Nova aplicação: Controle de Ativos Passíveis de Reversão (imóveis, veículos e contas bancárias do PGA), com painel, cruzamentos, evolução, auditoria e relatórios', 'Gestor master com acesso e fonte de dados da nova aplicação'],
    '2026.10.02': ['A autorização da pasta só é pedida quando há algo novo para publicar, e não a cada abertura do sistema', 'Avisos do sistema com botão de fechar e fechamento automático'],
    '2026.10.01': ['Senha trocada pelo usuário não é mais desfeita pelas publicações do gestor master', 'Bases guardadas no banco de dados do navegador, sem o limite de 5 MB, no computador do gestor master e dos usuários', 'Ao abrir o sistema, o gestor master confere e refaz a publicação sozinho, inclusive depois de trocar os arquivos da versão', 'Usuários não recebem mais pedidos de permissão de pasta; os dados chegam e a tela se atualiza sem recarregar', 'Mensagem clara quando a base ainda não chegou ao computador do usuário'],
    '2026.09.30': ['Publicação automática: tudo que o gestor master altera (bases, usuários, valores e configurações) é publicado sozinho na pasta do sistema', 'Conexão da pasta feita no próprio acesso do gestor master, uma única vez', 'Acesso dos usuários direto pela pasta compartilhada: o Portal busca os acessos do gestor master antes de pedir login, sem baixar pacote', 'Publicação automática dos dados na pasta e atalho de acesso para os usuários', 'Verificação periódica de dados novos (a cada 2 minutos)'],
    '2026.09.29': ['Dados publicados pelo gestor master (cga-dados.js) chegam sozinhos a todos os usuários ao abrir o sistema pela pasta compartilhada ou pelo GitHub', 'Download em DOCX e XLSX de relatórios, despachos e ofícios', 'Acesso do usuário como tela inicial e módulo de acesso do gestor master'],
    '2026.09.28': ['Nova aplicação: Gestão de Veículos de Uso Institucional (Planilha Oficial PCCE)', 'Gestor master com acesso e fonte de dados da nova aplicação'],
    '2026.09.27': ['Alertas de placa duplicada e de processo judicial/cautelar com mais de um veículo', 'Relatórios: exibir ou unificar placas duplicadas', 'Continuidade entre versões: acessos, bases e trabalhos mantidos; pasta de sincronização compartilhada']
  };
  var MIGRATIONS = [{ to: '2026.10.06', run: function () { var s = sinfo().secs; if (s && !s.trabalho) { s.trabalho = true; sset({ secs: s, lastPushSig: '' }); } } }]; /* { to: 'AAAA.MM.DD', run: function () { ... } } — executadas uma única vez, em ordem */
  function classify(k) {
    if (k.indexOf('cga.') !== 0 || k.indexOf('cga.xref.') === 0 || k === KS || k.indexOf('cga.sys.') === 0 || k.indexOf('cga.ui.') === 0) return null;
    if (/\.(picked|report|gsheets)\./.test(k)) return null;
    if (k === KU) return 'acessos'; if (k === KL) return 'auditoria';
    if (/\.dataset\.|\.diff\./.test(k)) return 'bases';
    if (k.indexOf('cga.custodia.') === 0 || k.indexOf(KSUM) === 0 || k === 'cga.cfg.v1' || k === 'cga.chat.msgs.v1' || k === 'cga.chat.scen.v1') return 'config';
    return 'trabalho';
  }
  function stamp(x) { return Math.max(x && x.doneAt || 0, x && x.actAt || 0, x && x.updatedAt || 0, x && x.at || 0, x && x.createdAt || 0); }
  function mergeVal(inc, loc) {
    if (loc == null) return inc; if (inc == null) return loc;
    if (Array.isArray(inc) && Array.isArray(loc)) {
      var ks = function (x) { return x && typeof x === 'object' && x.id != null ? 'id:' + x.id : JSON.stringify(x); }, map = {}, out = [];
      inc.forEach(function (x) { map[ks(x)] = x; out.push(ks(x)); });
      loc.forEach(function (x) { var k = ks(x); if (!(k in map)) { map[k] = x; out.push(k); } else if (x && typeof x === 'object' && x.id != null && stamp(x) > stamp(map[k])) map[k] = x; });
      return out.map(function (k) { return map[k]; });
    }
    if (inc && loc && typeof inc === 'object' && typeof loc === 'object' && !Array.isArray(inc) && !Array.isArray(loc)) {
      var o = {}; Object.keys(loc).forEach(function (k) { o[k] = loc[k]; }); Object.keys(inc).forEach(function (k) { o[k] = k in loc ? mergeVal(inc[k], loc[k]) : inc[k]; }); return o;
    }
    return inc;
  }
  function allKeys() { var o = []; try { for (var i = 0; i < localStorage.length; i++) o.push(localStorage.key(i)); } catch (e) { } Object.keys(MEM).forEach(function (k) { if (o.indexOf(k) < 0) o.push(k); }); return o; }
  function mergeUsers(imp, loc) {
    return imp.map(function (u) {
      var l = (loc || []).find(function (x) { return x.login === u.login; });
      if (!l || !l.hash || l.hash === u.hash) return u;
      var localNewer = (l.pwAt || 0) > (u.pwAt || 0) || (!l.pwAt && !u.pwAt && u.mustChange && !l.mustChange);
      return localNewer ? Object.assign({}, u, { hash: l.hash, salt: l.salt, mustChange: !!l.mustChange, pwAt: l.pwAt || Date.now() }) : u;
    });
  }
  function keysOf(secs) { return allKeys().filter(function (k) { var c = classify(k); return c && secs[c]; }).sort(); }
  function sig(keys) { var a = 0x811c9dc5; keys.forEach(function (k) { var v = k + '=' + (localStorage.getItem(k) || ''); for (var i = 0; i < v.length; i++) a = Math.imul(a ^ v.charCodeAt(i), 16777619) >>> 0; }); return keys.length + '-' + a.toString(36); }
  var SECS = { acessos: 'Usuários e perfis', bases: 'Bases carregadas (planilhas)', config: 'Configurações (taxa de custódia e resumos)', trabalho: 'Controle CGA, despachos, relatórios e cadastros', auditoria: 'Registro de auditoria' };
  api.VERSION = VERSION; api.NOTES = NOTES; api.SECS = SECS;
  api.stateSections = function () { var o = {}; Object.keys(SECS).forEach(function (s) { o[s] = { n: 0, bytes: 0 }; }); allKeys().forEach(function (k) { var c = classify(k); if (c) { o[c].n++; o[c].bytes += (localStorage.getItem(k) || '').length; } }); return o; };
  api.exportState = function (secs) { var ks = keysOf(secs), ch = {}; ks.forEach(function (k) { ch[k] = localStorage.getItem(k); }); return JSON.stringify({ tipo: 'cga-estado', versao: VERSION, geradoEm: new Date().toISOString(), por: (current() || {}).name || '', secoes: Object.keys(secs).filter(function (s) { return secs[s]; }), sig: sig(ks), chaves: ch }); };
  api.importState = function (txt, secs) {
    var j; try { j = JSON.parse(txt); } catch (e) { return { ok: false, msg: 'Arquivo inválido.' }; }
    if (j && j.tipo === 'cga-acesso') return api.importPack(txt);
    if (!j || j.tipo !== 'cga-estado' || !j.chaves) return { ok: false, msg: 'Não é um pacote do sistema CGA.' };
    var n = 0, fail = [];
    Object.keys(j.chaves).forEach(function (k) {
      var c = classify(k), v = j.chaves[k]; if (!c || (secs && !secs[c]) || v == null) return;
      if (c === 'acessos') { try { var us = JSON.parse(v); if (!Array.isArray(us) || !us.some(function (u) { return u.perfil === 'master'; })) return; v = JSON.stringify(mergeUsers(us, users())); } catch (e) { return; } }
      if (k === 'cga.chat.msgs.v1' || k === 'cga.chat.scen.v1') { try { var inc = JSON.parse(v), cur = get(k, []), seen = {}; v = JSON.stringify(inc.concat(cur).filter(function (m) { if (!m || seen[m.id]) return false; seen[m.id] = 1; return true; }).sort(function (x, y) { return (y.at || 0) - (x.at || 0); }).slice(0, 500)); } catch (e) { } }
      if (c === 'trabalho') { try { var lv = localStorage.getItem(k); if (lv) v = JSON.stringify(mergeVal(JSON.parse(v), JSON.parse(lv))); } catch (e) { } }
      try { localStorage.setItem(k, v); n++; } catch (e) { fail.push(k); }
    });
    if (fail.length && !n) return { ok: false, msg: 'Espaço de armazenamento do navegador insuficiente.', fail: fail };
    log('Pacote do sistema importado (' + n + ' itens, versão ' + (j.versao || '—') + ', gerado em ' + (j.geradoEm || '—').slice(0, 16).replace('T', ' ') + ')');
    return { ok: true, n: n, fail: fail, versao: j.versao, geradoEm: j.geradoEm };
  };
  (function upgrade() {
    var prev = null; try { prev = localStorage.getItem(KV); } catch (e) { }
    if (prev === VERSION) return;
    try { var small = {}, tot = 0; allKeys().forEach(function (k) { var c = classify(k); if (c && c !== 'bases' && c !== 'auditoria') { var v = localStorage.getItem(k) || ''; tot += v.length; small[k] = v; } }); if (tot < 400000) localStorage.setItem(KSNAP, JSON.stringify({ versao: prev, at: Date.now(), chaves: small })); } catch (e) { }
    MIGRATIONS.filter(function (m) { return !prev || m.to > prev; }).sort(function (a, b) { return a.to < b.to ? -1 : 1; }).forEach(function (m) { try { m.run(); } catch (e) { } });
    try { localStorage.setItem(KV, VERSION); } catch (e) { }
    if (prev) { set(KUPD, { from: prev, to: VERSION, at: Date.now() }); log('Sistema atualizado da versão ' + prev + ' para ' + VERSION + ' (dados mantidos)', 'sistema'); }
  })();
  api.updateInfo = function () { return get(KUPD, null); };
  api.ackUpdate = function () { try { localStorage.removeItem(KUPD); } catch (e) { } };
  api.restoreSnapshot = function () { var s = get(KSNAP, null); if (!s) return { ok: false, msg: 'Nenhuma cópia automática disponível.' }; Object.keys(s.chaves).forEach(function (k) { try { localStorage.setItem(k, s.chaves[k]); } catch (e) { } }); log('Cópia automática anterior à atualização restaurada'); return { ok: true, at: s.at, versao: s.versao }; };
  api.snapshotInfo = function () { var s = get(KSNAP, null); return s ? { at: s.at, versao: s.versao, n: Object.keys(s.chaves).length } : null; };

  function idb() { return new Promise(function (res, rej) { var r = indexedDB.open('cga-sync', 1); r.onupgradeneeded = function () { r.result.createObjectStore('h'); }; r.onsuccess = function () { res(r.result); }; r.onerror = function () { rej(r.error); }; }); }
  function idbGet(k) { return idb().then(function (db) { return new Promise(function (res) { var q = db.transaction('h').objectStore('h').get(k); q.onsuccess = function () { res(q.result || null); }; q.onerror = function () { res(null); }; }); }).catch(function () { return null; }); }
  function idbSet(k, v) { return idb().then(function (db) { return new Promise(function (res) { var t = db.transaction('h', 'readwrite'); t.objectStore('h').put(v, k); t.oncomplete = function () { res(true); }; t.onerror = function () { res(false); }; }); }); }
  /* Bases grandes (planilhas) ficam no banco do navegador (IndexedDB), sem o limite de 5 MB do localStorage */
  var BIG = /^cga\.[^.]+\.dataset\./, _sget = Storage.prototype.getItem, _sset = Storage.prototype.setItem, _srm = Storage.prototype.removeItem;
  function isBig(st, k) { return _memDb && st === window.localStorage && typeof k === 'string' && BIG.test(k); }
  function idbDel(k) { return idb().then(function (db) { return new Promise(function (res) { var t = db.transaction('h', 'readwrite'); t.objectStore('h').delete(k); t.oncomplete = function () { res(true); }; t.onerror = function () { res(false); }; }); }).catch(function () { return false; }); }
  function track(p) { _pend.push(p); p.then(function () { var i = _pend.indexOf(p); if (i >= 0) _pend.splice(i, 1); }); return p; }
  function basesEvt() { try { window.dispatchEvent(new CustomEvent('cga-bases')); } catch (e) { } }
  Storage.prototype.getItem = function (k) { if (isBig(this, k) && Object.prototype.hasOwnProperty.call(MEM, k)) return MEM[k]; return _sget.call(this, k); };
  Storage.prototype.setItem = function (k, v) {
    if (!isBig(this, k)) return _sset.call(this, k, v);
    var s = String(v), st = this; MEM[k] = s;
    track(idbSet('ls:' + k, s).catch(function () { return false; }).then(function (ok) {
      if (ok) { try { _srm.call(st, k); } catch (e) { } return; }
      try { _sset.call(st, k, s); } catch (e) { try { var o = JSON.parse(_sget.call(st, KSY) || '{}'); o.dadosErr = 'Não foi possível guardar a base neste computador (armazenamento do navegador cheio).'; _sset.call(st, KSY, JSON.stringify(o)); } catch (e2) { } }
    }));
  };
  Storage.prototype.removeItem = function (k) { if (isBig(this, k)) { delete MEM[k]; track(idbDel('ls:' + k)); } return _srm.call(this, k); };
  api.basesReady = (!_memDb ? Promise.resolve({}) : idb().then(function (db) { return new Promise(function (res) { var out = {}; try { var rq = db.transaction('h').objectStore('h').openCursor(); rq.onsuccess = function () { var c = rq.result; if (!c) return res(out); if (typeof c.key === 'string' && c.key.indexOf('ls:') === 0) out[c.key.slice(3)] = c.value; c.continue(); }; rq.onerror = function () { res(out); }; } catch (e) { res(out); } }); }))
    .then(function (out) {
      Object.keys(out).forEach(function (k) { if (!Object.prototype.hasOwnProperty.call(MEM, k) && typeof out[k] === 'string') MEM[k] = out[k]; });
      var legacy = []; try { for (var i = 0; i < localStorage.length; i++) { var k = localStorage.key(i); if (BIG.test(k)) legacy.push(k); } } catch (e) { }
      return Promise.all(legacy.map(function (k) { var v = _sget.call(localStorage, k); if (v == null) return null; MEM[k] = v; return idbSet('ls:' + k, v).catch(function () { return false; }).then(function (ok) { if (ok) { try { _srm.call(localStorage, k); } catch (e) { } } }); }));
    })
    .catch(function () { _memDb = false; })
    .then(function () { _memReady = true; basesEvt(); return true; });
  api.basesLoaded = function () { return _memReady; };
  api.flush = function () { return Promise.all(_pend.slice()); };
  var SYNC_FILE = 'cga-estado.json', DADOS_FILE = 'cga-dados.js';
  api.dadosScript = function (txt) { txt = txt || api.exportState(sync.publishSecs()); return '/* CGA/DRA · dados publicados pelo gestor master. Não edite. */\nwindow.CGA_DADOS = ' + txt.replace(/<\/script/gi, '<\\/script') + ';\n'; };
  api.markPublished = function (txt) { try { var j = JSON.parse(txt); sset({ dadosAt: j.geradoEm, lastPushSig: j.sig, lastPullSig: j.sig, lastPushAt: Date.now(), lastPushBy: (current() || {}).name || '' }); } catch (e) { } };
  function sinfo() { return get(KSY, {}); }
  function sset(p) { var o = sinfo(); Object.keys(p).forEach(function (k) { o[k] = p[k]; }); set(KSY, o); return o; }
  function dir(interactive) {
    return idbGet('dir').then(function (h) {
      if (!h || !h.queryPermission) return null;
      return h.queryPermission({ mode: 'readwrite' }).then(function (p) { if (p === 'granted') return h; return interactive ? h.requestPermission({ mode: 'readwrite' }).then(function (p2) { return p2 === 'granted' ? h : null; }) : null; });
    }).catch(function () { return null; });
  }
  var sync = api.sync = {
    supported: !!window.showDirectoryPicker,
    FILE: SYNC_FILE,
    info: sinfo,
    setPublish: function (secs) { sset({ secs: secs }); },
    publishSecs: function () { return sinfo().secs || { acessos: true, bases: true, config: true, trabalho: true }; },
    status: function () { return idbGet('dir').then(function (h) { if (!h) return { linked: false }; return h.queryPermission({ mode: 'readwrite' }).then(function (p) { return { linked: true, granted: p === 'granted', name: h.name }; }); }).catch(function () { return { linked: false }; }); },
    link: function () {
      if (!sync.supported) return Promise.resolve({ ok: false, msg: 'Este navegador não permite vincular pastas. Use Google Chrome ou Microsoft Edge.' });
      return window.showDirectoryPicker({ id: 'cga-sync', mode: 'readwrite' }).then(function (h) { _h = h; _perm = 'granted'; return idbSet('dir', h).then(function () { sset({ folder: h.name, linkedAt: Date.now() }); log('Pasta de sincronização vinculada: ' + h.name); return { ok: true, name: h.name }; }); })
        .catch(function (e) { return { ok: false, msg: e && e.name === 'AbortError' ? '' : 'Não foi possível vincular a pasta.' }; });
    },
    unlink: function () { _h = null; _perm = ''; return idbSet('dir', null).then(function () { sset({ folder: '', linkedAt: 0 }); log('Pasta de sincronização desvinculada'); return { ok: true }; }); },
    push: function (interactive, force) {
      if (!can('fonte')) return Promise.resolve({ ok: false, msg: 'Somente o gestor master publica atualizações.' });
      var go = function () {
      var secs = sync.publishSecs(), ks = keysOf(secs), sg = sig(ks);
      if (!force && sinfo().lastPushSig === sg) return Promise.resolve({ ok: true, same: true });
      return dir(interactive).then(function (d) {
        if (!d) return { ok: false, msg: 'Pasta de sincronização não vinculada ou sem permissão.' };
        var txt = api.exportState(secs), gen = JSON.parse(txt).geradoEm;
        var wr = function (name, data) { return d.getFileHandle(name, { create: true }).then(function (fh) { return fh.createWritable(); }).then(function (w) { return w.write(data).then(function () { return w.close(); }); }); };
        return wr(DADOS_FILE, api.dadosScript(txt))
          .then(function () { sset({ lastPushAt: Date.now(), lastPushSig: sg, lastPushBy: (current() || {}).name || '', dadosAt: gen, lastPullSig: sg, pushErr: '' }); try { window.CGA_DADOS = JSON.parse(txt); } catch (e) { } log('Atualização publicada na pasta ' + d.name + ' (' + ks.length + ' itens)'); return { ok: true, n: ks.length }; });
      }).catch(function () { sset({ pushErr: 'Falha ao gravar na pasta do sistema.', pushErrAt: Date.now() }); return { ok: false, msg: 'Falha ao gravar na pasta de sincronização.' }; });
      };
      return _memReady ? go() : api.basesReady.then(go);
    },
    pull: function (interactive, force) {
      return dir(interactive).then(function (d) {
        if (!d) return { ok: false, msg: 'Pasta de sincronização não vinculada ou sem permissão.', needsPermission: true };
        var rd = function (name) { return d.getFileHandle(name).then(function (fh) { return fh.getFile(); }).then(function (f) { return f.text(); }); };
        return rd(DADOS_FILE).then(function (t) { var m = t.indexOf('window.CGA_DADOS = '); return m >= 0 ? t.slice(m + 19).replace(/;\s*$/, '') : t; }, function () { return rd(SYNC_FILE); }).then(function (t) {
          var j; try { j = JSON.parse(t); } catch (e) { return { ok: false, msg: 'Arquivo de dados inválido.' }; }
          if (!j || !j.chaves) return { ok: false, msg: 'Nenhuma publicação na pasta ainda.' };
          sset({ remoteAt: j.geradoEm, remoteBy: j.por, remoteVersao: j.versao, checkedAt: Date.now() });
          if (!force && (sinfo().lastPullSig === j.sig || sinfo().lastPushSig === j.sig)) return { ok: true, same: true, remoteVersao: j.versao };
          var secs = {}; (j.secoes || []).forEach(function (s) { if (s !== 'auditoria') secs[s] = true; });
          var r = api.importState(t, secs); if (r.ok) sset({ lastPullAt: Date.now(), lastPullSig: j.sig, lastPullRemoteAt: j.geradoEm }); r.remoteVersao = j.versao; r.changed = r.ok; return r;
        });
      }).catch(function () { return { ok: false, msg: 'Nenhuma atualização publicada na pasta ainda (' + SYNC_FILE + ').' }; });
    },
    DADOS: DADOS_FILE,
    dadosInfo: function () { var i = sinfo(); return { at: i.dadosAt || '', appliedAt: i.dadosAppliedAt || 0, by: i.dadosBy || '', found: !!window.CGA_DADOS }; },
    newerSystem: function () { var v = sinfo().remoteVersao; return v && v > VERSION ? v : ''; }
  };
  function applyDados(D, silent) {
    if (!D || D.tipo !== 'cga-estado' || !D.chaves) return false;
    var inf = sinfo(); sset({ remoteAt: D.geradoEm, remoteBy: D.por, remoteVersao: D.versao });
    if ((inf.dadosAt && inf.dadosAt >= D.geradoEm) || inf.lastPushSig === D.sig || inf.lastPullSig === D.sig) return false;
    var secs = {}; (D.secoes || []).forEach(function (x) { if (x !== 'auditoria') secs[x] = true; });
    var r = api.importState(JSON.stringify(D), secs), nf = (r.fail || []).length;
    sset({ dadosAt: D.geradoEm, dadosBy: D.por || '', dadosAppliedAt: Date.now(), lastPullSig: D.sig, lastPullAt: Date.now(), lastPullRemoteAt: D.geradoEm, dadosErr: !r.ok ? (r.msg || 'Falha ao aplicar os dados publicados.') : nf ? 'Parte dos dados publicados não coube no armazenamento deste navegador (' + nf + ' item(ns)).' : '' });
    if (r.ok) log('Dados publicados pelo gestor master recebidos automaticamente (' + r.n + ' itens, de ' + String(D.geradoEm).slice(0, 16).replace('T', ' ') + ')', 'sistema');
    return !!r.ok;
  }
  function fetchDados(bust) {
    return new Promise(function (res) {
      try {
        var old = document.getElementById('cga-dados-js'); if (old) old.remove();
        var s = document.createElement('script'); s.id = 'cga-dados-js'; s.async = true;
        s.src = DADOS_FILE + (bust ? '?v=' + Date.now() : '');
        s.onload = function () { res({ found: !!window.CGA_DADOS, D: window.CGA_DADOS }); };
        s.onerror = function () { if (bust) fetchDados(false).then(res); else res({ found: false }); };
        (document.head || document.documentElement).appendChild(s);
      } catch (e) { res({ found: false }); }
    });
  }
  if (!isPortal) { var guardGo = function () { api.basesReady.then(function () { return api.dadosReady; }).then(function () { if (!current()) toPortal(); }, function () { if (!current()) toPortal(); }); }; if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', guardGo); else guardGo(); }
  function goNext() { if (!isPortal) return; var n = ''; try { n = sessionStorage.getItem('cga.next') || ''; } catch (e) { } var c = current(); if (!n || !c || c.mustChange) return; var f = n.split('#')[0]; var ok = Object.keys(APPS).some(function (k) { return APPS[k].file === f && canApp(k); }); try { sessionStorage.removeItem('cga.next'); } catch (e) { } if (ok) location.replace(n); }
  api.goNext = goNext;
  if (isPortal) { api.basesReady.then(function () { return api.dadosReady; }).then(goNext, goNext); var _lg = api.login; api.login = function () { return _lg.apply(api, arguments).then(function (r) { if (r && r.ok) setTimeout(goNext, 400); return r; }); }; }
  api.dadosReady = api.basesReady.then(function () { return fetchDados(false); }).then(function (r) {
    if (r.found && applyDados(r.D)) return api.flush().then(function () {
      var g = 'cga.dados.reload'; try { if (sessionStorage.getItem(g) !== String(r.D.sig)) { sessionStorage.setItem(g, String(r.D.sig)); location.reload(); return new Promise(function () { }); } } catch (e) { }
      _dadosDone = true; basesEvt(); syncEvt(); return { found: true, publicado: r.D.geradoEm, applied: true };
    });
    _dadosDone = true; return { found: r.found, publicado: r.D ? r.D.geradoEm : '' };
  });
  api.dadosChecked = function () { return _dadosDone; };
  api.refreshDados = function () { return fetchDados(true).then(function (r) { var ch = r.found && applyDados(r.D); return { found: r.found, changed: ch }; }); };
  api.shareInfo = function () {
    var dirHref = location.href.split('#')[0].split('?')[0].replace(/[^\/]*$/, ''), isFile = location.protocol === 'file:', path = '';
    if (isFile) { path = decodeURIComponent(dirHref.replace(/^file:/, '')); path = /^\/+[A-Za-z]:/.test(path) ? path.replace(/^\/+/, '') : '//' + path.replace(/^\/+/, ''); path = path.replace(/\//g, '\\'); }
    return { portal: dirHref + 'Portal%20CGA.dc.html', dir: dirHref, isFile: isFile, isNet: isFile ? /^\\\\/.test(path) : /^https?:$/.test(location.protocol), path: path };
  };
  setInterval(function () {
    if (document.hidden || can('fonte')) return;
    api.refreshDados().then(function (r) { if (!r.changed) return; api.flush().then(function () { basesEvt(); syncEvt(); if (current()) toast('O gestor master publicou dados novos. As informações desta tela já foram atualizadas.', [{ label: 'OK' }]); }); });
  }, 30000);
  var _h = null, _perm = '', _cp = null, _asked = false;
  function syncEvt() { try { window.dispatchEvent(new CustomEvent('cga-sync')); } catch (e) { } }
  function isMasterLogin(l) { var u = find(l); return !!(u && u.perfil === 'master' && u.active !== false); }
  function connect() {
    if (!sync.supported) return Promise.resolve({ ok: false, unsupported: true });
    if (_h) return (_perm === 'granted' ? Promise.resolve('granted') : _h.requestPermission({ mode: 'readwrite' })).then(function (p) { _perm = p; syncEvt(); return { ok: p === 'granted', name: _h.name }; }).catch(function () { return { ok: false }; });
    return window.showDirectoryPicker({ id: 'cga-sync', mode: 'readwrite' }).then(function (h) {
      _h = h; _perm = 'granted';
      return idbSet('dir', h).then(function () {
        sset({ folder: h.name, linkedAt: Date.now() }); log('Pasta do sistema conectada para publicação automática: ' + h.name); syncEvt();
        return h.getFileHandle('Portal CGA.dc.html').then(function () { return { ok: true, name: h.name }; }, function () { return { ok: true, name: h.name, warn: 'A pasta “' + h.name + '” não contém o arquivo Portal CGA.dc.html. Confirme se é a pasta compartilhada do sistema; se não for, use “Reconectar” em Atualizações.' }; });
      });
    }).catch(function (e) { var ab = !!(e && e.name === 'AbortError'); if (ab) setTimeout(function () { toast('A pasta do sistema não foi escolhida. Sem ela, o que você registrar não chega aos outros computadores e você não recebe as atualizações deles. Escolha a pasta compartilhada do sistema, a mesma onde está este Portal. O sistema volta a pedir na próxima abertura.', [{ label: 'Depois' }, { label: 'Escolher a pasta agora', run: function () { connect().then(function (c) { if (c && c.ok) { if (c.warn) toast(c.warn, [{ label: 'OK' }]); if (can('fonte')) publishNow(c); liveKick(); } }); } }]); }, 300); return { ok: false, cancelled: ab }; });
  }
  function publishNow(c) {
    if (c && c.warn) toast(c.warn);
    return sync.push(false, true).then(function (r) { syncEvt(); if (r.ok) { try { if (!localStorage.getItem('cga.ui.pubToast')) { localStorage.setItem('cga.ui.pubToast', '1'); toast('Publicação automática ativa: bases, acessos e configurações ficam disponíveis para todos os usuários da pasta.', [{ label: 'OK' }]); } } catch (e) { } } return r; });
  }
  sync.connectNow = connect;
  sync.connectFor = function (login) { var mst = isMasterLogin(login); _cp = (mst ? !(_h && _perm !== 'granted' && !sync.dirty()) : (sync.supported && !(_h && _perm === 'granted'))) ? connect() : null; return _cp || Promise.resolve({ ok: false, skip: true }); };
  sync.ready = function () { return !!(_h && _perm === 'granted'); };
  sync.dirty = function () { try { return sig(keysOf(sync.publishSecs())) !== sinfo().lastPushSig; } catch (e) { return false; } };
  sync.publishNow = publishNow;
  ['login', 'createMaster'].forEach(function (fn) {
    var orig = api[fn]; if (!orig) return;
    api[fn] = function () {
      if (fn === 'createMaster' && !_cp) _cp = connect();
      return orig.apply(api, arguments).then(function (r) {
        if (r && r.ok && can('fonte')) { var cp = _cp; _cp = null; (cp || Promise.resolve({ ok: _perm === 'granted' })).then(function (c) { if (c && c.ok) { publishNow(c); liveKick(); } }); }
        else if (r && r.ok) { var cq = _cp; _cp = null; (cq || Promise.resolve({ ok: _perm === 'granted' })).then(function (c) { if (c && c.ok) { liveKick(); } }); }
        return r;
      });
    };
  });
  try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) { }
  idbGet('dir').then(function (h) { _h = h && h.queryPermission ? h : null; if (!_h) return; return _h.queryPermission({ mode: 'readwrite' }).then(function (p) { _perm = p; if (p === 'granted' && can('fonte')) autoPush(); syncEvt(); if (p === 'granted') liveKick(); }); }).catch(function () { });
  var _pickAsked = false;
  function firstGesture() {
    if (!current() || _asked) return;
    if (_h && _perm !== 'granted') {
      _asked = true;
      _h.requestPermission({ mode: 'readwrite' }).then(function (p) { _perm = p; if (p === 'granted') { if (can('fonte') && sync.dirty()) publishNow(); liveKick(); } else { syncEvt(); toast('O navegador não liberou a pasta do sistema. Sem ela a sincronização fica parada. Clique em “Permitir” e marque “Permitir em todas as visitas”.', [{ label: 'Depois' }, { label: 'Tentar de novo', run: function () { _asked = false; firstGesture(); } }]); } }).catch(function () { });
    } else if (!_h && sync.supported && !_pickAsked) {
      _pickAsked = true; _asked = true;
      connect().then(function (c) { if (c && c.ok) { if (c.warn) toast(c.warn, [{ label: 'OK' }]); if (can('fonte')) publishNow(c); liveKick(); } else _asked = false; });
    }
  }
  ['click', 'keydown'].forEach(function (ev) { document.addEventListener(ev, firstGesture, true); });
  var _pt = null; function autoPush() { if (!can('fonte')) return; clearTimeout(_pt); _pt = setTimeout(function () { sync.push(false).then(function (r) { if (r && r.ok && !r.same) syncEvt(); if (r && !r.ok && _h && _perm !== 'granted') { _asked = false; syncEvt(); } }); }, 2500); }
  try {
    var _lsSet = Storage.prototype.setItem, SKIP = [KS, KL, KSY, KV, KUPD, KSNAP];
    Storage.prototype.setItem = function (k, v) { _lsSet.call(this, k, v); try { if (this === window.localStorage && /^cga\./.test(k) && SKIP.indexOf(k) < 0 && !/^cga\.(ui|xref|sys)\./.test(k)) { autoPush(); liveDirty(); } } catch (e) { } };
  } catch (e) { }
  var _ps = api.publishSummary; api.publishSummary = function (a, s) { _ps(a, s); autoPush(); };
  var _su = saveUsers; saveUsers = function (u) { _su(u); autoPush(); };

  /* ---------- Configurações do gestor master e bate-papo ---------- */
  var KCFG = 'cga.cfg.v1', KMSG = 'cga.chat.msgs.v1', KSCN = 'cga.chat.scen.v1', KRD = 'cga.ui.chatread.v1';
  function cfg() { var c = get(KCFG, {}), ch = c.chat || {}; return { idleMin: [15, 30, 60].indexOf(c.idleMin) >= 0 ? c.idleMin : 30, chat: { enabled: !!ch.enabled, claude: !!ch.claude, users: ch.users || {} } }; }
  function saveCfg(fn) { if (!can('users')) return false; var c = get(KCFG, {}); c.chat = c.chat || {}; fn(c); set(KCFG, c); return true; }
  api.cfg = cfg; api.idleMin = function () { return cfg().idleMin; };
  api.setIdle = function (m) { if ([15, 30, 60].indexOf(m) < 0 || !saveCfg(function (c) { c.idleMin = m; })) return false; log('Tempo de inatividade da sessão definido em ' + (m === 60 ? '1 h' : m + ' min')); return true; };
  api.setChat = function (p) { if (!saveCfg(function (c) { Object.keys(p).forEach(function (k) { c.chat[k] = !!p[k]; }); })) return false; log('Bate-papo: ' + Object.keys(p).map(function (k) { return (k === 'enabled' ? 'habilitação geral' : 'assistente Claude') + ' ' + (p[k] ? 'ligado' : 'desligado'); }).join(', ')); return true; };
  api.setChatUser = function (login, p) { if (!saveCfg(function (c) { c.chat.users = c.chat.users || {}; c.chat.users[login] = Object.assign({}, c.chat.users[login], p); })) return false; log('Bate-papo: habilitações de ' + login + ' alteradas (' + Object.keys(p).map(function (k) { return k + '=' + (p[k] ? 'sim' : 'não'); }).join(', ') + ')'); return true; };
  api.chatCan = function (what) {
    var c = current(); if (!c) return false; if (c.perfil === 'master') return true;
    var f = cfg().chat, u = f.users[c.login] || {}; if (!f.enabled || !u.chat) return false;
    if (what === 'chat') return true; if (what === 'claude') return f.claude && !!u.claude; if (what === 'geral') return !!u.geral; return false;
  };
  function allMsgs() { return get(KMSG, []); }
  function visible(m, c) { if (!m || m.del) return false; if (c.perfil === 'master' || m.from === c.login) return true; if (m.tipo === 'geral') return !m.to.length || m.to.indexOf(c.login) >= 0; return m.to.indexOf(c.login) >= 0; }
  api.msgs = function () { var c = current(); if (!c || !api.chatCan('chat')) return []; return allMsgs().filter(function (m) { return visible(m, c); }).sort(function (x, y) { return y.at - x.at; }); };
  api.unreadIds = function () { var c = current(); if (!c || !api.chatCan('chat')) return []; var rd = (get(KRD, {})[c.login]) || []; return api.msgs().filter(function (m) { return m.from !== c.login && rd.indexOf(m.id) < 0; }).map(function (m) { return m.id; }); };
  api.markRead = function () { var c = current(); if (!c) return; var all = get(KRD, {}), cur = all[c.login] || []; all[c.login] = api.msgs().map(function (m) { return m.id; }).concat(cur).filter(function (v, i, a) { return a.indexOf(v) === i; }).slice(0, 600); try { localStorage.setItem(KRD, JSON.stringify(all)); } catch (e) { } };
  api.sendMsg = function (o) {
    var c = current(); if (!c || !api.chatCan('chat')) return { ok: false, msg: 'Você não tem o bate-papo habilitado.' };
    var tipo = o.tipo === 'geral' ? 'geral' : 'interno'; if (tipo === 'geral' && !api.chatCan('geral')) return { ok: false, msg: 'O gestor master não habilitou o aviso geral para você.' };
    var text = String(o.text || '').trim().slice(0, 1500); if (!text) return { ok: false, msg: 'Escreva a mensagem.' };
    var to = (o.to || []).filter(function (l) { return find(l) && l !== c.login; }); if (tipo === 'interno' && !to.length) return { ok: false, msg: 'Escolha ao menos um destinatário.' };
    var l = allMsgs(); l.unshift({ id: rnd(), at: Date.now(), from: c.login, fromName: c.name, tipo: tipo, to: to, text: text, pri: !!o.pri }); set(KMSG, l.slice(0, 500));
    log('Bate-papo: ' + (tipo === 'geral' ? 'aviso geral' : 'mensagem interna') + (to.length ? ' para ' + to.join(', ') : ' para todos')); return { ok: true };
  };
  api.delMsg = function (id) { var c = current(); if (!c) return false; var l = allMsgs(), m = l.filter(function (x) { return x.id === id; })[0]; if (!m || (c.perfil !== 'master' && m.from !== c.login)) return false; m.del = true; m.text = ''; set(KMSG, l); log('Bate-papo: mensagem removida'); return true; };
  api.scens = function () { return get(KSCN, []).filter(function (s) { return !s.del; }).sort(function (x, y) { return y.at - x.at; }); };
  api.saveScen = function (s) { var c = current(); if (!c || !api.chatCan('claude')) return false; var l = get(KSCN, []); l.unshift({ id: rnd(), at: Date.now(), by: c.name, byLogin: c.login, nome: String(s.nome || 'Cenário').slice(0, 80), app: s.app || '', descricao: String(s.descricao || '').slice(0, 600), passos: (s.passos || []).slice(0, 12).map(function (p) { return String(p).slice(0, 200); }), relatorio: s.relatorio || null }); set(KSCN, l.slice(0, 200)); log('Cenário salvo no bate-papo: ' + String(s.nome || '').slice(0, 60)); return true; };
  api.delScen = function (id) { var c = current(); if (!c) return false; var l = get(KSCN, []), s = l.filter(function (x) { return x.id === id; })[0]; if (!s || (c.perfil !== 'master' && s.byLogin !== c.login)) return false; s.del = true; set(KSCN, l); log('Cenário removido do bate-papo'); return true; };

  function toast(text, actions) {
    function show() {
      var el = document.getElementById('cga-toast'); if (el) el.remove();
      el = document.createElement('div'); el.id = 'cga-toast'; el.setAttribute('data-noprint', '1');
      el.style.cssText = 'position:fixed;right:18px;bottom:18px;z-index:9999;max-width:min(440px,calc(100vw - 36px));background:#16191D;color:#FFFFFF;border-radius:8px;padding:14px 16px;box-shadow:0 8px 24px rgba(0,0,0,.25);font:13px/1.5 "Segoe UI","IBM Plex Sans",system-ui,sans-serif;display:flex;flex-direction:column;gap:10px';
      var x = document.createElement('button'); x.textContent = '×'; x.title = 'Fechar'; x.setAttribute('aria-label', 'Fechar'); x.style.cssText = 'position:absolute;top:6px;right:8px;width:24px;height:24px;border:0;background:transparent;color:#AEB6BF;font-size:18px;line-height:1;cursor:pointer'; x.onclick = function () { el.remove(); }; el.appendChild(x); el.style.position = 'fixed'; el.style.paddingRight = '34px';
      var p = document.createElement('div'); p.textContent = text; el.appendChild(p);
      if (!actions || !actions.length) actions = [{ label: 'OK' }];
      clearTimeout(window.__cgaToastT); window.__cgaToastT = setTimeout(function () { var t = document.getElementById('cga-toast'); if (t === el) el.remove(); }, (actions.some(function (b) { return b.run; }) ? 20000 : 8000));
      var row = document.createElement('div'); row.style.cssText = 'display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap';
      (actions || []).forEach(function (a, i) { var b = document.createElement('button'); b.textContent = a.label; b.style.cssText = 'height:30px;padding:0 12px;border-radius:5px;font:600 12px "Segoe UI",system-ui,sans-serif;cursor:pointer;' + (i === (actions.length - 1) ? 'border:0;background:#BFAB5F;color:#16191D' : 'border:1px solid #3A4048;background:transparent;color:#FFFFFF'); b.onclick = function () { if (a.run) a.run(); el.remove(); }; row.appendChild(b); });
      el.appendChild(row); document.body.appendChild(el);
    }
    if (document.body) show(); else document.addEventListener('DOMContentLoaded', show);
  }
  function startup() {
    var up = api.updateInfo();
    if (up && current()) toast('Sistema atualizado para a versão ' + up.to + '. Seus acessos, bases, relatórios e despachos foram mantidos; não é preciso carregar nada de novo.', [{ label: 'OK', run: api.ackUpdate }]);
    if (!can('fonte')) return;
    api.dadosReady.then(function () { return sync.status(); }).then(function (st) {
      if (!st.linked || !st.granted) return;
      return sync.pull(false).then(function (r) {
        var nv = sync.newerSystem();
        if (r.changed) { var k = 'cga.sync.reloaded'; if (sessionStorage.getItem(k) !== String(sinfo().lastPullAt)) { sessionStorage.setItem(k, String(sinfo().lastPullAt)); return api.flush().then(function () { location.reload(); }); } }
        if (nv && current()) toast('Outro gestor master publicou a versão ' + nv + ' do sistema. Feche esta janela e abra o Portal novamente pela pasta compartilhada.', [{ label: 'OK' }]);
        var D = window.CGA_DADOS, cur = sig(keysOf(sync.publishSecs()));
        if (!D || !D.chaves || D.sig !== cur) return sync.push(false, true).then(function (p) { if (p && p.ok) syncEvt(); });
      });
    });
  }
  setTimeout(startup, 400);

  /* ---- presença (quem está trabalhando no item) e indicações entre usuários ---- */
  var KP = 'cga.sys.presence.v1', KA = 'cga.assign.v1', PTTL = 120000, _f = null, _bt = null;
  var SID = (function () { try { var s = sessionStorage.getItem('cga.sid'); if (!s) { s = Math.random().toString(36).slice(2, 9); sessionStorage.setItem('cga.sid', s); } return s; } catch (e) { return 'x' + Math.random().toString(36).slice(2, 6); } })();
  function wEvt() { try { window.dispatchEvent(new CustomEvent('cga-work')); } catch (e) { } }
  function presAll() { var p = get(KP, {}), n = Date.now(), o = {}; Object.keys(p).forEach(function (s) { if (n - p[s].at < PTTL) o[s] = p[s]; }); return o; }
  function presWrite() { var c = current(); if (!c || !_f) return; var p = presAll(); p[SID] = { login: c.login, name: c.name, app: _f.app, key: _f.key, label: _f.label, q: _f.q, at: Date.now() }; set(KP, p); }
  function presDel() { var p = presAll(); delete p[SID]; set(KP, p); }
  function asAll() { return get(KA, []); }
  function canAct(a, kind) { var c = current(); if (!c) return false; if (c.perfil === 'master') return true; return kind === 'ativar' ? a.ativa === c.login : (a.desativa === c.login || a.from === c.login); }
  api.focus = function (app, key, label, q) { if (!current()) return; clearTimeout(_bt); var ch = !_f || _f.app !== app || _f.key !== key; _f = { app: app, key: key, label: label || '', q: q || '' }; if (ch) { presWrite(); wEvt(); } wRender(); };
  api.blur = function () { clearTimeout(_bt); _bt = setTimeout(function () { if (_f) { _f = null; presDel(); wRender(); wEvt(); } }, 600); };
  api.others = function (app, key) { var me = current(), p = presAll(), seen = {}; return Object.keys(p).map(function (s) { return p[s]; }).filter(function (x) { if (!me || x.login === me.login || (app && (x.app !== app || x.key !== key))) return false; var k = x.login + '|' + x.app + '|' + x.key; if (seen[k]) return false; seen[k] = 1; return true; }); };
  api.assignFor = function (app, key) { return asAll().filter(function (a) { return a.app === app && a.key === key && a.status !== 'concluido'; }); };
  api.myAssignments = function () { var c = current(); return !c ? [] : asAll().filter(function (a) { return a.status !== 'concluido' && (a.to === c.login || a.ativa === c.login || a.desativa === c.login); }); };
  api.workPanel = function () { var c = current(), all = asAll().filter(function (a) { return a.status !== 'concluido'; }); return { items: c && c.perfil === 'master' ? all : api.myAssignments(), presence: api.others() }; };
  api.canAct = canAct;
  api.assign = function (o) { var c = current(); if (!c || !o.to) return false; var l = asAll(); l.unshift({ id: 'a' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), app: o.app, key: o.key, label: o.label, q: o.q || '', to: o.to, toName: o.toName, ativa: o.ativa || o.to, desativa: o.desativa || o.to, from: c.login, fromName: c.name, note: o.note || '', at: Date.now(), status: 'indicado' }); set(KA, l.slice(0, 500)); log('Item indicado para ' + o.toName + ': ' + o.label); wRender(); wEvt(); return true; };
  api.activate = function (id) { var c = current(), l = asAll(), a = l.filter(function (x) { return x.id === id; })[0]; if (!a || !canAct(a, 'ativar')) return false; a.status = 'trabalhando'; a.actBy = c.name; a.actAt = Date.now(); set(KA, l); log('Indicação ativada: ' + a.label); wRender(); wEvt(); return true; };
  api.deactivate = function (id) { var c = current(), l = asAll(), a = l.filter(function (x) { return x.id === id; })[0]; if (!a || !canAct(a, 'desativar')) return false; a.status = 'concluido'; a.doneBy = c.name; a.doneAt = Date.now(); set(KA, l); log('Indicação desativada: ' + a.label); wRender(); wEvt(); return true; };
  function el(t, st, tx) { var e = document.createElement(t); if (st) e.style.cssText = st; if (tx != null) e.textContent = tx; return e; }
  function wbtn(label, st, fn) { var b = el('button', 'height:26px;padding:0 10px;border-radius:5px;font-size:12px;font-weight:600;cursor:pointer;' + st, label); b.type = 'button'; b.onclick = fn; return b; }
  var FONT = 'font-family:"IBM Plex Sans","Segoe UI",system-ui,sans-serif;';
  function wRender() {
    var host = document.getElementById('cga-work');
    if (!_f || !current()) { if (host) host.remove(); return; }
    if (!host) { host = el('div', 'position:fixed;right:16px;bottom:16px;z-index:40;max-width:350px;display:flex;flex-direction:column;gap:6px;align-items:flex-end;' + FONT); host.id = 'cga-work'; host.setAttribute('data-noprint', '1'); document.body.appendChild(host); }
    host.innerHTML = '';
    var names = api.others(_f.app, _f.key).map(function (x) { return x.name; });
    if (names.length) { var b = el('div', 'background:#FBF8EC;border:1px solid #E9DFB5;border-left:4px solid #BFAB5F;border-radius:8px;padding:8px 12px;box-shadow:0 4px 14px rgba(0,0,0,.14);font-size:12.5px;color:#4F4418;line-height:1.45'); b.appendChild(el('strong', '', 'Em análise agora: ')); b.appendChild(document.createTextNode(names.join(', '))); host.appendChild(b); }
    api.assignFor(_f.app, _f.key).forEach(function (a) {
      var c = el('div', 'background:#FFFFFF;border:1px solid #D5DAE0;border-left:4px solid ' + (a.status === 'trabalhando' ? '#4AAE35' : '#3FA9C7') + ';border-radius:8px;padding:8px 12px;box-shadow:0 4px 14px rgba(0,0,0,.14);font-size:12.5px;color:#1F2328;line-height:1.45;display:flex;flex-direction:column;gap:4px;width:100%;box-sizing:border-box');
      c.appendChild(el('div', 'font-weight:700', a.status === 'trabalhando' ? 'Em trabalho: ' + (a.actBy || a.toName) : 'Indicado para ' + a.toName));
      c.appendChild(el('div', 'font-size:11.5px;color:#5F6B76', 'por ' + a.fromName + ' · ' + new Date(a.at).toLocaleString('pt-BR')));
      if (a.note) c.appendChild(el('div', 'white-space:pre-wrap', a.note));
      var r = el('div', 'display:flex;gap:6px;flex-wrap:wrap');
      if (a.status === 'indicado' && canAct(a, 'ativar')) r.appendChild(wbtn('Ativar', 'border:0;background:#2F7A1F;color:#FFFFFF', function () { api.activate(a.id); }));
      if (canAct(a, 'desativar')) r.appendChild(wbtn(a.status === 'trabalhando' ? 'Desativar (concluir)' : 'Cancelar indicação', 'border:1px solid #D5DAE0;background:#FFFFFF;color:#B3261E', function () { api.deactivate(a.id); }));
      if (r.childNodes.length) c.appendChild(r); host.appendChild(c);
    });
    host.appendChild(wbtn('Indicar a outro usuário', 'border:1px solid #405A68;background:#FFFFFF;color:#405A68;box-shadow:0 2px 8px rgba(0,0,0,.14)', openAssignDlg));
  }
  function openAssignDlg() {
    var me = current(), f = _f; if (!me || !f) return;
    var us = api.users().filter(function (u) { return u.active !== false && (u.perfil === 'master' || (u.apps || []).indexOf(f.app) >= 0); });
    var others = us.filter(function (u) { return u.login !== me.login; });
    if (!others.length) { toast('Não há outro usuário com acesso a esta aplicação. O gestor master libera o acesso em Usuários.', [{ label: 'OK' }]); return; }
    var ov = el('div', 'position:fixed;inset:0;background:rgba(22,25,29,.55);z-index:90;display:flex;align-items:center;justify-content:center;padding:24px;' + FONT); ov.setAttribute('data-noprint', '1');
    var card = el('div', 'width:min(460px,100%);background:#FFFFFF;border-radius:10px;padding:20px;display:flex;flex-direction:column;gap:10px;box-sizing:border-box;max-height:92vh;overflow:auto'); ov.appendChild(card);
    card.appendChild(el('div', 'font-size:11px;font-weight:600;letter-spacing:.12em;color:#5F6B76', 'INDICAR ITEM PARA TRABALHO'));
    card.appendChild(el('div', 'font-size:16px;font-weight:600;word-break:break-word', f.label));
    function sel(label, list, def) { var w = el('label', 'display:flex;flex-direction:column;gap:4px;font-size:12px;font-weight:600;color:#3A4450'); w.appendChild(document.createTextNode(label)); var s = el('select', 'height:34px;padding:0 8px;border:1px solid #D5DAE0;border-radius:6px;font-size:13px;font-weight:400;background:#FFFFFF'); list.forEach(function (u) { var o = document.createElement('option'); o.value = u.login; o.textContent = u.name + (u.login === me.login ? ' (eu)' : ''); if (u.login === def) o.selected = true; s.appendChild(o); }); w.appendChild(s); card.appendChild(w); return s; }
    var sTo = sel('Indicar para', others, others[0].login), sAt = sel('Quem vai ativar (assumir o trabalho)', us, others[0].login), sDe = sel('Quem vai desativar (concluir)', us, others[0].login);
    sTo.onchange = function () { sAt.value = sTo.value; sDe.value = sTo.value; };
    var wn = el('label', 'display:flex;flex-direction:column;gap:4px;font-size:12px;font-weight:600;color:#3A4450'); wn.appendChild(document.createTextNode('Observação para o usuário')); var ta = el('textarea', 'padding:8px 10px;border:1px solid #D5DAE0;border-radius:6px;font-size:13px;font-weight:400;resize:vertical;min-height:70px;font-family:inherit'); ta.placeholder = 'O que precisa ser feito neste item'; wn.appendChild(ta); card.appendChild(wn);
    var row = el('div', 'display:flex;gap:8px;justify-content:flex-end');
    row.appendChild(wbtn('Cancelar', 'height:34px;border:1px solid #D5DAE0;background:#FFFFFF;color:#1F2328', function () { ov.remove(); }));
    row.appendChild(wbtn('Indicar', 'height:34px;padding:0 18px;border:0;background:#405A68;color:#FFFFFF', function () { var nm = function (l) { var u = us.filter(function (x) { return x.login === l; })[0]; return u ? u.name : l; }; api.assign({ app: f.app, key: f.key, label: f.label, q: f.q, to: sTo.value, toName: nm(sTo.value), ativa: sAt.value, desativa: sDe.value, note: ta.value.trim() }); ov.remove(); toast('Item indicado para ' + nm(sTo.value) + '. O aviso aparece no Portal e no item.', [{ label: 'OK' }]); }));
    card.appendChild(row); document.body.appendChild(ov);
  }
  function wPoll() {
    var c = current(); if (!c) return; var seen = []; try { seen = JSON.parse(sessionStorage.getItem('cga.assign.seen') || '[]'); } catch (e) { }
    api.myAssignments().filter(function (a) { return a.status === 'indicado' && a.from !== c.login && seen.indexOf(a.id) < 0; }).slice(0, 2).forEach(function (a) {
      seen.push(a.id); var ap = APPS[a.app]; toast(a.fromName + ' indicou um item para você: ' + a.label + (a.note ? ' — ' + a.note : ''), [{ label: 'Abrir', run: function () { if (ap) location.href = ap.file + '#f=' + encodeURIComponent(JSON.stringify({ q: a.q || a.label })); } }, { label: 'Depois' }]);
    });
    try { sessionStorage.setItem('cga.assign.seen', JSON.stringify(seen.slice(-100))); } catch (e) { }
  }
  window.addEventListener('storage', function (e) { if (e.key === KP || e.key === KA || e.key === null) { wRender(); wPoll(); wEvt(); } });
  setInterval(function () { if (_f) presWrite(); wRender(); wPoll(); wEvt(); }, 20000);
  setTimeout(wPoll, 2500);

  /* ---- Sincronização em tempo real entre computadores (arquivos por usuário na pasta compartilhada) ---- */
  var _lastOwn = '', _fm = {}, _busy = false, _lt = null, _tick = 0, _ownP = '', _ownPAt = 0, _ownPKey = '';
  function csg(v) { return Array.isArray(v) ? '[' + v.map(csg).sort().join(',') + ']' : (v && typeof v === 'object') ? '{' + Object.keys(v).sort().map(function (k) { return JSON.stringify(k) + ':' + csg(v[k]); }).join(',') + '}' : JSON.stringify(v); }
  function cs(s) { try { return csg(JSON.parse(s)); } catch (e) { return String(s); } }
  function safeLogin(l) { return String(l || '').replace(/[^a-z0-9._-]/gi, '_'); }
  function wfile(d, name, data) { return d.getFileHandle(name, { create: true }).then(function (fh) { return fh.createWritable(); }).then(function (w) { return w.write(data).then(function () { return w.close(); }); }); }
  function liveDirty() { if (!current() || !_h || _perm !== 'granted') return; clearTimeout(_lt); _lt = setTimeout(liveCycle, 1500); }
  function liveKick() { clearTimeout(_lt); _lt = setTimeout(liveCycle, 400); }
  async function liveCycle() {
    var me = current(); if (!me || !_h || _perm !== 'granted' || _busy) return; _busy = true;
    try {
      var own = 'cga-u-' + safeLogin(me.login) + '.json', ownP = 'cga-p-' + safeLogin(me.login) + '.json', changed = false, files = [];
      /* 1) publica o próprio trabalho */
      var ks = keysOf({ trabalho: true }), ch = {}, parts = [];
      ks.forEach(function (k) { var v = localStorage.getItem(k); ch[k] = v; parts.push(k + '=' + cs(v)); });
      var sg = parts.join('|');
      if (sg !== _lastOwn) { await wfile(_h, own, JSON.stringify({ tipo: 'cga-usuario', login: me.login, name: me.name, at: Date.now(), versao: VERSION, chaves: ch })); _lastOwn = sg; }
      /* 2) presença própria */
      if (_f) { var pk = _f.app + '|' + _f.key; if (pk !== _ownPKey || Date.now() - _ownPAt > 25000) { await wfile(_h, ownP, JSON.stringify({ login: me.login, name: me.name, app: _f.app, key: _f.key, label: _f.label, q: _f.q, at: Date.now() })); _ownPKey = pk; _ownPAt = Date.now(); } }
      else if (_ownPKey) { try { await _h.removeEntry(ownP); } catch (e) { } _ownPKey = ''; }
      /* 3) lê os demais */
      for await (var e of _h.entries()) { if (e[1].kind === 'file' && /^cga-[up]-.+\.json$/.test(e[0])) files.push(e[1]); }
      var prs = {}, prSeen = false;
      for (var i = 0; i < files.length; i++) {
        var fh = files[i], nm = fh.name; if (nm === own || nm === ownP) continue;
        var f = await fh.getFile(), isP = nm.charAt(4) === 'p';
        if (isP) { if (Date.now() - f.lastModified > 90000) continue; var pj = JSON.parse(await f.text()); if (pj && pj.login && pj.login !== me.login) prs['r:' + pj.login] = { login: pj.login, name: pj.name, app: pj.app, key: pj.key, label: pj.label, q: pj.q, at: Date.now() }; continue; }
        if (_fm[nm] === f.lastModified) continue;
        var j = JSON.parse(await f.text()); _fm[nm] = f.lastModified;
        if (!j || j.tipo !== 'cga-usuario' || !j.chaves) continue;
        Object.keys(j.chaves).forEach(function (k) {
          if (classify(k) !== 'trabalho') return;
          var iv = j.chaves[k], lv = localStorage.getItem(k), merged;
          try { merged = lv ? mergeVal(JSON.parse(iv), JSON.parse(lv)) : JSON.parse(iv); } catch (x) { return; }
          var ms = JSON.stringify(merged); if (cs(ms) !== cs(lv)) { localStorage.setItem(k, ms); changed = true; }
        });
      }
      var kp = get(KP, {}), before = JSON.stringify(Object.keys(kp).filter(function (s) { return s.indexOf('r:') === 0; }).sort().map(function (s) { return kp[s].login + kp[s].key; }));
      Object.keys(kp).forEach(function (s) { if (s.indexOf('r:') === 0) delete kp[s]; }); Object.keys(prs).forEach(function (s) { kp[s] = prs[s]; });
      var after = JSON.stringify(Object.keys(prs).sort().map(function (s) { return prs[s].login + prs[s].key; })); set(KP, kp);
      if (changed) { sset({ liveAt: Date.now() }); await api.flush(); basesEvt(); syncEvt(); }
      if (changed || before !== after) { wRender(); wEvt(); }
      sset({ liveCheckedAt: Date.now(), liveErr: '' });
    } catch (e) { sset({ liveErr: 'Falha ao sincronizar com a pasta: ' + (e && e.message || e), liveErrAt: Date.now() }); }
    _busy = false;
  }
  setInterval(function () { _tick++; if (document.hidden && _tick % 5) return; liveCycle(); }, 6000);
  api.liveInfo = function () { var i = sinfo(); return { on: !!(_h && _perm === 'granted'), at: i.liveAt || 0, checked: i.liveCheckedAt || 0, err: i.liveErr || '' }; };
  api.liveNow = liveKick;
  window.CGAAuth = api;
})();

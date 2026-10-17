// RULE: integrity — dangling anchor · stub-revert · id çakışması. [T]/[L0] okuma PAYLAŞILAN
// kütüphanededir (anchor-resolve.mjs); burada yalnız bu alt-kurala özgü mantık (placeholder
// korumalı sembol çözümleme, stub ölçümü, registry okuma) yaşar.
import { execSync } from 'node:child_process';
import { readFileSync, existsSync, statSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { astSecondOpinion, extractObjectBodies, readField, findTAndL0Docs } from '../anchor-resolve.mjs';
import { kunyeSurumuEnAz, ESKI_KUNYE_NOTU } from '../kunye-surum.mjs';
import { doldurulmamisSablonArgumani, findRegistryFile, readKunye, readSonKullaniciToggle, ownRepoNames, isOwnRepo, definedSymbols, isSymbolDefined } from './repo-context.mjs';

export function runIntegrity(argv) {
  const strict = argv.includes('--strict');
  const sablonHata = doldurulmamisSablonArgumani(argv);
  if (sablonHata) { console.error(`\nBÜTÜNLÜK KAPISI FAIL — ${sablonHata}\n`); return 1; }
  const yokArg = argv.filter(a => !a.startsWith('-') && !existsSync(a));
  if (yokArg.length) { console.error(`\nBÜTÜNLÜK KAPISI FAIL — argüman olarak verilen dosya diskte YOK: ${yokArg.join(', ')}\n  "temiz" ile "hiç bakmadım" farklıdır.\n`); return 1; }
  const registryArg = (argv.find(a => a.startsWith('--registry=')) || '').replace('--registry=', '') || null;

  let tracked = [];
  try {
    tracked = execSync('git ls-files', { maxBuffer: 64 * 1024 * 1024 })
      .toString('utf8').split('\n').filter(Boolean);
  } catch { /* git yoksa boş — repo dışı kullanım, no-op'a düşer */ }

  const pkgRoots = ['.', ...tracked.filter(f => /(^|\/)package\.json$/.test(f)).map(dirname)];
  function resolveAnchor(token, docDir) {
    const clean = token.trim().replace(/\/$/, '');
    if (!clean || clean.includes('{{') || clean.includes('*') || clean.includes('<')) return { status: 'placeholder' };
    const colonIdx = clean.indexOf(':');
    const hasColon = colonIdx > 0;
    const left = hasColon ? clean.slice(0, colonIdx) : clean;
    const right = hasColon ? clean.slice(colonIdx + 1) : null;
    const symbolName = right && !right.includes('/') ? right.replace(/^#/, '') : null;

    const candidates = [left, join(docDir, left), ...pkgRoots.map(r => join(r, left))];
    const hit = candidates.find(c => existsSync(c));
    if (!hit) return { status: 'path-yok', symbolName };
    if (!symbolName) return { status: 'ok', symbolName };

    let found = false;
    try {
      const st = statSync(hit);
      if (st.isFile()) {
        found = readFileSync(hit, 'utf8').includes(symbolName);
      } else {
        for (const f of readdirSync(hit)) {
          const fp = join(hit, f);
          try { if (statSync(fp).isFile() && readFileSync(fp, 'utf8').includes(symbolName)) { found = true; break; } }
          catch { /* okunamayan dosya - atla */ }
        }
      }
    } catch { found = false; }
    const astHint = found ? null : astSecondOpinion(symbolName, process.cwd());
    return { status: found ? 'ok' : 'sembol-yok', symbolName, astHint };
  }

  const PLACEHOLDER = /\{\{([^}\n]*)\}\}/g;
  const isRealField = inner => inner.trim().length > 0 && !/^[.\s…]+$/.test(inner);
  function hasUnfilledPlaceholder(text) {
    for (const m of text.matchAll(PLACEHOLDER)) if (isRealField(m[1])) return true;
    return false;
  }
  function bodyLineCount(fullText) {
    const norm = fullText.replace(/\r\n/g, '\n');
    const parts = norm.split(/^---\n[\s\S]*?\n---\n?/m);
    const body = parts.length > 1 ? parts.slice(1).join('') : norm;
    return body.split('\n').filter(l => l.trim().length > 0).length;
  }
  function isStub(fullText) {
    return hasUnfilledPlaceholder(fullText) || bodyLineCount(fullText) < 10;
  }

  const { tDocs, l0Docs } = findTAndL0Docs(tracked);

  const registryPath = registryArg || findRegistryFile();
  // registry okuyucu BİLİNÇLİ yerel kopya (mini-yaml.mjs parseRegistry ile aynı): mini-yaml yalnız
  // check-provenance ile, toggle açıkken hedefe kurulur. Buradan import etmek çekirdek kapıyı
  // (doc-truth dahil tüm doc-integrity) o dosyaya bağlar — dosya yoksa hepsi çöker (hakem ölçtü, K77).
  function parseRegistry(text) {
    const features = new Map();
    let inFeatures = false, currentId = null, inTechDocs = false;
    for (const raw of text.split('\n')) {
      const line = raw.replace(/#.*$/, '').replace(/\r$/, '');
      if (!line.trim()) continue;
      const indent = line.match(/^ */)[0].length;
      const trimmed = line.trim();
      if (/^features:\s*$/.test(trimmed) && indent === 0) { inFeatures = true; currentId = null; inTechDocs = false; continue; }
      if (!inFeatures) continue;
      const idMatch = trimmed.match(/^([\w.\-/]+):\s*$/);
      if (indent === 2 && idMatch) { currentId = idMatch[1]; features.set(currentId, new Set()); inTechDocs = false; continue; }
      if (indent === 4 && /^tech_docs:\s*$/.test(trimmed)) { inTechDocs = true; continue; }
      if (indent >= 6 && inTechDocs && trimmed.startsWith('- ')) {
        const path = trimmed.slice(2).trim().replace(/^['"]|['"]$/g, '');
        if (currentId && path) features.get(currentId).add(path);
        continue;
      }
      if (indent <= 4 && inTechDocs && !trimmed.startsWith('- ')) inTechDocs = false;
    }
    return features;
  }
  let registryFeatures = null;
  if (registryPath && existsSync(registryPath)) {
    try { registryFeatures = parseRegistry(readFileSync(registryPath, 'utf8')); } catch { registryFeatures = null; }
  }

  // T4 (v0.30): [T]/[L0] YOKKEN "no-op OK" sessiz değildir — doküman katmanı BOŞ. Toggle açıksa (künye)
  // bu bir boşluktur; registry dosyası VARSA (kapsam tanımlı) --strict altında FAIL (kapsam var, doküman yok).
  const noTL0 = !tDocs.length && !l0Docs.length;
  // K81: yeni sıkı bulgular (T4 kapsam-var-doküman-yok, B7 sembol-tanımsız) yalnız künyesi v0.30+ ya da künyesiz
  // repoda --strict FAIL; eski künyede UYARI + yükseltme notu (sessiz yeni FAIL dayatılmaz).
  const sikiKademe = kunyeSurumuEnAz('.', '0.30.0');
  const eskiUyari = [];
  const registryFileExists = !!(registryPath && existsSync(registryPath));
  const toggle = noTL0 ? readSonKullaniciToggle() : null;
  const emptyLayerNote = noTL0
    ? `Doküman katmanı boş — [T]/[L0] yok${toggle === true ? ' ve künyede son_kullanici_dokumani AÇIK: bu bir BOŞLUKTUR' : ' (toggle açıksa bu bir boşluktur)'}.`
    : '';
  if (noTL0 && registryFileExists && strict && sikiKademe && !registryFeatures) {
    console.error(`\nBÜTÜNLÜK KAPISI FAIL — ${emptyLayerNote}\n  registry (${registryPath}) kapsamı TANIMLI ama hiçbir [T]/[L0] doküman yok: kapsam var, doküman yok.\n(--strict: commit/CI bloke edildi)\n`);
    return 1;
  }
  if (noTL0 && registryFileExists && strict && !sikiKademe)
    console.warn(`\nBÜTÜNLÜK KAPISI UYARI — ${emptyLayerNote} registry (${registryPath}) kapsamı tanımlı ama doküman yok. ${ESKI_KUNYE_NOTU}\n`);
  if (noTL0 && !registryFeatures) {
    console.log(`Bütünlük kapısı OK — [T]/[L0]/registry yok (etki alanı boş, no-op). ${emptyLayerNote}`);
    return 0;
  }
  if (noTL0) console.warn(`\nBÜTÜNLÜK KAPISI NOT: ${emptyLayerNote} registry (${registryPath}) kapsamı tanımlı — --strict altında FAIL.\n`);

  const findings = [];

  // B7 (v0.30): anchors[].repo BU repoya aitse (git klasör adı · künye repo adı · origin son parçası;
  // büyük/küçük harf duyarsız) ve yol olarak çözülmüyorsa (çıplak sembol) sembol izlenen kod
  // dosyalarındaki TANIMDAN çözülür. Başka repo adı → eski yumuşak not (çapraz-repo).
  const ownNames = ownRepoNames(readKunye());
  let ownResolved = 0;

  for (const t of tDocs) {
    const docDir = dirname(t.path);
    for (const b of extractObjectBodies(t.fm, 'anchors')) {
      if (!b.raw) continue;
      const repo = readField(b.raw, 'repo');
      const symbol = readField(b.raw, 'symbol');
      if (!repo || !symbol) continue;
      const r = resolveAnchor(`${repo}:${symbol}`, docDir);
      if (r.status === 'path-yok' && isOwnRepo(repo, ownNames)) {
        if (isSymbolDefined(symbol, definedSymbols(tracked))) { ownResolved++; continue; }
        const danglingDetail = `${t.path}  →  anchors[]: ${repo}:${symbol} (repo adı BU repoya ait ama sembol bu repoda tanımlı değil — izlenen kod dosyalarında class/interface/function/... tanımı yok)${r.astHint ? ' ' + r.astHint : ''}`;
        if (sikiKademe) findings.push({ type: 'DANGLING ANCHOR', detail: danglingDetail });
        else eskiUyari.push(`[DANGLING ANCHOR] ${danglingDetail}`);
        continue;
      }
      if (r.status === 'path-yok')
        findings.push({ type: 'DANGLING ANCHOR', detail: `${t.path}  →  anchors[]: ${repo}:${symbol} (yol yok — çapraz-repo olabilir, DOĞRULANAMADI, sayılmadı)`, soft: true });
      else if (r.status === 'sembol-yok')
        findings.push({ type: 'DANGLING ANCHOR', detail: `${t.path}  →  anchors[]: ${repo}:${symbol} (yol VAR, sembol dosyada YOK)${r.astHint ? ' ' + r.astHint : ''}` });
    }
    for (const b of extractObjectBodies(t.fm, 'test_anchors')) {
      if (!b.raw) continue;
      const anchor = readField(b.raw, 'anchor');
      if (!anchor) continue;
      const r = resolveAnchor(anchor, docDir);
      if (r.status === 'sembol-yok')
        findings.push({ type: 'DANGLING ANCHOR', detail: `${t.path}  →  test_anchors[].anchor: ${anchor} (yol VAR, sembol dosyada YOK)${r.astHint ? ' ' + r.astHint : ''}` });
    }
    for (const b of extractObjectBodies(t.fm, 'constants')) {
      if (!b.raw) continue;
      const anchor = readField(b.raw, 'anchor');
      if (!anchor) continue;
      const r = resolveAnchor(anchor, docDir);
      if (r.status === 'sembol-yok')
        findings.push({ type: 'DANGLING ANCHOR', detail: `${t.path}  →  constants[].anchor: ${anchor} (yol VAR, sembol dosyada YOK)${r.astHint ? ' ' + r.astHint : ''}` });
    }
  }
  for (const l0 of l0Docs) {
    const docDir = dirname(l0.path);
    const anchorsBlock = l0.fm.match(/^anchors:\s*\r?\n((?:[ \t]+\S.*\r?\n?|[ \t]*\r?\n?)+)/m);
    const anchorsFm = anchorsBlock ? anchorsBlock[1] : '';
    for (const b of extractObjectBodies(anchorsFm, 'tech_docs')) {
      if (b.raw || !b.str) continue;
      const tPath = b.str;
      const resolved = [tPath, join(docDir, tPath)].find(existsSync);
      if (!resolved)
        findings.push({ type: 'DANGLING ANCHOR', detail: `${l0.path}  →  anchors.tech_docs: ${tPath} (dosya yok)` });
    }
    for (const b of extractObjectBodies(anchorsFm, 'code')) {
      if (b.raw || !b.str) continue;
      const r = resolveAnchor(b.str, docDir);
      if (r.status === 'sembol-yok')
        findings.push({ type: 'DANGLING ANCHOR', detail: `${l0.path}  →  anchors.code: ${b.str} (yol VAR, sembol dosyada YOK)${r.astHint ? ' ' + r.astHint : ''}` });
    }
  }
  if (registryFeatures) {
    for (const [id, docs] of registryFeatures) {
      for (const doc of docs) {
        if (!existsSync(doc))
          findings.push({ type: 'DANGLING ANCHOR', detail: `registry (${registryPath})  →  features.${id}.tech_docs: ${doc} (dosya yok)` });
      }
    }
  }

  function pastFullVersionExists(path) {
    let entries = [];
    try {
      const raw = execSync(`git log --follow --name-only --format=%x00%H -- "${path}"`, { maxBuffer: 16 * 1024 * 1024 })
        .toString('utf8');
      for (const chunk of raw.split('\0').slice(1)) {
        const lines = chunk.split('\n').filter(Boolean);
        const rev = lines[0];
        const pathAtRev = lines[1];
        if (rev && pathAtRev) entries.push({ rev, path: pathAtRev });
      }
    } catch { return false; }
    if (entries.length <= 1) return false;
    for (const { rev, path: pathAtRev } of entries.slice(1)) {
      let content;
      try { content = execSync(`git show ${rev}:"${pathAtRev}"`, { maxBuffer: 16 * 1024 * 1024 }).toString('utf8'); }
      catch { continue; }
      if (!isStub(content)) return true;
    }
    return false;
  }
  for (const t of tDocs) {
    if (!isStub(t.text)) continue;
    if (pastFullVersionExists(t.path))
      findings.push({ type: "STUB'A GERİ DÖNMÜŞ [T]", detail: `${t.path}  →  ŞİMDİ stub/placeholder (<10 satır gövde ya da doldurulmamış {{}}) AMA git geçmişinde DOLU bir sürümü vardı — checkout/reset "tamamlandı" iddiasıyla ÇELİŞİYOR.` });
  }

  function readTId(fm) {
    const m = fm.match(/^id:\s*["']?([\w.\-]+)["']?/m);
    return m ? m[1].trim() : null;
  }
  function readFeatureIds(fm) {
    const inline = fm.match(/^feature_ids:\s*\[([^\]]*)\]/m);
    if (inline) return inline[1].split(',').map(s => s.trim().replace(/^['"]|['"]$/g, '')).filter(Boolean);
    const block = fm.match(/^feature_ids:\s*\r?\n((?:\s+-\s+.+\r?\n?)+)/m);
    if (block) return block[1].split('\n').map(l => l.match(/^\s+-\s+(.+)\s*$/)).filter(Boolean).map(m2 => m2[1].trim().replace(/^['"]|['"]$/g, ''));
    return [];
  }

  const idOwners = new Map();
  for (const t of tDocs) {
    const id = readTId(t.fm);
    if (!id) continue;
    if (!idOwners.has(id)) idOwners.set(id, []);
    idOwners.get(id).push(t.path);
  }
  for (const [id, paths] of idOwners) {
    if (paths.length > 1)
      findings.push({ type: 'ÇAKIŞMA', detail: `id: ${id}  →  BİRDEN ÇOK [T] dosyasında aynı kimlik: ${paths.join(', ')} (frontmatter id çakışması — hangisi kanonik belirsiz)` });
  }

  const anchorOwners = new Map();
  for (const t of tDocs) {
    const featureIds = readFeatureIds(t.fm);
    for (const b of extractObjectBodies(t.fm, 'anchors')) {
      if (!b.raw) continue;
      const repo = readField(b.raw, 'repo');
      const symbol = readField(b.raw, 'symbol');
      const primary = readField(b.raw, 'primary');
      if (!repo || !symbol) continue;
      if (primary !== 'true') continue;
      // v0.30.4: çakışma anahtarı `path` içerir — aynı ADI taşıyan FARKLI dosyadaki sınıflar çakışma sayılmaz
      // (saha: iki ayrı GetCustomerFieldsQuery). SINIR: biri `path`li biri `path`siz anchor'da anahtarlar
      // ayrışır, gerçek çakışma gözden kaçabilir ([T] konvansiyonunda path zaten beklenen alan).
      const apath = (b.raw.match(/(?:^|[,{\s])path:\s*["']?([^,"'}]+)["']?/) || [])[1];
      // Anahtar `repo:path:symbol` (path yoksa `repo:symbol`): farklı repo + aynı path/sembol çakışma sayılmaz.
      const key = apath ? `${repo}:${apath.trim()}:${symbol}` : `${repo}:${symbol}`;
      if (!anchorOwners.has(key)) anchorOwners.set(key, []);
      anchorOwners.get(key).push({ path: t.path, featureIds });
    }
  }
  for (const [key, owners] of anchorOwners) {
    if (owners.length < 2) continue;
    for (let i = 0; i < owners.length; i++) {
      for (let j = i + 1; j < owners.length; j++) {
        const a = owners[i], b = owners[j];
        const intersects = a.featureIds.some(id => b.featureIds.includes(id));
        if (!intersects)
          findings.push({ type: 'ÇAKIŞMA', detail: `anchor: ${key}  →  PRIMARY olarak İKİ [T]'de iddia edilmiş — ${a.path} (feature_ids: [${a.featureIds.join(', ') || '-'}])  vs  ${b.path} (feature_ids: [${b.featureIds.join(', ') || '-'}]) — feature_ids KESİŞMİYOR, aynı kod iki ayrı göreve sahiplendirilmiş.` });
      }
    }
  }

  if (registryFeatures) {
    for (const [id, docs] of registryFeatures) {
      for (const doc of docs) {
        if (!existsSync(doc)) continue;
        let content;
        try { content = readFileSync(doc, 'utf8'); } catch { continue; }
        if (isStub(content))
          findings.push({ type: 'YETİM STUB', detail: `registry.features.${id}.tech_docs  →  ${doc} placeholder/stub (<10 satır gövde ya da doldurulmamış {{}}) AMA registry onu BESLEYİCİ [T] olarak listeliyor.` });
      }
    }
  }

  if (eskiUyari.length)
    console.warn(`\nBÜTÜNLÜK KAPISI UYARI (${eskiUyari.length}, eski künye — FAIL değil):\n` + eskiUyari.map(d => `  ${d}`).join('\n') + `\n  ${ESKI_KUNYE_NOTU}\n`);

  const hard = findings.filter(f => !f.soft);
  const soft = findings.filter(f => f.soft);

  if (soft.length)
    console.warn(`\nBÜTÜNLÜK KAPISI NOT (${soft.length}, sayılmadı — çapraz-repo/DOĞRULANAMADI):\n` + soft.map(f => `  [${f.type}] ${f.detail}`).join('\n') + '\n');

  if (hard.length) {
    const label = strict ? 'BÜTÜNLÜK KAPISI FAIL' : 'BÜTÜNLÜK KAPISI UYARI';
    console.error(`\n${label} (${hard.length} bütünlük sorunu):\n` + hard.map(f => `  [${f.type}] ${f.detail}`).join('\n'));
    console.error('\n"Tamamlandı" iddiasından ÖNCE koşan tarama budur — checkout/reset stub\'a geri');
    console.error('döndürebilir, registry yetim stub\'a işaret edebilir, iki [T] aynı kodu/kimliği');
    console.error('çakışan biçimde iddia edebilir. Ajanın kendi beyanı ile GERÇEK durum burada çapraz-kontrol edilir.');
    if (strict) { console.error('(--strict: commit/CI bloke edildi)\n'); return 1; }
    console.error('(--strict ile bu bulgular commit/CI\'ı bloke eder; şimdilik uyarı.)\n');
  }

  if (noTL0 && registryFileExists && strict && sikiKademe) {
    console.error(`\nBÜTÜNLÜK KAPISI FAIL — ${emptyLayerNote}\n  registry (${registryPath}) kapsamı TANIMLI ama hiçbir [T]/[L0] doküman yok: kapsam var, doküman yok.\n(--strict: commit/CI bloke edildi)\n`);
    return 1;
  }

  console.log(`Bütünlük kapısı OK — ${tDocs.length} [T], ${l0Docs.length} [L0]${registryFeatures ? `, registry (${registryFeatures.size} feature)` : ''} tarandı, ${hard.length} sert bulgu.${ownResolved ? ` ${ownResolved} aynı-repo anchor tanımdan çözüldü.` : ''}${noTL0 ? ' ' + emptyLayerNote : ''}`);
  return 0;
}

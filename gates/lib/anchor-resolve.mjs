// Paylaşılan kapı yardımcıları: AST-indeks ikinci-görüşü + [T]/[L0] frontmatter okuma.
//
// AST ikinci-görüş sözleşmesi:
//   v0.10 DEAK §5.1 — AST-indeks (OPSİYONEL, fail-open). SINIR: graf doğruluğun KAYNAĞI DEĞİL;
//   yalnız found=false iken İPUCU. Verdict ASLA değişmez (sahte-anchor yine FAIL/sembol-yok sayılır).
//   Araç yoksa/hata → fail-open, davranış birebir status quo.
// ŞEMA (v0.11 pilotunda codebase-memory-mcp 0.9.0'a karşı ÖLÇÜLDÜ):
//   <cli> cli search_graph --project <ad> --name-pattern <symbol> --limit 5
//   → {"total":N,"results":[{"file_path":...}]}; stdout başındaki log satırları ayıklanır.
// ARS_AST_ADAPTER = indekslenmiş PROJE ADI. ARS_AST_CLI ile binary yolu override edilir.
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

export function astSecondOpinion(symbolName, repoRoot) {
  const project = process.env.ARS_AST_ADAPTER;
  if (!project || !symbolName) return null;
  try {
    // CLI yolu TIRNAKLANIR: boşluklu dizinlerde tırnaksız exec başarısız olur (pilotta yakalandı).
    const rawCli = process.env.ARS_AST_CLI || 'codebase-memory-mcp';
    const cli = /[\s]/.test(rawCli) && !/["']/.test(rawCli) ? JSON.stringify(rawCli) : rawCli;
    const out = execSync(
      `${cli} cli search_graph --project ${JSON.stringify(project)} --name-pattern ${JSON.stringify(symbolName)} --limit 5`,
      { cwd: repoRoot, maxBuffer: 8 * 1024 * 1024, timeout: 15000, stdio: ['pipe', 'pipe', 'ignore'] }
    ).toString('utf8');
    // Log gürültüsünü at: JSON gövdesi TEK satırdır → '{' ile başlayan ilk parse-edilebilir satır.
    // (lastIndexOf('{') KULLANMA: results[] içindeki iç nesneyi yakalar — pilotta görüldü.)
    let data = null;
    for (const line of out.split(/\r?\n/)) {
      const s = line.trim();
      if (!s.startsWith('{')) continue;
      try { data = JSON.parse(s); break; } catch { /* sonraki satır */ }
    }
    const hits = data && Array.isArray(data.results) ? data.results : null;
    if (!hits) return null;
    if (hits.length === 0) return '(AST indeksi de bu sembolü görmüyor — muhtemelen gerçekten ölü)';
    const where = hits.map(h => h?.file_path).filter(Boolean).slice(0, 2).join(', ');
    return where
      ? `(AST indeksi sembolü şurada görüyor: ${where} — anchor yolu yanlış olabilir)`
      : '(AST indeksi sembolü başka bir yerde görüyor — anchor yolu yanlış olabilir)';
  } catch { return null; }  // araç yok / hata / bozuk JSON → fail-open, status quo
}

// ---------------------------------------------------------------------------
// [T]/[L0] frontmatter okuma — PAYLAŞILAN tek kopya (integrity + doc-recency çağırır).
// ---------------------------------------------------------------------------

export function frontmatter(text) {
  const norm = text.replace(/\r\n/g, '\n');
  const m = norm.match(/^---\n([\s\S]*?)\n---/);
  return m ? m[1] : '';
}

const LIST_BLOCK_BODY = /(?:[ \t]+\S.*(?:\r?\n|$)|[ \t]*(?:\r?\n|$))+/.source;
export function extractObjectBodies(fm, field) {
  const bodies = [];
  const inlineM = fm.match(new RegExp('^[ \\t]*' + field + ':[ \\t]*\\[([\\s\\S]*?)\\]', 'm'));
  if (inlineM && inlineM[1].trim()) {
    for (const b of inlineM[1].match(/\{[^{}]*\}/g) || []) bodies.push({ raw: b.slice(1, -1) });
    if (!/\{/.test(inlineM[1])) {
      for (const s of inlineM[1].match(/["']?([^,"'[\]]+)["']?/g) || [])
        if (s.trim()) bodies.push({ raw: null, str: s.trim().replace(/["']/g, '') });
    }
    return bodies;
  }
  const block = fm.match(new RegExp('^[ \\t]*' + field + ':[ \\t]*\\r?\\n(' + LIST_BLOCK_BODY + ')', 'm'));
  if (block) {
    // v0.30.4: liste kardeş anahtara TAŞMAZ — ilk öğenin girintisi referans; ondan sığ/eşit girintili `-`'siz satır
    // (`symbols:` gibi kardeş alan) ya da daha sığ `-` listeyi BİTİRİR (saha: symbols öğeleri tech_docs sanılıyordu).
    let itemIndent = -1;
    for (const line of block[1].split('\n')) {
      if (!line.trim() || /^\s*#/.test(line)) continue;   // boş/yorum satırı listeyi bölmez
      const ind = line.match(/^[ \t]*/)[0].length;
      const isItem = /^\s+-(\s|$)/.test(line);
      if (itemIndent < 0) { if (isItem) itemIndent = ind; else continue; }
      else if (isItem ? ind < itemIndent : ind <= itemIndent) break;
      const objM = line.match(/^\s+-\s+\{(.+)\}\s*$/);
      if (objM) { bodies.push({ raw: objM[1] }); continue; }
      const strM = line.match(/^\s+-\s+["']?(.+?)["']?\s*$/);
      if (strM) bodies.push({ raw: null, str: strM[1].trim() });
    }
  }
  return bodies;
}

export function readField(raw, name) {
  const m = raw && raw.match(new RegExp(name + ':\\s*["\']?([^,"\'}]+)["\']?'));
  return m ? m[1].trim() : null;
}

// SINIR: doc-recency KADEME 1 YOL-TABANLIDIR — sembolün dosyada gerçekten var olup olmadığını
// yalnız `integrity` alt-kuralı doğrular (kendi resolveAnchor'ı, placeholder korumalı). Burada
// ikinci bir sembol çözücü YOKTUR (iş tekrarı + ikinci yanlış-pozitif yüzeyi açmamak için).

// [T]/[L0] sınıflandırma: [T] = feature_ids + anchors · [L0] = feature_id + coverage.
export function classifyDoc(fm) {
  const isT = /^feature_ids:/m.test(fm) && /^anchors:/m.test(fm);
  const isL0 = /^feature_id:/m.test(fm) && /^coverage:/m.test(fm);
  return isT ? 'T' : isL0 ? 'L0' : null;
}

// Tracked .md dosyaları arasından [T]/[L0] dokümanlarını (frontmatter'lı) toplar.
export function findTAndL0Docs(tracked) {
  const mdFiles = tracked.filter(f => /\.md$/i.test(f) && !/\.template\.md$/i.test(f));
  const tDocs = [];
  const l0Docs = [];
  for (const f of mdFiles) {
    let text;
    try { text = readFileSync(f, 'utf8'); } catch { continue; }
    const fm = frontmatter(text);
    if (!fm) continue;
    const kind = classifyDoc(fm);
    if (kind === 'T') tDocs.push({ path: f, text, fm });
    else if (kind === 'L0') l0Docs.push({ path: f, text, fm });
  }
  return { tDocs, l0Docs };
}

// v0.18.3 hakem turu B2 düzeltmesi: classifyDoc() DÖRT-ALAN katılığı ([T]=feature_ids+anchors,
// [L0]=feature_id+coverage) tek harflik bir typo'da (feature_id yerine feature_ids ya da tersi)
// dokümanı SESSİZCE hiçbir sınıfa düşürmüyordu — ne tripwire ne "çözülemedi" notu, kullanıcının
// istediği tetikleme hiç kurulmuyordu ve kimse fark etmiyordu. Bu fonksiyon DAR bir sinyalle
// (yalnız anchors:/tech_docs:/feature_id-ailesi alanlarından EN AZ BİRİNİ taşıyıp sınıflanamayan
// dosyalar) "sınıflanamadı" adaylarını raporlar — rastgele frontmatter'lı bir blog/jekyll
// dosyası bu adaya DÜŞMEZ (FP ölçümü: tests/check-doc-integrity.test.mjs, ilgisiz frontmatter'lı
// dosya negatif deneyi).
export function findUnclassifiedAnchorDocs(tracked) {
  const SIGNAL_FIELDS = [
    ['anchors:', /^anchors:/m],
    ['tech_docs:', /^\s*tech_docs:/m],
    ['feature_id:', /^feature_id:/m],
    ['feature_ids:', /^feature_ids:/m],
  ];
  const mdFiles = tracked.filter(f => /\.md$/i.test(f) && !/\.template\.md$/i.test(f));
  const out = [];
  for (const f of mdFiles) {
    let text;
    try { text = readFileSync(f, 'utf8'); } catch { continue; }
    const fm = frontmatter(text);
    if (!fm) continue;
    if (classifyDoc(fm)) continue;   // zaten sınıflandı, aday değil
    const hitFields = SIGNAL_FIELDS.filter(([, re]) => re.test(fm)).map(([name]) => name);
    if (!hitFields.length) continue;   // sinyal alanı hiç yok → generic .md, DAR sinyal dışı
    const hasFeatureIds = /^feature_ids:/m.test(fm);
    const hasFeatureId = /^feature_id:/m.test(fm);
    const hasAnchors = /^anchors:/m.test(fm);
    const hasCoverage = /^coverage:/m.test(fm);
    let reason;
    if (hasFeatureIds && !hasAnchors) reason = "feature_ids: var, anchors: yok → [T] olamadı";
    else if (hasAnchors && !hasFeatureIds) reason = "anchors: var, feature_ids: yok → [T] olamadı (feature_id: typo'su olabilir)";
    else if (hasFeatureId && !hasCoverage) reason = "feature_id: var, coverage: yok → [L0] olamadı";
    else if (hasCoverage && !hasFeatureId) reason = "coverage: var, feature_id: yok → [L0] olamadı (feature_ids: typo'su olabilir)";
    else reason = `sinyal alanları (${hitFields.join(', ')}) var ama [T]/[L0] dört-alan şartı tamamlanmadı`;
    out.push({ path: f, reason });
  }
  return out;
}

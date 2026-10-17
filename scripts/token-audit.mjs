#!/usr/bin/env node
// token-audit.mjs — Claude Code transcript telemetrisinden bağlam/maliyet ÜST SINIRI çıkarır.
//
// NEDEN: doctrine.md §v0.6 "Token sayısı ancak araç telemetrisiyle kanıttır; ajan self-report'u
// maliyet defteri olamaz." İlke doğruydu ama ARACI YOKTU → CONTEXT_BUDGET.md'nin hotspot tablosu
// sonsuza dek boş kalıyordu (ölçüm çıkmazı). Bu script o çıkmazı kırar.
//
// DÜRÜSTLÜK — çıktının statüsü (v0.11 dogfooding'de bulundu, dış-göz/Codex doğruladı):
//   Bu araç ÖLÇÜLEN MALİYET değil, KARŞI-OLGUSAL ÜST SINIR üretir. Üç kaynak abartı vardır:
//   (1) DEDUP: Claude Code streaming yanıtı JSONL'e blok blok yazar; aynı message.id 25-28 satırda
//       görünür ve her satır AYNI kümülatif usage'ı taşır. Dedup edilmezse ~%58 şişme olur.
//       Bu script `dosya+message.id` ile dedup eder.
//   (2) COMPACTION: compact boundary sonrası önceki bağlam TAŞINMAZ. Çarpan hesabı bunu keser.
//   (3) TOKENIZER: araç-sonucu boyutu karakter/4 tahminidir, gerçek tokenizer değil.
//   Ayrıca fiyatlar liste fiyatıdır — abonelik kotası dolar olarak faturalanmaz. Dolar sütunu
//   KIYAS içindir (hangi kalem büyük), fatura kanıtı DEĞİLDİR.
//
// KULLANIM:
//   node scripts/token-audit.mjs                 # tüm projeler özeti
//   node scripts/token-audit.mjs --project <ad>  # tek proje
//   node scripts/token-audit.mjs --tools         # araç bazında bağlam çarpanı
//   node scripts/token-audit.mjs --json          # ham özet (CONTEXT_BUDGET.md'yi beslemek için)
//   node scripts/token-audit.mjs --raw           # dedup YAPMA (şişmeyi görmek için; kanıt değil)

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

const ROOT = process.env.CLAUDE_PROJECTS_DIR || join(homedir(), '.claude', 'projects');
const argv = process.argv.slice(2);
const has = f => argv.includes(f);
const val = f => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : null; };
const RAW = has('--raw');
const ONLY = val('--project');

// Liste fiyatı ($/token). Model bazlı — tek sabit tarife uygulamak yanlış sonuç verir.
const PRICES = {
  'claude-opus-4-8':   { in: 5e-6,  out: 25e-6 },
  'claude-opus-4-7':   { in: 5e-6,  out: 25e-6 },
  'claude-opus-4-6':   { in: 5e-6,  out: 25e-6 },
  'claude-fable-5':    { in: 10e-6, out: 50e-6 },
  'claude-mythos-5':   { in: 10e-6, out: 50e-6 },
  'claude-sonnet-5':   { in: 3e-6,  out: 15e-6 },
  'claude-sonnet-4-6': { in: 3e-6,  out: 15e-6 },
  'claude-haiku-4-5':  { in: 1e-6,  out: 5e-6 },
};
const priceOf = m => {
  if (!m) return null;
  if (PRICES[m]) return PRICES[m];
  const base = Object.keys(PRICES).find(k => m.startsWith(k));
  return base ? PRICES[base] : null;
};
// cache read = 0.1x input, cache write (5dk TTL) = 1.25x input
const costOf = (t, model) => {
  const p = priceOf(model) || PRICES['claude-opus-4-8'];
  return t.cr * p.in * 0.1 + t.cw * p.in * 1.25 + t.in * p.in + t.out * p.out;
};

function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.name.endsWith('.jsonl')) out.push(p);
  }
  return out;
}

const blank = () => ({ in: 0, out: 0, cw: 0, cr: 0, n: 0, cost: 0 });
const bump = (m, k) => { if (!m.has(k)) m.set(k, blank()); return m.get(k); };
function add(t, u, model) {
  t.in += u.input_tokens || 0; t.out += u.output_tokens || 0;
  t.cw += u.cache_creation_input_tokens || 0; t.cr += u.cache_read_input_tokens || 0;
  t.n++;
  const one = blank();
  one.in = u.input_tokens || 0; one.out = u.output_tokens || 0;
  one.cw = u.cache_creation_input_tokens || 0; one.cr = u.cache_read_input_tokens || 0;
  t.cost += costOf(one, model);
}

const byProject = new Map(), byModel = new Map(), byKind = new Map(), byDay = new Map();
const byTool = new Map();
let rawRecords = 0, dedupRecords = 0, compactBoundaries = 0, filesScanned = 0;

for (const dir of (existsSync(ROOT) ? readdirSync(ROOT, { withFileTypes: true }).filter(d => d.isDirectory()) : [])) {
  if (ONLY && !dir.name.includes(ONLY)) continue;
  for (const file of walk(join(ROOT, dir.name))) {
    filesScanned++;
    const recs = [];
    for (const line of readFileSync(file, 'utf8').split('\n')) {
      if (!line.trim()) continue;
      try { recs.push(JSON.parse(line)); } catch { /* bozuk satır atlanır */ }
    }
    const isSub = f => /(^|[\\/])(subagents|wf_)/.test(f) || /[\\/]agent-[^\\/]*\.jsonl$/.test(f);
    const sub = isSub(file);

    // --- usage toplama (message.id ile dedup) ---
    const seen = new Set();
    const reqIdx = [];           // dedup edilmiş isteklerin kayıt indeksi
    let lastCompact = -1;        // compact boundary sonrası bağlam taşınmaz
    recs.forEach((o, i) => {
      if (o.isCompactSummary || o.subtype === 'compact_boundary' || o.type === 'compact_boundary') {
        compactBoundaries++; lastCompact = i;
      }
      const u = o.message?.usage;
      if (!u) return;
      rawRecords++;
      const id = o.message?.id ?? o.requestId ?? o.uuid;
      if (!RAW && id) { if (seen.has(id)) return; seen.add(id); }
      dedupRecords++;
      reqIdx.push(i);
      const model = o.message?.model || 'bilinmiyor';
      add(bump(byProject, dir.name), u, model);
      add(bump(byModel, model), u, model);
      add(bump(byKind, (sub || o.isSidechain) ? 'subagent' : 'ana ajan'), u, model);
      const d = (o.timestamp || '').slice(0, 10);
      if (d) add(bump(byDay, d), u, model);
    });

    // --- araç-sonucu bağlam çarpanı (compact boundary'de kesilir) ---
    if (has('--tools')) {
      const idToName = new Map();
      const boundaries = [];
      recs.forEach((o, i) => {
        if (o.isCompactSummary || o.subtype === 'compact_boundary' || o.type === 'compact_boundary') boundaries.push(i);
      });
      recs.forEach((o, i) => {
        const c = o.message?.content;
        if (!Array.isArray(c)) return;
        for (const b of c) {
          if (b.type === 'tool_use') { idToName.set(b.id, b.name); continue; }
          if (b.type !== 'tool_result') continue;
          const name = idToName.get(b.tool_use_id); if (!name) continue;
          let len = 0;
          if (typeof b.content === 'string') len = b.content.length;
          else if (Array.isArray(b.content)) len = b.content.reduce((a, x) => a + (x.text?.length || 0), 0);
          const tok = len / 4;                                  // (3) tokenizer tahmini
          const nextCut = boundaries.find(x => x > i) ?? Infinity;   // (2) compaction kesmesi
          const remaining = reqIdx.filter(r => r > i && r < nextCut).length;
          const t = bump(byTool, name);
          t.n++; t.in += tok; t.cr += tok * remaining;          // cr alanı = yeniden-okuma üst sınırı
        }
      });
    }
  }
}

// ---------- rapor ----------
const M = n => (n / 1e6).toFixed(1) + 'M';
const $ = n => '$' + Math.round(n).toLocaleString();
const totals = blank();
for (const v of byProject.values()) { totals.in += v.in; totals.out += v.out; totals.cw += v.cw; totals.cr += v.cr; totals.n += v.n; totals.cost += v.cost; }

if (has('--json')) {
  const dump = m => Object.fromEntries([...m].map(([k, v]) => [k, { ...v, cost: Math.round(v.cost) }]));
  console.log(JSON.stringify({
    statu: 'KARSI-OLGUSAL UST SINIR — olculen maliyet degil',
    uyarilar: ['dedup: message.id', 'compaction kesilir', 'tokenizer: karakter/4 tahmini', 'fiyat: liste fiyati, fatura degil'],
    filesScanned, rawRecords, dedupRecords,
    sismeYuzdesi: rawRecords ? +(100 * (1 - dedupRecords / rawRecords)).toFixed(1) : 0,
    compactBoundaries,
    toplam: { ...totals, cost: Math.round(totals.cost) },
    proje: dump(byProject), model: dump(byModel), tur: dump(byKind),
  }, null, 2));
  process.exit(0);
}

const line = (name, t, w = 30) =>
  `${String(name).slice(-w).padEnd(w)} istek:${String(t.n).padStart(6)}  cacheR:${M(t.cr).padStart(8)}  cacheW:${M(t.cw).padStart(7)}  out:${M(t.out).padStart(7)}  ${$(t.cost).padStart(8)}${totals.cost ? '  %' + (100 * t.cost / totals.cost).toFixed(1).padStart(5) : ''}`;
const sorted = m => [...m.entries()].sort((a, b) => b[1].cost - a[1].cost);

console.log('='.repeat(96));
console.log('  KARSI-OLGUSAL UST SINIR — olculen maliyet DEGIL. Dolar sutunu KIYAS icindir, fatura degil.');
console.log(`  taranan dosya: ${filesScanned} | ham usage kaydi: ${rawRecords.toLocaleString()} | dedup sonrasi: ${dedupRecords.toLocaleString()}` +
  (RAW ? '  [--raw: DEDUP YOK]' : ` (sisme %${(100 * (1 - dedupRecords / (rawRecords || 1))).toFixed(1)})`));
console.log(`  compact boundary: ${compactBoundaries}`);
console.log('='.repeat(96));

for (const [title, map] of [['PROJE', byProject], ['MODEL', byModel], ['ANA AJAN vs SUBAGENT', byKind]]) {
  console.log(`\n--- ${title} ---`);
  for (const [k, v] of sorted(map)) console.log(line(k, v));
}

if (has('--tools')) {
  console.log('\n--- ARAC BAGLAM CARPANI (compact boundary kesilmis) ---');
  console.log('  carpan = 1 token arac ciktisinin, oturumda kac kez yeniden okundugunun UST SINIRI');
  const rows = [...byTool.entries()]
    .map(([k, v]) => ({ k, calls: v.n, tok: v.in, amp: v.cr, factor: v.in ? v.cr / v.in : 0 }))
    .sort((a, b) => b.amp - a.amp).slice(0, 15);
  console.log('arac'.padEnd(38) + 'cagri'.padStart(7) + 'ham~tok'.padStart(11) + 'carpan'.padStart(9) + 'yeniden-okuma'.padStart(15));
  for (const r of rows)
    console.log(r.k.padEnd(38) + String(r.calls).padStart(7) + Math.round(r.tok).toLocaleString().padStart(11) +
      ('x' + r.factor.toFixed(0)).padStart(9) + (Math.round(r.amp / 1e6) + 'M').padStart(15));
}

console.log('\n--- SON 10 GUN ---');
for (const [k, v] of [...byDay.entries()].sort().slice(-10)) console.log(line(k, v, 12));

console.log('\n' + '='.repeat(96));
console.log(line('TOPLAM (ust sinir)', totals));
console.log('\nBu rakamlari CONTEXT_BUDGET.md hotspot tablosuna yazarken "ust sinir" etiketini KORU.');
console.log('Karar vermeden once A/B olc: degisiklik oncesi ve sonrasi ayni gorev setinde.');
process.exit(0);

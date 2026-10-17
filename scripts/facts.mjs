#!/usr/bin/env node
// FACTS KATMANI (v0.26) — "türetilebilir değer elle yazılmaz" ilkesinin MEKANİZMASI.
//
// NEDEN VAR [ÖLÇÜLDÜ 2026-09-06, 7 repoluk saha denetimi]: kapılar DOĞRU değer üretiyor ama o
// değer elle yazılmış özet tablolara GERİ YAZILMIYOR. pilot-backend: `baseline.json` "1240 test"
// diyor, gerçek koşu 1488 (%20 sapma) — ve bu sayı 11 DOSYAYA yayılmış. Aynı repoda STATE.md
// içinde L0 makale sayısı 118/131/140 olarak ÜÇ FARKLI değerde (hepsi aynı commit'te, hepsi
// "taze" — zaman-tabanlı hiçbir tazelik mekanizması bunu göremez). Kök neden bir CACHE
// INVALIDATION arızasıdır: kapı = origin, özet tablo = cache, aralarında write-through yok.
//
// BU DOSYA YENİ BİR MEKANİZMA DEĞİL — mevcut `scripts/test-count-baseline.json` deseninin
// (SB-15 + SB-19 dersleriyle olgunlaşmış: değer + kaynak-hash + ölçüldü tarihi) GENELLEŞTİRİLMİŞ
// hâlidir. İkinci bir ölçüm platformu kurmak, çözmeye çalıştığı hastalığı üretirdi (dış-model
// uyarısı: "ince adaptör zamanla ikinci bir repo modeline dönüşür").
//
// İKİ SINIF — karıştırılırsa katman çöker:
//   ÖLÇÜM   (measurements): koddan/koşudan TÜRETİLİR. Makine yazar, insan yazamaz.  → burada
//   POLİTİKA (policy):      insan KARARI (tavan, bütçe, eşik). Ölçülemez, türetilemez. → elle
// "SKILL.md 300 satır TAVANI" politikadır (v0.25 K70 kararı); "SKILL.md ŞU AN 300 satır" ölçümdür.
//
// UNKNOWN SEMANTİĞİ (saha-H vakasının panzehiri): o repoda bir analiz deseni %13 → 0 düştü
// çünkü veri şeması değişti ve sistem bunu SESSİZ SIFIR diye okudu. Ölçülemeyen fact burada
// asla 0 dönmez — `status: "unknown"` döner ve kapı bunu "sapma" değil "ölçülemedi" diye raporlar.
//
// Kullanım:
//   node scripts/facts.mjs            → ölç, facts.json'a yaz (dosya = tek kaynak)
//   node scripts/facts.mjs --check    → ölç, YAZMA; facts.json ile karşılaştır (exit 1 = sapma)
//   node scripts/facts.mjs --json     → ölçümü stdout'a JSON yaz (araç entegrasyonu)
//   node scripts/facts.mjs --quick    → pahalı ölçümleri (node --test) ATLA, unknown bırak

import { readdirSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const argv = process.argv.slice(2);
const CHECK = argv.includes('--check');
const JSON_OUT = argv.includes('--json');
const QUICK = argv.includes('--quick');

export const FACTS_PATH = 'facts.json';

const read = (p) => { try { return readFileSync(join(ROOT, p), 'utf8'); } catch { return null; } };
const countIn = (dir, re) => existsSync(join(ROOT, dir))
  ? readdirSync(join(ROOT, dir)).filter(f => re.test(f)).length : 0;

// tests/ içeriğinin özeti — SB-19 dersi: snapshot bayatlayabilir, hash onu TESPİT eder.
// Dar sinyal BİLİNÇLİ: yalnız tests/*.test.mjs içeriği tetikler (her commit'te tetiklenen
// SHA/tarih gibi geniş sinyaller DEĞİL — yanlış-alarm bütçesi).
// Satır sayımı — `wc -l` ile BİREBİR aynı semantik: satır SONU (\n) sayar, son satırda newline
// yoksa onu SAYMAZ. Gerekçe [HAKEM BULGUSU B-1, 2026-09-06]: ilk sürüm `split('\n')` tabanlıydı
// ve SKILL.md newline'sız bittiği için 300 diyordu, `cmd` alanının vaat ettiği `wc -l SKILL.md`
// ise 299. `cmd`'nin var olma gerekçesi "insan elle koşup DOĞRULAYABİLSİN" olduğuna göre,
// doğrulama yolunun doğruladığı değerle çelişmesi bu katmanın savaştığı hatanın ta kendisiydi.
// İki yol artık aynı sayıyı verir; ayrışma yapısal olarak imkânsız.
const countLines = (s) => (s.match(/\n/g) || []).length;

function dirHash(dir, re) {
  const d = join(ROOT, dir);
  if (!existsSync(d)) return null;
  const files = readdirSync(d).filter(f => re.test(f)).sort();
  const h = createHash('sha1');
  for (const f of files) h.update(readFileSync(join(d, f)));
  return h.digest('hex');
}

// ───────────────────────────────────────────────────────────────────────────
// ÖLÇÜCÜLER — her biri { value, cmd, source_hash? } döner ya da null (=ölçülemedi→unknown).
// Bir ölçücü ASLA istisna fırlatmaz ve ASLA "emin olmadığı" bir sayı dönmez; emin değilse null.
// ───────────────────────────────────────────────────────────────────────────
// Her ölçücünün `cmd`'si BURADA da durur: ölçüm başarısız olsa bile "bu nasıl ölçülür"
// bilgisi kaybolmamalı (unknown kaydı da komutu taşır — insan elle koşup doğrulayabilsin).
const CMDS = {
  gate_count: 'ls gates/check-*.mjs | wc -l',
  template_count: 'ls templates/ | wc -l',
  test_count: 'node --test tests/*.test.mjs',
  skill_md_lines: 'wc -l SKILL.md',
  claude_md_lines: 'wc -l CLAUDE.md',
};

const MEASURERS = {
  // Kapı sayısı — fs otoritedir (README "9 kapı" derken gerçekte 16 vardı; bu satırın gerekçesi o).
  gate_count: () => ({ value: countIn('gates', /^check-.*\.mjs$/) }),

  // Şablon sayısı — templates/ altındaki tüm dosyalar.
  template_count: () => ({ value: countIn('templates', /\./) }),

  // Test sayısı — GERÇEK koşudan. grep parametrize (tablo) testleri YAPISAL OLARAK göremez
  // (SB-15: 7'lik bir döngüyü 6 eksik saydı) → tahmin yerine koşu, koşu yoksa unknown.
  // Pahalı (~26 sn): --quick ile atlanır. KIRMIZI koşudan sayı YAZILMAZ (yeşil-kaynak kuralı).
  test_count: () => {
    if (QUICK) return null;
    // Node, `node --test` içinden koşulunca NODE_TEST_CONTEXT'i miras bırakıp iç içe --test'i
    // "rekürsif" sayarak SESSİZCE atlar (stdout boş → parse edilemez). Miras bayrağı temizle.
    const env = { ...process.env }; delete env.NODE_TEST_CONTEXT;
    // SB-9: yalnız tests/ (Alan 2 testleri sayılmaz). Açık dosya listesi: Node 20 --test glob'u açmaz.
    const r = spawnSync('node', ['--test', ...readdirSync(join(ROOT, 'tests')).filter(f => /\.test\.mjs$/.test(f)).sort().map(f => join('tests', f))], { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, env });
    const out = (r.stdout || '') + (r.stderr || '');
    const pass = Number((out.match(/^# pass (\d+)$/m) || [])[1]);
    const fail = Number((out.match(/^# fail (\d+)$/m) || [])[1]);
    if (!Number.isFinite(pass) || fail > 0) return null;   // kırmızı/parse edilemez → unknown
    return { value: pass, source_hash: dirHash('tests', /\.test\.mjs$/) };
  },

  // NOT — `verify_steps` BİLİNÇLİ OLARAK YOK. verify.mjs zaten adım sayısını steps[]'ten
  // TÜRETİP çıktısına yazıyor ("elle yazılmaz: v0.11'de dogfood adımı eklenince sabit 7 drift
  // etmişti", verify.mjs:169). Burada ikinci bir sayaç kurmak, bu katmanın ENGELLEMEK için
  // var olduğu şeyin (aynı olgunun iki bağımsız kaynağı) ta kendisi olurdu. Ayrıca steps[]
  // koşullu spread içerir (selfDocs boşsa adım düşer) → literal sayım YANILTICI olurdu.

  // SKILL.md satır sayısı — ÖLÇÜM. Tavanı (300) POLİTİKA'dır, aşağıda ayrı bölümde.
  skill_md_lines: () => { const s = read('SKILL.md'); return s === null ? null : { value: countLines(s) }; },

  // CLAUDE.md satır sayısı — aynı gerekçe.
  claude_md_lines: () => { const s = read('CLAUDE.md'); return s === null ? null : { value: countLines(s) }; },
};

// POLİTİKA — insan kararı. Bu bölüme ÖLÇÜM yazılmaz; `facts.mjs` bu değerleri ASLA hesaplamaz,
// yalnız taşır (mevcut dosyadan korur). Kaynak: CLAUDE.md satır tavanları + v0.25 K70 kararı.
const DEFAULT_POLICY = {
  skill_md_line_cap: 300,
  claude_md_line_cap: 150,
  role_file_line_cap: 40,
};

export function measure() {
  const measurements = {};
  const today = new Date().toISOString().slice(0, 10);
  for (const [key, fn] of Object.entries(MEASURERS)) {
    let r = null;
    try { r = fn(); } catch { r = null; }   // ölçücü patlarsa unknown — asla sessiz 0
    measurements[key] = r === null
      ? { status: 'unknown', cmd: CMDS[key] ?? null, measured_at: today }
      : { status: 'measured', value: r.value, cmd: CMDS[key] ?? null, ...(r.source_hash ? { source_hash: r.source_hash } : {}), measured_at: today };
  }
  return measurements;
}

// Mevcut facts.json'u oku (yoksa null). Bozuksa null — sessiz kırılma yerine yeniden üretim.
export function readFacts() {
  const raw = read(FACTS_PATH);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

// facts.json'daki kaydın kaynağı DEĞİŞTİ mi (SB-19 snapshot körlüğü)? Yalnız source_hash
// taşıyan fact'ler için anlamlı; taşımayanlar her koşuda yeniden ölçüldüğü için bayatlayamaz.
export function staleFacts(facts) {
  const out = [];
  const m = facts?.measurements || {};
  if (m.test_count?.source_hash) {
    const now = dirHash('tests', /\.test\.mjs$/);
    if (now && now !== m.test_count.source_hash) out.push('test_count');
  }
  return out;
}

function main() {
  const measurements = measure();
  const prev = readFacts();
  const doc = {
    _sozlesme: 'ÖLÇÜM makine yazar (measurements), POLİTİKA insan yazar (policy). Elle düzenleme: yalnız policy.',
    generated_by: 'scripts/facts.mjs',
    measurements,
    policy: prev?.policy || DEFAULT_POLICY,
  };

  if (JSON_OUT) { console.log(JSON.stringify(doc, null, 2)); return 0; }

  if (CHECK) {
    if (!prev) { console.error(`facts --check: ${FACTS_PATH} yok — önce \`npm run facts\` koş.`); return 1; }
    const sapma = [];
    for (const [k, cur] of Object.entries(measurements)) {
      const old = prev.measurements?.[k];
      if (!old) { sapma.push(`${k}: ${FACTS_PATH}'da KAYITSIZ (yeni ölçüm: ${cur.status === 'measured' ? cur.value : 'unknown'})`); continue; }
      if (cur.status === 'unknown') continue;                    // ölçülemedi ≠ sapma
      if (old.status === 'measured' && old.value !== cur.value)
        sapma.push(`${k}: kayıtlı ${old.value} · ölçüm ${cur.value} (Δ${cur.value > old.value ? '+' : ''}${cur.value - old.value})`);
    }
    const bayat = staleFacts(prev);
    for (const k of bayat) sapma.push(`${k}: kaynak DEĞİŞTİ, kayıt yeniden ölçülmemiş (source_hash uyuşmuyor)`);
    if (sapma.length === 0) { console.log(`facts --check OK — ${FACTS_PATH} ölçümle uyumlu.`); return 0; }
    console.error(`\nFACTS SAPMASI (${sapma.length}):\n` + sapma.map(s => `  • ${s}`).join('\n') +
      `\n\n  \`npm run facts\` ölçümü yeniden yazar (POLİTİKA bölümüne dokunmaz).\n`);
    return 1;
  }

  writeFileSync(join(ROOT, FACTS_PATH), JSON.stringify(doc, null, 2) + '\n');
  const özet = Object.entries(measurements)
    .map(([k, v]) => `${k}=${v.status === 'measured' ? v.value : 'UNKNOWN'}`).join(' · ');
  console.log(`${FACTS_PATH} yazıldı — ${özet}`);
  return 0;
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('facts.mjs'))
  process.exit(main());

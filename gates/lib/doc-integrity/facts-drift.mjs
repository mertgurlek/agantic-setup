// RULE: facts-drift (v0.26) — dokümandaki ÖLÇÜM iddiası ile gerçek ölçüm arasındaki DELTA.
//
// NEDEN VAR [ÖLÇÜLDÜ 2026-09-06, 7 repoluk saha denetimi]: kapılar doğru değer üretiyor ama o
// değer elle yazılmış özet tablolara geri yazılmıyor. pilot-backend: "1240 test" iddiası 11
// DOSYAYA yayılmış, gerçek koşu 1488 (%20). Aynı repoda tek bir STATE.md içinde L0 sayısı
// 118/131/140 — üç farklı değer, hepsi aynı commit'te, hepsi "taze". Zaman-tabanlı hiçbir
// tazelik mekanizması bunu göremez; yalnız İDDİA↔ÖLÇÜM karşılaştırması görür.
//
// NE YAPAR: `<!--fact:KEY-->DEĞER<!--/fact-->` işaretli her hücreyi `facts.json`'daki ölçümle
// karşılaştırır. Sapma varsa DELTA raporlar: "iddia 547 · ölçüm 550 (Δ+3)".
//
// NEDEN YAŞ DEĞİL DELTA: beş bağımsız dış model (Grok 4.6 · GLM 5.3 · Kimi K3 · GPT-6-Astra ·
// Fable 5.1) ham yaş enjeksiyonunu ("47 commit eski") REDDETTİ — yaş zayıf sinyaldir, eski ≠
// yanlış. Delta ise eyleme dönüştürülebilir çelişkidir.
//
// UNKNOWN ≠ SAPMA (saha-H vakasının panzehiri): o repoda bir analiz deseni %13 → 0 düştü
// çünkü veri şeması değişti ve sistem bunu sessiz sıfır sandı. Burada ölçülemeyen fact
// "sapma" sayılmaz — ayrı bir NOT bloğunda "ölçülemedi" olarak GÖRÜNÜR kalır (MADDE 15/16'nın
// "atlanan görünür olmalı" dersi).
//
// SINIF: opt-in-artefakt. İşaretsiz doküman = no-op; `facts.json` yoksa = no-op (kurulum
// yapılmamış hedef repo yeni FAIL görmez — MADDE 17'nin geriye-uyumluluk dersi).
// Varsayılan UYARI (exit 0), `--strict` ile FAIL (exit 1).
//
// SINIR (dürüstlük kaydı): yalnız İŞARETLİ hücreleri görür. Dokümandaki çıplak "550 test"
// yazısı bu kapının GÖRÜŞ ALANI DIŞINDADIR — işaretlemek insan/kurulum işidir. Bu kapı
// "işaretlenmiş olanı taze tutar", "her sayıyı bulur" DEĞİL.

import { readFileSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { join } from 'node:path';

// ROOT = ÇAĞRILDIĞI dizin (process.cwd()), kapının kendi konumu DEĞİL. Gerekçe: bu kapı
// HEDEF repoda koşar — kurulu skill'in gates/ dizini hedef reponun içindedir ve hedef reponun
// kökü cwd'dir. (Diğer alt-kurallar da aynı sözleşmeyi kullanır; test fixture'ları geçici
// dizinde koştuğu için bu ayrım testlerde de zorunludur.)
const ROOT = process.cwd();

// İşaret sözdizimi — DEĞER içinde markdown vurgusu (**550**) olabilir.
// KAÇIŞ: satır-içi kod (`...`) içindeki işaret ÖRNEKTİR, iddia değildir. Bu kapının KENDİ
// CONTRACT satırı bir örnek taşıyor ve ilk sürümde kendi dokümantasyonunu "kayıtsız iddia"
// sanıp yanlış-alarm verdi (ölçüldü 2026-09-06, kurulduğu gün) — dogfood'un yakaladığı kusur.
const FACT_RE = /<!--\s*fact:([A-Za-z0-9_.-]+)\s*-->([\s\S]*?)<!--\s*\/fact\s*-->/g;
// Backtick içindeki bölgeleri maskeler (uzunluk korunur → offset kayması olmaz).
const maskCode = (s) => s.replace(/`[^`\n]*`/g, (m) => ' '.repeat(m.length));

function trackedMd() {
  try {
    return execSync('git ls-files "*.md"', { cwd: ROOT, encoding: 'utf8' })
      .split('\n').filter(Boolean);
  } catch { return []; }
}

export function runFactsDrift(args = []) {
  const strict = args.includes('--strict');
  const factsArg = args.find(a => a.startsWith('--facts='));
  const factsPath = factsArg ? factsArg.slice('--facts='.length) : 'facts.json';
  const files = args.filter(a => !a.startsWith('--'));

  const abs = join(ROOT, factsPath);
  if (!existsSync(abs)) {
    console.log(`Facts-drift OK — ${factsPath} yok (opt-in: kurulum yapılmamış repo, no-op).`);
    return 0;
  }
  let facts;
  try { facts = JSON.parse(readFileSync(abs, 'utf8')); } catch {
    console.error(`facts-drift: ${factsPath} okunamadı/bozuk — ölçüm kaynağı güvenilmez.`);
    return strict ? 1 : 0;
  }
  const m = facts?.measurements || {};

  const targets = files.length ? files : trackedMd();
  const sapma = [];      // gerçek drift
  const bilinmeyen = [];  // ölçülemedi — GÖRÜNÜR ama FAIL değil
  const kayitsiz = [];    // dokümanda işaret var, facts.json'da karşılığı yok
  let taranan = 0, hucre = 0;

  for (const f of targets) {
    let raw;
    try { raw = readFileSync(join(ROOT, f), 'utf8'); } catch { continue; }
    if (!raw.includes('<!--fact:') && !raw.includes('<!-- fact:')) continue;
    const src = maskCode(raw);                       // kod-içi örnekler iddia sayılmaz
    if (!/<!--\s*fact:/.test(src)) continue;         // dosyadaki TÜM işaretler örnekmiş
    taranan++;
    FACT_RE.lastIndex = 0;
    let mt;
    while ((mt = FACT_RE.exec(src)) !== null) {
      hucre++;
      const key = mt[1];
      const iddiaHam = mt[2];
      const iddia = Number((iddiaHam.match(/-?\d+(?:[.,]\d+)?/) || [])[0]?.replace(',', '.'));
      const rec = m[key];
      if (!rec) { kayitsiz.push(`${f}: <!--fact:${key}--> facts.json'da KAYITSIZ`); continue; }
      if (rec.status !== 'measured') { bilinmeyen.push(`${f}: ${key} ölçülemedi (${rec.cmd || 'komut kayıtsız'})`); continue; }
      if (!Number.isFinite(iddia)) { kayitsiz.push(`${f}: <!--fact:${key}--> hücresinde sayı yok ("${iddiaHam.trim().slice(0, 30)}")`); continue; }
      if (iddia !== rec.value) {
        const d = rec.value - iddia;
        sapma.push(`${f}: ${key} — iddia ${iddia} · ölçüm ${rec.value} (Δ${d > 0 ? '+' : ''}${d})`);
      }
    }
  }

  // NOT — SB-19 "snapshot körlüğü" (kayıtlı source_hash ≠ güncel hash) denetimi BURADA DEĞİL,
  // `scripts/facts.mjs --check` içindedir. Gerekçe: hash'i doğrulamak kaynağı (tests/) yeniden
  // özetlemeyi gerektirir; bu kapı DOKÜMAN↔facts.json karşılaştırmasıdır, ölçüm koşucusu değil.
  // İki yerde ölçmek, bu katmanın engellemek için var olduğu şeyi (aynı olgunun iki kaynağı)
  // üretirdi. `npm run facts:check` bayat kaydı yakalar; bu kapı bayat DOKÜMANI yakalar.

  const notlar = [];
  if (bilinmeyen.length) notlar.push(`  ÖLÇÜLEMEDİ (${bilinmeyen.length}, sapma DEĞİL):\n` + bilinmeyen.map(s => `    - ${s}`).join('\n'));
  if (kayitsiz.length) notlar.push(`  KAYITSIZ İŞARET (${kayitsiz.length}):\n` + kayitsiz.map(s => `    - ${s}`).join('\n'));

  if (sapma.length) {
    const msg = `\nFACTS-DRIFT (${sapma.length} sapma):\n` + sapma.map(s => `  • ${s}`).join('\n')
      + (notlar.length ? '\n\n' + notlar.join('\n') : '')
      + `\n\n  • Bu sayı ELLE yazılmamalı — \`npm run facts\` ölçer, doküman işaretli hücreden okur.`
      + `\n  • Ölçüm değiştiyse dokümanı güncelle; doküman doğruysa ölçümü tazele.\n`;
    if (strict) { console.error(msg + '(--strict: commit bloke edildi)\n'); return 1; }
    console.warn(msg);
    return 0;
  }

  if (notlar.length) console.warn(`\nFacts-drift — sapma yok, ancak:\n` + notlar.join('\n') + '\n');
  console.log(`Facts-drift OK — ${taranan} işaretli doküman · ${hucre} fact hücresi; iddia↔ölçüm sapması yok.`);
  return 0;
}

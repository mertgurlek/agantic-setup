#!/usr/bin/env node
// brainstorm.mjs — çoklu-model beyin fırtınası ORKESTRATÖRÜ (v0.19).
//
// NEDEN VAR: protokol (`reference/coklu-model-beyin-firtinasi.md`) iki pilot koşusunda ELLE
// yürütüldü ve her ikisinde de en kritik kararı moderatör verdi (tur sorusunu yazmak, panelist
// elemek). Protokolün KENDİ bulgusu bu takdiri kaldırmaktı — 7 panelistin 4'ü moderatör elemesini
// "en bozuk parça" saydı. Bu script o takdiri KODA çevirir: eleme yok, tur sorusu sabit şablon,
// DUR kararı etiket matrisinin diff'i.
//
// KİMLİK — bu bir KAPI DEĞİL, ORKESTRATÖRDÜR: insan çağırır, kendi kendine koşmaz (repo kimliği:
// runtime motoru değil). İki yerde İNSAN KAPISI vardır: (1) panel+maliyet onayı — para harcanacak,
// (2) DEĞERSİZ formu — koşunun işe yarayıp yaramadığını insan işaretler. Arada müdahale YOKTUR;
// aradaki her müdahale moderatör biasıdır.
//
// 🔴 SCRIPT LLM YORUMU YAPMAZ. Sentez/özet/"hangisi daha iyi" için MODEL ÇAĞIRMAZ. Yalnız: çağrı
// yapar, etiket sayar, substring doğrular, dosya yazar. Gerekçe: sentez için LLM çağırmak, protokolün
// kaldırdığı moderatör biasını koda GÖMERDİ. Yorum isteyen insan ham cevapları okur.
//
// Kullanım: node scripts/brainstorm.mjs --brief <yol> [--panel=<id,id,...>] [--max-tur=N] [--dry-run] [--json]
//   --brief    ZORUNLU. Brief dosyası (kasif + web-kasif çıktısından ÇAĞIRAN birleştirir).
//   --panel    virgüllü model ID listesi. Verilmezse: PANEL_ONERI (aşağıda) + canlı ID doğrulaması.
//   --max-tur  çapraz eleştiri tavanı (varsayılan 4 — protokol sabiti).
//   --dry-run  hiç çağrı yapmaz; panel/maliyet/akış planını yazar (test + maliyet önizleme).
//   --json     makine-okur özet.
//
// Çıkış kodları (CONTRACT ortak sözleşmesi):
//   0 = koşu tamam · 1 = ihlal (aile çakışması / alıntı kapısı fail / brief eksik)
//   2 = BRIEF_BOZUK (tur 1'de tam yakınsama — hata DEĞİL, BULGU: brief anchor'lıyor)

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';
import { createInterface } from 'node:readline';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const argv = process.argv.slice(2);

const flag = (n) => argv.includes(n);
const val = (n, d = null) => {
  const hit = argv.find((a) => a.startsWith(`${n}=`));
  if (hit) return hit.slice(n.length + 1);
  const i = argv.indexOf(n);
  return i !== -1 && argv[i + 1] && !argv[i + 1].startsWith('-') ? argv[i + 1] : d;
};

const BRIEF = val('--brief');
const DRY = flag('--dry-run');
const JSON_OUT = flag('--json');
const MAX_TUR = Math.max(2, Number(val('--max-tur', 4)));
const RUNNER = join(homedir(), '.claude', 'scripts', 'openrouter-run.mjs');

// Panel önerisi: AİLE listesi — ID DEĞİL. ID'ler openrouter-models.mjs ile canlı çözülür.
// Protokol kuralı: ölçüt "farklı sağlayıcı" değil "farklı AİLE" (aynı ailenin iki modeli tek
// panelist sayılır — kör noktaları ortak). Moderatörün kendi ailesi (anthropic) panele GİRMEZ.
// moonshotai ÇIKARILDI (2026-09-30 maliyet kararı: Kimi K3 çağrı başına ~1,27 $; global wrapper'lar
// bu aileyi zaten exit 3 ile reddediyor — öneri listesinde kalması ölü öneriydi, SB-25).
const PANEL_ONERI = ['z-ai', 'google', 'openai', 'x-ai', 'qwen', 'mistralai'];

const die = (kod, msg) => { console.error(`HATA: ${msg}`); process.exit(kod); };
const log = (s = '') => { if (!JSON_OUT) console.log(s); };

// ---------------------------------------------------------------- aile çeşitliliği (E0 kapı)
// Aynı aileden iki panelist = tek panelist. Bu kural KODA gömülüdür, moderatör takdiri değil.
export function aileAyikla(id) { return String(id).split('/')[0].toLowerCase(); }

export function ceshitlilikDenetle(ids) {
  const gorulen = new Map();
  const cakisma = [];
  for (const id of ids) {
    const a = aileAyikla(id);
    if (gorulen.has(a)) cakisma.push({ aile: a, ilk: gorulen.get(a), ikinci: id });
    else gorulen.set(a, id);
  }
  return { temiz: cakisma.length === 0, cakisma, aileSayisi: gorulen.size };
}

// ---------------------------------------------------------------- etiket matrisi
// Panelist cevabının içinden `@<hedef>: aynıyım|kısmen ayrı|tamamen ayrı` satırlarını çeker.
// Etiket AYRI ÇAĞRI DEĞİL, aynı cevabın zorunlu alanı — 7 panelistte ayrı çağrı N× maliyet demek.
const ETIKET_RE = /^@(\S+)\s*:\s*(aynıyım|kısmen ayrı|tamamen ayrı)\s*$/gim;

export function etiketleriAyikla(metin) {
  const out = {};
  for (const m of String(metin).matchAll(ETIKET_RE)) out[m[1]] = m[2];
  return out;
}

export function matrisKur(cevaplar) {
  const m = {};
  for (const [kim, metin] of Object.entries(cevaplar)) m[kim] = etiketleriAyikla(metin);
  return m;
}

// DUR kararının TEK kaynağı: matris iki tur üst üste aynıysa yeni argüman zaten yoktur.
// "yeni argüman var mı" diye MODELE SORMAK ya da moderatörün yargılaması YASAK — ikisi de takdir.
export function matrisAyni(a, b) {
  if (!a || !b) return false;
  const ka = Object.keys(a).sort(), kb = Object.keys(b).sort();
  if (ka.join('|') !== kb.join('|')) return false;
  return ka.every((k) => {
    const ra = a[k] || {}, rb = b[k] || {};
    const ia = Object.keys(ra).sort(), ib = Object.keys(rb).sort();
    return ia.join('|') === ib.join('|') && ia.every((i) => ra[i] === rb[i]);
  });
}

// Erken yakınsama = BRIEF BOZUK sinyali. Panel yeniden koşulmaz, brief revize edilir.
// (Taslakta "bir tur daha zorla" idi; panelin 4/7'si bağımsız çürüttü: modeller "devam et"
// komutunu itaatle karşılayıp SAHTE ayrışma uydurur.)
export function tamYakinsama(matris) {
  const hepsi = Object.values(matris).flatMap((r) => Object.values(r));
  return hepsi.length > 0 && hepsi.every((v) => v === 'aynıyım');
}

// Ayrışma eksenleri MEKANİK çıkar: en çok "tamamen ayrı" etiketi alan çiftler.
export function eksenleriCikar(matris) {
  const ciftler = [];
  for (const [kim, satir] of Object.entries(matris)) {
    for (const [hedef, etiket] of Object.entries(satir)) {
      if (etiket === 'tamamen ayrı') {
        const anahtar = [kim, hedef].sort().join(' ↔ ');
        const v = ciftler.find((c) => c.cift === anahtar);
        if (v) v.oy++; else ciftler.push({ cift: anahtar, oy: 1 });
      }
    }
  }
  return ciftler.sort((a, b) => b.oy - a.oy);
}

// ---------------------------------------------------------------- alıntı-bütünlüğü kapısı
// Her iddia ham cevabın SUBSTRING'i olmalı. "Başlıkları doğru ama içi boş" sentezi mekanik eler.
// DÜRÜST SINIR: bu kapı TEMBEL moderatörü yakalar, YETKİN biası yakalamaz — gerçek alıntılar
// seçilip bağlam bükülebilir (cherry-picking substring testinden geçer). Bkz. protokol §zayıflıklar.
const NORM = (s) => String(s).replace(/\s+/g, ' ').trim();

export function alintiDogrula(alintilar, hamCevaplar) {
  const havuz = Object.values(hamCevaplar).map(NORM);
  const kirik = alintilar.filter((a) => {
    const n = NORM(a);
    return n.length > 0 && !havuz.some((h) => h.includes(n));
  });
  return { temiz: kirik.length === 0, kirik };
}

// ---------------------------------------------------------------- dış çağrı (tek yer)
function modelCagir(model, prompt) {
  if (DRY) return `[DRY-RUN] ${model} çağrılmadı.`;
  const r = spawnSync(process.execPath, [RUNNER, '-m', model, '-'], {
    input: prompt, encoding: 'utf8', timeout: 600000, maxBuffer: 32 * 1024 * 1024,
  });
  if (r.status !== 0) return `[HATA] ${model}: ${String(r.stderr || '').slice(-400)}`;
  // Ayraç sonrası nihai mesaj; ayraç yoksa ham stdout.
  const s = String(r.stdout || '');
  const i = s.indexOf('===OPENROUTER-FINAL===');
  return i === -1 ? s.trim() : s.slice(s.indexOf('\n', i) + 1).trim();
}

// Anonimleştirme: panelist adı yerine sabit etiket. Elle `sed` kırılgandı — burada tek yerde.
export function anonimAd(i) { return `ONERI-${String.fromCharCode(65 + i)}`; }

// SESSİZ DÜŞME AVCISI (v0.19 — ilk canlı koşuda YAKALANDI: kimi-k3 + qwen3.8-max boş döndü,
// script "(boş yanıt)" yazıp devam etti. Diğer panelistler o BOŞ cevaba "tamamen ayrı" etiketi
// verdi → ayrışma haritasında SAHTE eksen. Script insana "7 panelist" derken gerçekte 5 koşmuştu.)
// Protokolün kendi ilkesi: boşluk sessiz kalmaz, UYDURMAYLA dolar. Düşen panelist panelden ÇIKAR.
const DUSUK_ESIK = 200; // karakter — bu altı "cevap" değil, gürültü.
export function cevapGecerli(metin) {
  const s = String(metin || '').trim();
  if (s.length < DUSUK_ESIK) return false;
  if (/^\[HATA\]/.test(s) || /^\(boş yanıt\)$/.test(s)) return false;
  return true;
}

// SABİT çapraz eleştiri şablonu. MODERATÖR SORU YAZMAZ — protokolün 2/7 "en bozuk parça" bulgusu
// buydu: turun kalitesini moderatörün elle yazdığı soru belirliyordu, bu mekanizma değil UMUTTU.
function caprazPrompt(benimAd, digerleri, tur) {
  const bloklar = Object.entries(digerleri)
    .map(([ad, metin]) => `## ${ad}\n${metin}`).join('\n\n');
  const etiketHedef = Object.keys(digerleri).map((a) => `@${a}: <aynıyım|kısmen ayrı|tamamen ayrı>`).join('\n');
  return `# TUR ${tur} — ÇAPRAZ ELEŞTİRİ

Aşağıda diğer danışmanların ANONİM önerileri var. Hangisinin kim olduğu söylenmiyor; biri senin
olabilir. Yazarı tahmin etme — argümana bak.

Amaç uzlaşmak DEĞİL. Yapay "hemfikiriz" cevabı bu turu değersiz kılar. İkna olduysan fikir
değiştirmek meşrudur ve kaydedilir; ikna olmadıysan pozisyonunu korumak da öyle.

${bloklar}

---
## ÇIKTI FORMATI (bu başlıklarla)

**POZİSYON** — \`korudum\` | \`değiştirdim\` | \`kısmen değiştirdim\`. Değiştirdiysen neyi, hangi argüman yüzünden.
**İTİRAZ** — hangi SPESİFİK noktada itiraz ediyorsun, gerekçesi ne.
**ETİKET** — her öneri için TEK SATIR, aynen bu biçimde (zorunlu, eksikse cevap geçersiz):
${etiketHedef}

En fazla ~500 kelime. Madde madde, dolgu yok.`;
}

// ---------------------------------------------------------------- insan kapısı
async function onayIste(soru) {
  if (DRY || flag('--onaylandi')) return true;
  if (!process.stdin.isTTY) die(1,
    'Bu koşu para harcayacak ve onayı soracak bir terminal yok.\n' +
    '  → Onayı zaten verdiysen: --onaylandi ekle. Önce planı görmek istersen: --dry-run.');
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const c = await new Promise((res) => rl.question(`${soru} [e/H] `, res));
  rl.close();
  return /^(e|evet|y|yes)$/i.test(c.trim());
}

// ---------------------------------------------------------------- ana akış
async function main() {
  if (!BRIEF) die(1, '--brief <yol> zorunlu. Brief olmadan panel koşmaz (girdi eşitliği ilkesi).');
  const briefYol = resolve(process.cwd(), BRIEF);
  if (!existsSync(briefYol)) die(1, `brief bulunamadı: ${briefYol}`);
  const brief = readFileSync(briefYol, 'utf8');

  // Panel: ID'ler CANLI çözülür ya da elle verilir. Hafızadan ID yazmak YASAK (repo kuralı).
  const panelArg = val('--panel');
  if (!panelArg) {
    log('Panel ID verilmedi. Canlı listeden seç ve --panel ile ver:');
    log(`  node ~/.claude/scripts/openrouter-models.mjs <aile>   # aileler: ${PANEL_ONERI.join(', ')}`);
    log('  node scripts/brainstorm.mjs --brief b.md --panel=<id1>,<id2>,...');
    die(1, '--panel zorunlu (ID uydurma yasağı: canlı listeden çöz).');
  }
  const panel = panelArg.split(',').map((s) => s.trim()).filter(Boolean);
  if (panel.length < 2) die(1, 'panel en az 2 model ister.');

  const ces = ceshitlilikDenetle(panel);
  if (!ces.temiz) {
    for (const c of ces.cakisma) console.error(`  AİLE ÇAKIŞMASI [${c.aile}]: ${c.ilk} ↔ ${c.ikinci}`);
    die(1, 'aynı aileden iki panelist = tek panelist (kör noktaları ortak). Paneli düzelt.');
  }

  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const runDir = join(ROOT, 'runs', ts);
  log(`\nBEYİN FIRTINASI — ${panel.length} panelist / ${ces.aileSayisi} aile`);
  log(`  brief : ${briefYol}`);
  log(`  çıktı : runs/${ts}/`);
  log(`  panel : ${panel.join(', ')}`);
  log(`  tavan : ${MAX_TUR} tur${DRY ? '   [DRY-RUN — çağrı yapılmayacak]' : ''}`);

  // İNSAN KAPISI 1 — para harcanacak.
  if (!DRY && !(await onayIste(`\n${panel.length} panelist × en fazla ${MAX_TUR} tur koşulacak. Devam?`))) {
    log('İptal edildi.'); process.exit(0);
  }
  if (!DRY) mkdirSync(runDir, { recursive: true });
  const yaz = (ad, icerik) => { if (!DRY) writeFileSync(join(runDir, ad), icerik, 'utf8'); };

  // --- Tur 1: KÖR. Herkes bağımsız, kimse kimseyi görmez (anchoring engeli).
  log('\nTur 1 (kör)…');
  const cevaplar = {};
  const dusen = [];
  const canliPanel = [];
  const r1 = panel.map((m) => ({ m, out: modelCagir(m, brief) }));
  r1.forEach(({ m, out }, i) => {
    yaz(`r1-${aileAyikla(m)}.md`, out);
    // Düşen panelist PANELDEN ÇIKAR — boş cevabı turlarda taşımak sahte ayrışma üretir.
    if (!DRY && !cevapGecerli(out)) { dusen.push({ model: m, ad: anonimAd(i) }); return; }
    cevaplar[anonimAd(canliPanel.length)] = out;
    canliPanel.push(m);
  });
  if (dusen.length) {
    log(`\n  ${dusen.length} panelist cevap vermedi ve panelden ÇIKARILDI:`);
    for (const d of dusen) log(`    ${d.model} — boş/hatalı yanıt`);
    log('    → Ham dosyaları runs/ altında; sebebini görmek istersen oraya bak.');
    log(`    → Panel ${canliPanel.length} kişiye düştü; harita bu sayıyla üretilecek.`);
  }
  if (canliPanel.length < 2) die(1,
    'Panelde 2\'den az geçerli cevap kaldı; ayrışma haritası üretilemez.\n' +
    '  → Model kimliklerini ve OpenRouter kredini kontrol edip yeniden koş.');
  panel.length = 0; panel.push(...canliPanel);

  // Brief kanaryası: bir panelist (dönüşümlü — ilk) soruyu DEĞİL, brief'in yönlendirmesini yanıtlar.
  // Pilotun ölçülmüş zaafı buydu ve protokolde bunu yakalayan mekanizma YOKTU.
  const kanarya = modelCagir(panel[0],
    `${brief}\n\n---\nYUKARIDAKİ BRIEF'İ CEVAPLAMA. Tek soru: bu brief hangi cevabı İTİYOR? ` +
    `Hangi varsayımı sorgulatmadan kabul ettiriyor? En fazla 150 kelime.`);
  yaz('kanarya.md', kanarya);
  log('  kanarya alındı.');

  // --- Çapraz eleştiri turları: matris DUR diyene kadar.
  let oncekiMatris = null, matris = null, tur = 1, durNeden = null;
  while (tur < MAX_TUR) {
    tur++;
    log(`Tur ${tur} (çapraz eleştiri)…`);
    const yeni = {};
    for (const [i, m] of panel.entries()) {
      const ben = anonimAd(i);
      const digerleri = Object.fromEntries(Object.entries(cevaplar).filter(([k]) => k !== ben));
      yeni[ben] = modelCagir(m, caprazPrompt(ben, digerleri, tur));
      yaz(`r${tur}-${aileAyikla(m)}.md`, yeni[ben]);
    }
    Object.assign(cevaplar, yeni);
    matris = matrisKur(yeni);
    yaz(`matris-r${tur}.json`, JSON.stringify(matris, null, 2));

    if (tur === 2 && tamYakinsama(matris)) { durNeden = 'BRIEF_BOZUK'; break; }
    if (matrisAyni(matris, oncekiMatris)) { durNeden = 'matris-sabit'; break; }
    oncekiMatris = matris;
  }
  if (!durNeden) durNeden = 'tavan';

  // --- Ayrışma haritası: MEKANİK. Script yorum yazmaz, sayar.
  const eksenler = matris ? eksenleriCikar(matris) : [];
  const harita = [
    `# Ayrışma Haritası — ${ts}`, '',
    `**Panel:** ${panel.join(' · ')} (${panel.length} panelist)`,
    dusen.length
      ? `⚠ **${dusen.length} panelist cevap vermedi ve panelden çıkarıldı:** ${dusen.map((d) => d.model).join(', ')} — harita ${panel.length} cevaba dayanıyor.`
      : '',
    `**Tur:** ${tur} · **DUR sebebi:** \`${durNeden}\``,
    `**Statü: karar DEĞİL, girdi.** Yakınsama kanıt sayılmaz — ortak eğitim biası olabilir.`, '',
    '## Ayrışma eksenleri (etiket matrisinden MEKANİK)', '',
    eksenler.length
      ? eksenler.map((e) => `- ${e.cift} — "tamamen ayrı" ×${e.oy}`).join('\n')
      : '- (yok) ⚠ Sıfır ayrışma = bu danışma boşa gitti. Brief\'e dön.',
    '', '## Brief kanaryası', '', kanarya, '',
    '## Ham cevaplar', '',
    `Dokunulmadan \`runs/${ts}/\` altında. Moderatör yorumu bu dosyada YOKTUR —`,
    'script LLM çağırmaz. Yorum isteyen ham dosyaları okur.', '',
    '## DEĞERSİZ formu (İNSAN doldurur)', '',
    '- (a) Haritadan karara taşınan soru sayısı: ____',
    '- (b) Brief\'te olmayıp kırılan varsayım sayısı: ____',
    '- (a)+(b)=0 ise bu koşu `DEĞERSİZ` etiketiyle arşivlenir.',
  ].join('\n');
  yaz('ayrisma-haritasi.md', harita);

  if (durNeden === 'BRIEF_BOZUK') {
    log('\n⚠ BRIEF_BOZUK — tur 1\'de tam yakınsama. Panel yeniden KOŞULMAZ; brief anchor\'lıyor, revize et.');
    if (JSON_OUT) console.log(JSON.stringify({ durNeden, tur, eksenler, runDir }, null, 2));
    process.exit(2);
  }

  log(`\nTAMAM — ${tur} tur, ${eksenler.length} ayrışma ekseni. DUR: ${durNeden}`);
  log(`  harita: runs/${ts}/ayrisma-haritasi.md`);
  log('  ⚠ DEĞERSİZ formunu doldur — protokolün kendi faydası ancak böyle ölçülür.');
  if (JSON_OUT) console.log(JSON.stringify({ durNeden, tur, eksenler, runDir }, null, 2));
}

// Test edilebilirlik: saf fonksiyonlar yukarıda export edilir, ana akış yalnız doğrudan
// çağrıldığında koşar (dış çağrı içerdiği için birim testi saf mantığı hedefler).
if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  main().catch((e) => die(1, e?.message || String(e)));
}

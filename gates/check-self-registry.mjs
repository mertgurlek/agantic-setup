#!/usr/bin/env node
// Self-registry kategori kapısı. Alt-kurallar: aşağıdaki RULES[]; sözleşme: CONTRACT.md "Kapı kayıt tablosu".
// ORTAK EKSEN: paketin kendi kayıt sağlığı + UI-tripwire — üçü de "bir şeyin sessizce
// kaybolması/kayıt-dışı kalması" sınıfına karşı VARLIK kontrolü yapar (rule-contracts: doktrin
// cümlesi silinemez; orphan-gates: kurulu kapı kayıtsız kalamaz; design-tokens: UI'da tasarım
// sözleşmesi sessizce yok sayılamaz).
//
//
// Kullanım:
//   node check-self-registry.mjs                              → argümansız: RULES[]'teki TÜM alt-kurallar koşar
//   node check-self-registry.mjs --rule=rule-contracts [--strict] [--table=<json>]
//   node check-self-registry.mjs --rule=orphan-gates [--strict] [--dir=<kapı-dizini>[,..]]
//   node check-self-registry.mjs --rule=install-version   (warn-only; çıkış kodu DAİMA 0)
//   node check-self-registry.mjs --rule=design-tokens [--strict] [dosya...]
import { execSync } from 'node:child_process';
import { readFileSync, readdirSync, existsSync, writeFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { homedir } from 'node:os';

const RULES = ['rule-contracts', 'orphan-gates', 'design-tokens', 'install-version'];

// =====================================================================================
// RULE: rule-contracts
// =====================================================================================
const BUILTIN_RULE_CONTRACTS = [
  { file: 'SKILL.md', headings: ['## ALTIN KURAL'], patterns: [
    // v0.18.0 K33: kimlik "kurulum süreci" → "360° repo zekâsı" genişletildi (kullanıcı kararı).
    // Kapı ARTIK beş-vaat omurgasını zorlar (kur·kanıtla·güncel tut·yükselt·iyileştir) —
    // eski /KURULUM SÜRECİ/ deseni kimlik değiştiği için düştü, ama korunan invariant AYNI:
    // kimlik cümlesi sessizce erimesin + runtime-motoru reddi ayakta kalsın (sonraki satır).
    ['kimlik: 360° repo zekâsı', /REPO ZEK[ÂA]SI/i],
    ['kimlik: yaşam-döngüsü vaadi', /GÜNCEL TUT|güncel tut/],
    ['kimlik: runtime-motoru reddi', /runtime motoru|runtime KURMAZ/],
    ['dürüstlük ilkesi', /Emin değilsen yazma — ölç ya da atla/],
    // v0.28 K76 (hakem U4): kurulum ajanının FİİLEN okuduğu ADIM 0 cümlesi. Yalnız doktrini korumak
    // yetmez — eski "Node'suz repoya kapı KURMA" cümlesi buraya geri yazılırsa davranış geri döner.
    ['kurulum: node makinede aranır (D-34)', /ARACIN bağımlılığıdır/],
  ] },
  { file: 'CLAUDE.md', headings: ['## Süreç kuralları'], patterns: [
    ['dogfood yasası', /Mekanizması olmayan kural\s+gürültüdür/],
    ['şüphecilik: dalkavukluk yasağı', /dalkavukluk yasak/i],
    ['şüphecilik: bilmiyorum hakkı', /"bilmiyorum" de/],
    ['sürüm-gerçeği disiplini', /sürüm-gerçeği/i],
    ['devir dosyası kuralı', /devir dosyası/i],
  ] },
  { file: 'reference/doctrine.md', headings: ['## Bilimsel çalışma disiplini'], patterns: [
    ['öğrenme sınırı: öneri-üret insan onayla', /kendine onaylatamaz/],
    // v0.20 (pilot geri bildirimi 2026-08-11) — dört kanıt/zamanlama yasası. Hepsi NESİR
    // kuralıdır (E2/hakem uygular); bu kapı yalnız cümlenin SESSİZCE SİLİNMESİNİ engeller.
    ['kanıt: türetilmiş katman kanıt değildir', /Türetilmiş katman YÖN GÖSTERİR, KANIT DEĞİLDİR/],
    ['kanıt: bir seviye alt kuralı', /çağırdığı BİR SEVİYE ALT/],
    ['kanıt: ölçüm talimatı yener', /ÖLÇÜM TALİMATI YENER/],
    ['zamanlama: kendi şemanın kapısı aynı commit', /kapısı AYNI commit'te doğar/],
    ['zamanlama: iki-yönlü kapı doğumu', /geçirme kontrolü/],
    ['taşma yasası: içerik atılmaz katman değiştirir', /Taşma yasası/],
    // v0.27 K75 — dış-sistem ekseni (AWS SES bölge vakası). Davranışı hakem denetler; kapı
    // yalnız cümlenin sessizce silinmesini engeller, kart varlığını integration-cards zorlar.
    ['kanıt: dış sistem iddiası ölçüm ya da bilmiyorum', /DIŞ SİSTEM İDDİASI = ÖLÇÜM YA DA BİLMİYORUM/],
    // v0.28 K76 — doktrindeki GEREKÇE cümlesi; davranışı taşıyan SKILL.md ADIM 0 cümlesi ayrıca korunur.
    ['kurulum: node aracın bağımlılığı', /Node ARACIN bağımlılığıdır, projenin değil/],
  ] },
  { file: 'templates/CLAUDE.template.md', headings: ['## Bilimsel çalışma disiplini'], patterns: [
    ['kurulum: dalkavukluk yasağı', /Dalkavukluk yasak/i],
    ['kurulum: sürüm-gerçeği', /Sürüm-gerçeği/],
    ['kurulum: devir dosyası', /Devir dosyası/i],
    ['kurulum: türetilmiş katman kanıt değil', /Türetilmiş katman kanıt değildir/],
    ['kurulum: ölçüm talimatı yener', /Ölçüm talimatı yener/],
    ['kurulum: dış sistem iddiası', /Dış sistem iddiası = ölçüm ya da bilmiyorum/],
  ] },
  // v0.21 K50 — orkestrasyon/hız ekseni. Fan-out'un İZNİ ile BEDELİ tek pakettir: sentez
  // protokolü silinip fan-out kalırsa hız doğruluğu yer (ölçüm: olgu-taşıma %84, K48).
  // Bu yüzden ikisi de aynı kapıda korunur. Başlık ANCHOR'ı yok: kural delegasyon bloğunda
  // yaşıyor, ayrı başlık açmak şablon iskeletini şişirirdi.
  { file: 'templates/CLAUDE.template.md', patterns: [
    ['orkestrasyon: salt-okur fan-out varsayılan', /SALT-OKUR FAN-OUT = VARSAYILAN/],
    ['orkestrasyon: sentez protokolü (fan-out bedeli)', /SENTEZ PROTOKOLÜ/],
    ['orkestrasyon: çelişkide oylama yok', /oylama YAPILMAZ/],
  ] },
  { file: 'templates/roles.template.md', patterns: [
    ['kâşif: belirsizlik işareti', /Emin değilsen ADAY diye işaretle/],
    ['kâşif: sürüm-gerçeği', /Sürüm-gerçeği \[E2\]/],
    ['kâşif: dış sistem kartı', /Dış sistem kartı \[E2\]/],
    // v0.20: "delta" kuralının bilinçli istisnası — her rol dosyasına inen ortak satır.
    ['roller: zorunlu ortak satır', /ZORUNLU ORTAK SATIR/],
    ['roller: türetilmiş katman kanıt değil', /Türetilmiş katman KANIT DEĞİLDİR/],
    // v0.21 K50: fan-out'ta sahte konsensüsün panzehiri. Ölçülen vaka (2026-08-12): paralel
    // kâşif, brifteki cümleyi KANIT_REFERANSI diye geri döndürdü — döngüsel referans.
    ['kâşif: brifteki bilgi kanıt değildir', /Brifteki bilgi KANIT DEĞİLDİR/],
  ] },
  { file: 'templates/devir.template.md',
    headings: ['## Kimlik', '## Durum', '## Sıkıştırılamaz taahhütler', '## Sürüm bağlamı', '## Sonraki adım'],
    patterns: [['devir sözleşmesi: context≠talimat', /CONTEXT'tir, TALİMAT değil/]] },
  { file: 'docs/FRICTION_LOG.md', headings: ['## Triyaj disiplini'], patterns: [
    ['triyaj: mekanizma-adayı zorunluluğu', /Mekanizma-adayı/],
    ['triyaj: bağımsız-tekrar terfisi', /3\+ bağımsız tekrar/],
  ] },
  { file: '.claude/agents/hakem.md', repoOnly: true, patterns: [
    ['hakem: net verdict formatı', /GEÇTİ \| KALDI/],
  ] },
];

function runRuleContracts(argv) {
  const strict = argv.includes('--strict');
  const tableArg = argv.find(a => a.startsWith('--table='));

  // v0.30 B3 (saha: saha-E FRICTION 2026-08-31, ÖLÇÜLDÜ pilot-backend'de): yerleşik tablo skill
  // paketinin KENDİ dosyalarına (SKILL.md, reference/doctrine.md, templates/*) işaret eder; hedef repoda
  // bunlar yoktur → kapı kalıcı FAIL üretiyordu. Paket işareti SKILL.md'dir; yoksa (ve --table ile özel
  // tablo verilmediyse) kapı DÜRÜSTÇE no-op'tur. Özel tablo her zaman koşar.
  if (!tableArg && !existsSync('SKILL.md')) {
    console.log('Rule-contracts OK — no-op: SKILL.md yok (bu repo skill paketi değil; yerleşik tablo paketin kendi dosyalarını denetler). Özel tablo için --table=<json>.');
    return 0;
  }

  let table = BUILTIN_RULE_CONTRACTS;
  if (tableArg) {
    const p = tableArg.slice('--table='.length);
    if (!existsSync(p)) { console.error(`Rule-contracts: sözleşme tablosu okunamadı: ${p}`); return 1; }
    try {
      table = JSON.parse(readFileSync(p, 'utf8')).map(e => ({
        file: e.file, headings: e.headings || [], repoOnly: !!e.repoOnly,
        patterns: (e.patterns || []).map(([label, src, flags]) => [label, new RegExp(src, flags || '')]),
      }));
    } catch (e) { console.error(`Rule-contracts: tablo parse edilemedi (${p}): ${e.message}`); return 1; }
  }

  const findings = [];
  for (const entry of table) {
    if (!existsSync(entry.file)) {
      if (entry.repoOnly) { console.log(`  (repoOnly atlandı: ${entry.file} bu bağlamda yok — bundle dışlaması, belgeli)`); continue; }
      findings.push({ file: entry.file, label: 'DOSYA YOK', detail: 'sözleşme hedefi kayıp' });
      continue;
    }
    const text = readFileSync(entry.file, 'utf8');
    const lines = text.split('\n');
    for (const h of entry.headings || [])
      if (!lines.some(l => l.startsWith(h)))
        findings.push({ file: entry.file, label: 'başlık yok', detail: h });
    for (const [label, re] of entry.patterns || [])
      if (!re.test(text))
        findings.push({ file: entry.file, label: 'zorunlu cümle yok', detail: `${label} (${re})` });
  }

  if (!findings.length) {
    console.log(`Rule-contracts OK — ${table.length} dosyada tüm zorunlu başlık/cümleler yerinde.`);
    return 0;
  }

  const msg = `\nNESİR-SÖZLEŞME ${strict ? 'FAIL' : 'UYARI'} (${findings.length} eksik):\n` +
    findings.map(f => `  ${f.file}  [${f.label}]\n      ${f.detail}`).join('\n') +
    `\n\n  • Kural: kimlik/doktrin cümlesi sessizce silinemez/yumuşatılamaz — bu kapı VARLIĞINI zorlar.` +
    `\n  • Cümleyi BİLİNÇLİ değiştiriyorsan: önce karar defterine gerekçe, sonra bu kapının` +
    `\n    tablosunu da güncelle (değişiklik diff'te görünür olur — sessiz erime yerine görünür karar).` +
    `\n  • Bu bir VARLIK kapısıdır: cümlenin varlığını doğrular, davranışa uyulduğunu DEĞİL (o Hakem/E2).\n`;

  if (strict) { console.error(msg + '(--strict: commit/CI bloke edildi)\n'); return 1; }
  console.warn(msg);
  return 0;
}

// =====================================================================================
// RULE: orphan-gates — 5 kontrol: CONTRACT kaydı · test dosyası · test içinde negatif deney
// (NEGATIVE_EXIT_RE) · koşucu bağı ya da "(hedef repo)" muafiyeti · alt-kural sınıf beyanı
// =====================================================================================
// Pilot bulgusu B: sahada bir kapı yazıldı, CI'a bağlandı, ama exit kodu hiç set edilmemişti —
// kirli girdide bile 0 dönüyordu. Önceki 3 kontrol (CONTRACT kaydı + test dosyası VARLIĞI +
// koşucu bağlılığı) bunu YAKALAMAZ: boş/pozitif-only bir test dosyası üçünü de geçer. Bu regex
// test dosyasının en az bir "kirli girdi → sıfır-olmayan çıkış" beklentisi içerdiğini arar.
// 🔴 KAPSAM v0.18.2 hakem turunda GENİŞLETİLDİ (FP ölçümü — K29 emsali: dar regex hedef repoda
// meşru test stillerini yanlış suçlar, yanlış-alarm kapıyı öldürür). Hakem 9 biçim sınadı; ilk
// sürüm yalnız `assert.equal(r.status, 1)` ailesini yakalıyor, şunları KAÇIRIYORDU:
//   assert.notEqual(r.status, 0) · assert.ok(r.status === 1) · assert.ok(r.status !== 0)
//   assert.equal(r.status, 2)  ← PreToolUse hook sözleşmesi exit 2 döndürür (.claude/settings.json)
//   expect(r.status).toBe(1)   ← jest/vitest kullanan hedef repo
// Alan adı da serbestleştirildi (`status`/`code`/`exitCode`) — spawnSync sarmalayıcıları değişir.
const EXIT_FIELD = String.raw`[\w.]+\.(?:status|code|exitCode)`;
const NEGATIVE_EXIT_RE = new RegExp([
  // assert.equal|strictEqual|notEqual(<alan>, <sıfır-olmayan|0-değil>)
  String.raw`assert\.(?:strict)?(?:equal|Equal)\s*\(\s*${EXIT_FIELD}\s*,\s*[1-9]\d*\b`,
  String.raw`assert\.not(?:Strict)?(?:equal|Equal)\s*\(\s*${EXIT_FIELD}\s*,\s*0\b`,
  // assert.ok(<alan> === 1) / assert.ok(<alan> !== 0)
  String.raw`assert\.ok\s*\(\s*${EXIT_FIELD}\s*(?:===?\s*[1-9]\d*|!==?\s*0)\b`,
  // expect(<alan>).toBe(1) / .not.toBe(0)  — jest/vitest
  String.raw`expect\s*\(\s*${EXIT_FIELD}\s*\)\s*\.\s*(?:not\s*\.\s*)?to(?:Be|Equal|StrictEqual)\s*\(\s*\d+`,
].join('|'));

// v0.18.2 MADDE 16 — 5. kontrol: her alt-kuralın CONTRACT.md "Alt-kural sınıf beyanı" tablosunda
// bir satırı var mı? Tek kaynak CONTRACT.md'dir (SB-13 iki-liste-drift dersi: ikinci kopya AÇMA).
// `kategori:alt-kural` satırları `| \`check-x:rule-y\` | sınıf |` biçiminde parse edilir.
function parseClassDeclarations(contractText) {
  const declared = new Set();
  const re = /\|\s*`([\w-]+):([\w-]+)`\s*\|\s*(staged-diff|opt-in-artefakt|auto-discovery)\s*\|/g;
  let m;
  while ((m = re.exec(contractText))) declared.add(`${m[1]}:${m[2]}`);
  return declared;
}

// Kategori scriptinin kendi `const RULES = [...]` dizisinden alt-kural adlarını çıkarır — ikinci
// bir envanter listesi AÇMADAN (gates/ dizini zaten TEK gerçek kaynak; burada yalnız OKUNUR).
function parseRulesArray(gateText) {
  const m = gateText.match(/const\s+RULES\s*=\s*\[([^\]]*)\]/);
  if (!m) return [];
  return [...m[1].matchAll(/'([\w-]+)'|"([\w-]+)"/g)].map(x => x[1] || x[2]);
}

// v0.30 B3: kapı dizinini KENDİ bul — kök `gates/` (paket) ve `scripts/gates/` (hedef repo
// kanonik konumu); ikisi de varsa ikisi de taranır. `--dir=<yol>[,<yol>]` override.
function findGateDirs(argv) {
  const dirArg = argv.find(x => x.startsWith('--dir='));
  const cand = dirArg ? dirArg.slice('--dir='.length).split(',').map(x => x.trim()).filter(Boolean)
    : ['gates', 'scripts/gates'];
  return cand.filter(d => {
    try { return statSync(d).isDirectory() && readdirSync(d).some(f => /^check-.*\.mjs$/.test(f)); }
    catch { return false; }
  });
}

function runOrphanGates(argv) {
  const strictIstendi = argv.includes('--strict');
  const read = (p) => { try { return readFileSync(p, 'utf8'); } catch { return ''; } };

  const gateDirs = findGateDirs(argv);
  // Hedef-repo düzeni (kök `gates/` yok, kapılar otomatik bulunan `scripts/gates/` altında): bu kapı
  // orada önceden HİÇ koşmuyordu (no-op). Sessiz yeni FAIL dayatılmaz -> UYARI; FAIL için
  // `--dir=scripts/gates` ile AÇIKÇA iste. Paket düzeni (kök `gates/`) ve açık `--dir` davranışı aynen.
  const acikDir = argv.some(x => x.startsWith('--dir='));
  const hedefDuzeni = !acikDir && !gateDirs.includes('gates');
  const strict = strictIstendi && !hedefDuzeni;
  // CONTRACT.md: önce kapı dizininde, sonra kökte aranır (hedef repoda `scripts/gates/CONTRACT.md`).
  const contractCands = [...gateDirs.map(d => join(d, 'CONTRACT.md')), 'CONTRACT.md'];
  const contractPath = contractCands.find(existsSync);
  if (!gateDirs.length || !contractPath) {
    const dirArg = argv.find(x => x.startsWith('--dir='));
    const aranan = dirArg ? dirArg.slice(6) : 'gates/, scripts/gates/';
    console.log('Orphan-gates OK — no-op: ' + (!gateDirs.length
      ? 'kapı dizini bulunamadı (içinde check-*.mjs olan dizin arandı: ' + aranan + ')'
      : 'kapı dizini var (' + gateDirs.join(', ') + ') ama CONTRACT.md bulunamadı (arandı: ' + contractCands.join(', ') + ')') +
      '. Opt-in kapı; denetlenecek kayıt yok.');
    return 0;
  }

  const gates = gateDirs.flatMap(d => readdirSync(d).filter(f => /^check-.*\.mjs$/.test(f)).map(f => ({ f, dir: d })));
  const contract = read(contractPath);
  const runnerFiles = ['verify.mjs', 'scripts/self-pre-commit.mjs', '.claude/settings.json', 'package.json'];
  for (const d of ['.github/workflows', '.husky', '.githooks']) {
    try { for (const x of readdirSync(d)) runnerFiles.push(join(d, x)); } catch { /* yok */ }
  }
  const runners = runnerFiles.map(read).join('\n');
  const declaredClasses = parseClassDeclarations(contract);
  // Test konumu: kök `tests/` (paket) ya da `<kapı-dizini>/tests/`. Hiçbiri yoksa VE kök gates/ de yoksa (hedef repoda kapı
  // testleri skill paketinde kalır) test kontrolü ATLANIR ve sonuç mesajında söylenir.
  const testDirs = ['tests', ...gateDirs.map(d => join(d, 'tests'))].filter(existsSync);
  const testsChecked = testDirs.length > 0 || gateDirs.includes('gates'); // paket düzeninde (kök gates/) tests/ yokluğu da bulgudur

  const findings = [];
  for (const { f, dir } of gates) {
    const name = f.replace(/\.mjs$/, '');
    if (!contract.includes(name)) {
      findings.push({ gate: name, eksik: `${contractPath} kayıt satırı yok (kapı sözleşmesiz)` });
      continue;
    }
    if (testsChecked) {
      const testPath = testDirs.map(t => join(t, `${name}.test.mjs`)).find(existsSync) ?? `${testDirs[0] ?? 'tests'}/${name}.test.mjs`;
      if (!existsSync(testPath)) {
        findings.push({ gate: name, eksik: `${testPath} yok (davranışı kanıtsız)` });
      } else if (!NEGATIVE_EXIT_RE.test(read(testPath))) {
        findings.push({ gate: name, eksik: `${testPath} içinde negatif deney yok — kapı kirli girdide exit 1 verdiği KANITSIZ` });
      }
    }
    if (!runners.includes(name)) {
      const contractLine = contract.split('\n').find(l => l.includes(`\`gates/${f}\``) || l.includes(`\`${dir}/${f}\``));
      if (!(contractLine && /hedef repo/i.test(contractLine)))
        findings.push({ gate: name, eksik: 'koşucuya bağlı değil, CONTRACT satırında "(hedef repo)" muafiyeti yok' });
    }
    // v0.18.2 MADDE 16 — 5. kontrol: bu kategorinin HER alt-kuralı (RULES[]) CONTRACT.md
    // "Alt-kural sınıf beyanı" tablosunda kayıtlı mı? Yoksa "0 dosya şüpheli mi doğal mı" kararı
    // ölçülmeden varsayılıyor demektir (FRICTION_LOG 2026-08-06). VARLIK kontrolü — DOĞRULUĞU değil.
    for (const rule of parseRulesArray(read(`${dir}/${f}`))) {
      const key = `${name}:${rule}`;
      if (!declaredClasses.has(key))
        findings.push({ gate: name, eksik: `alt-kural "${rule}" sınıf beyanı yok — CONTRACT.md "Alt-kural sınıf beyanı" tablosuna `
          + `\`| \\\`${key}\\\` | staged-diff|opt-in-artefakt|auto-discovery |\` satırı ekle (MADDE 16)` });
    }
  }

  if (!findings.length) {
    console.log(`Orphan-gates OK — ${gates.length} kapının tümü kayıtlı [${gateDirs.join(', ')}; sözleşme: ${contractPath}] (sözleşme + ${testsChecked ? 'test + negatif-deney' : 'test kontrolü ATLANDI (tests/ yok)'} + koşucu/muafiyet + alt-kural sınıf beyanı).`);
    return 0;
  }

  const msg = `\nORPHAN-KAPI ${strict ? 'FAIL' : 'UYARI'} (${findings.length} eksik kayıt):\n` +
    findings.map(x => `  ${x.gate}\n      ${x.eksik}`).join('\n') +
    `\n\n  • Kural: kurulu ama kayıtsız kapı ORPHAN'dır — koşmaz, görünmez, sayılmaz (v0.11'de` +
    `\n    6 kapı böyle sessizce kayıt-dışı kaldı). Beşini birden tamamla: CONTRACT satırı +` +
    `\n    birim test + negatif deney (exit 1 bekleyen kirli-girdi testi) + koşucu kaydı` +
    `\n    (ya da CONTRACT satırında "(hedef repo)" muafiyeti) + alt-kural sınıf beyanı (MADDE 16).` +
    `\n  • Bu bir VARLIK kapısıdır: kaydın/negatif-deneyin/sınıf beyanının VARLIĞINI doğrular, o` +
    `\n    deneyin/beyanın gerçekten doğru/yeterli olduğunu DEĞİL (o Hakem/E2 işi — pilot: exit kodu` +
    `\n    hiç set edilmemiş bir kapı, boş/pozitif-only test dosyasıyla sessizce ORPHAN-DIŞI` +
    `\n    görünebiliyordu; sınıf beyanı da yanlış sınıf yazılsa bu kapı göremez).\n`;

  if (strict) { console.error(msg + '(--strict: commit/CI bloke edildi)\n'); return 1; }
  console.warn(msg + (strictIstendi && hedefDuzeni
    ? '  (hedef-repo düzeni: --strict istendi ama otomatik bulunan scripts/gates için UYARI; FAIL için --dir=scripts/gates ver)\n' : ''));
  return 0;
}

// =====================================================================================
// RULE: design-tokens
// =====================================================================================
const UI_FILE = /\.(jsx?|tsx?|vue|svelte|razor|cshtml)$/i;

const VIOLATIONS = [
  ['hardcoded hex renk',  /#[0-9a-fA-F]{3,8}\b/g],
  ['hardcoded rgb(a)',    /\brgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+/gi],
  ['inline style özniteliği', /\bstyle\s*=\s*[{"']/g],
  ['Tailwind arbitrary değer', /\b(bg|text|border|w|h|p|m|gap)-\[[^\]]+\]/g],
];

const EXEMPT_LINE_DESIGN = [
  /❌|✅|(^|[.;]\s*|\s—\s)\s*(YASAK|MUAF)\b|kar[şs][ıi]-[öo]rnek/,
  /^\s*(\/\/|\/\*|\*|<!--)/,
  /test.?data|fixture|mock.?renk|mock.?color/i,
];

const PLACEHOLDER_ONLY_LINE = /^[\s|:,;.-]*(\{\{[A-Z][A-Z0-9_]*\}\}[\s|:,;.-]*)+$/;

function runDesignTokens(argv) {
  const strict = argv.includes('--strict');
  const fileArgs = argv.filter(a => !a.startsWith('-'));

  if (!existsSync('DESIGN.md')) {
    console.log('Design-tokens OK — DESIGN.md yok, kapı no-op (kullanmayan ödemez).');
    return 0;
  }

  function targets() {
    if (fileArgs.length) return fileArgs;
    try {
      return execSync('git diff --cached --name-only --diff-filter=ACM', { maxBuffer: 16 * 1024 * 1024 })
        .toString('utf8').split('\n').filter(Boolean).filter(f => UI_FILE.test(f));
    } catch { return []; }
  }

  const files = fileArgs.length
    ? fileArgs.filter(f => existsSync(f))
    : targets().filter(f => UI_FILE.test(f) && existsSync(f));

  if (!files.length) {
    console.log(fileArgs.length
      ? `Design-tokens — verilen ${fileArgs.length} yolun hiçbiri okunamadı (dosya yok). TARAMA YAPILMADI.`
      : 'Design-tokens OK — staged UI dosyası yok (kapı bu commit\'te no-op).');
    return 0;
  }

  const findings = [];
  for (const f of files) {
    if (/\.(test|spec|stories)\.[jt]sx?$/i.test(f)) continue;
    const lines = readFileSync(f, 'utf8').split('\n');
    lines.forEach((line, i) => {
      if (EXEMPT_LINE_DESIGN.some(re => re.test(line))) return;
      if (PLACEHOLDER_ONLY_LINE.test(line.trim())) return;
      for (const [label, re] of VIOLATIONS) {
        re.lastIndex = 0;
        const m = re.exec(line);
        if (m) {
          findings.push({ file: f, line: i + 1, label, text: line.trim().slice(0, 110) });
          break;
        }
      }
    });
  }

  if (!findings.length) {
    console.log(`Design-tokens OK — ${files.length} UI dosyasında token-dışı literal yok.`);
    return 0;
  }

  const msg = `\nTASARIM-TOKEN ${strict ? 'FAIL' : 'UYARI'} (${findings.length} token-dışı literal):\n` +
    findings.map(f => `  ${f.file}:${f.line}  [${f.label}]\n      ${f.text}`).join('\n') +
    `\n\n  • Kural: DESIGN.md varsa UI kodu hardcoded renk/inline-style YAZAMAZ — token'a işaret` +
    `\n    etmeli. Ajan renk uydurduğunda repo istatistiksel medyana ("AI slop") kayar.` +
    `\n  • Düzeltme: literali SİL, DESIGN.md'deki token'a bağla —` +
    `\n      ❌ style={{ color: '#4F46E5' }}` +
    `\n      ✅ className="text-primary"  (DESIGN.md'de tanımlı token)` +
    `\n  • Bu kapı yalnız TUTARLILIK ölçer, KALİTE ölçmez — token-uyumlu ekran hâlâ kötü tasarlanmış` +
    `\n    olabilir. Görsel doğrulama için hedef repoya reçete edilen CI şablonuna bakın.` +
    `\n  • Bu bir HEURİSTİK'tir: yanlış-pozitifse satırı örnek/muaf bağlamla yaz ya da rengi DESIGN.md'ye token olarak ekle.\n`;

  if (strict) { console.error(msg + '(--strict: commit/CI bloke edildi)\n'); return 1; }
  console.warn(msg);
  return 0;
}

// =====================================================================================
// RULE: install-version — WARN-ONLY (v0.30 K2d). Çıkış kodu DAİMA 0: hiçbir koşulda commit bloke etmez.
// .agentic-repo-setup.json künyesindeki skill_version, makinedeki kurulu skill sürümünden eskiyse
// günde en fazla BİR KEZ tek satır uyarı. Ölçülemezse (künye/skill/sürüm yok) sessiz.
// =====================================================================================
const SEMVER_RE = /(\d+)\.(\d+)\.(\d+)/;
function semverTuple(v) { const m = String(v ?? '').match(SEMVER_RE); return m ? [+m[1], +m[2], +m[3]] : null; }
function semverCmp(a, b) { for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] < b[i] ? -1 : 1; return 0; }

function readInstalledSkillVersion(skillDir) {
  try {
    const pj = join(skillDir, 'package.json');
    if (existsSync(pj)) { const v = JSON.parse(readFileSync(pj, 'utf8')).version; if (semverTuple(v)) return String(v).match(SEMVER_RE)[0]; }
  } catch { /* SKILL.md'ye düş */ }
  try {
    const md = readFileSync(join(skillDir, 'SKILL.md'), 'utf8');
    const m = md.match(/\(v(\d+\.\d+\.\d+)[^)]*\)/);
    if (m) return m[1];
  } catch { /* ölçülemedi */ }
  return null;
}

// `.git` dizin → '.git'; dosya (`gitdir: <yol>`) → o yol (cwd'ye göre çözülür) var ve dizinse; aksi hâlde null.
function resolveGitDir() {
  try {
    if (!existsSync('.git')) return null;
    if (statSync('.git').isDirectory()) return '.git';
    const m = readFileSync('.git', 'utf8').match(/^gitdir:\s*(.+?)\s*$/m);
    if (!m) return null;
    const dir = resolve(m[1]);
    return existsSync(dir) && statSync(dir).isDirectory() ? dir : null;
  } catch { return null; }
}

function runInstallVersion() {
  try {
    if (!existsSync('.agentic-repo-setup.json')) return 0;
    const cur = semverTuple(JSON.parse(readFileSync('.agentic-repo-setup.json', 'utf8')).skill_version);
    const skillDir = process.env.AGENTIC_SKILL_DIR || join(homedir(), '.claude', 'skills', 'agentic-repo-setup');
    if (!cur || !existsSync(skillDir)) return 0;
    const instStr = readInstalledSkillVersion(skillDir);
    const inst = semverTuple(instStr);
    if (!inst || semverCmp(cur, inst) >= 0) return 0;

    // Günde en fazla bir kez — damga <gitdir>/agentic-surum-uyari. `.git` DOSYA ise (worktree/submodule:
    // içerik `gitdir: <yol>`) gerçek git dizini çözülür; çözülemezse damgasız (.git yoksa da damgasız).
    const gitDir = resolveGitDir();
    const stamp = gitDir ? join(gitDir, 'agentic-surum-uyari') : null;
    const today = new Date().toISOString().slice(0, 10);
    const hasGit = !!stamp;
    if (hasGit) {
      try { if (readFileSync(stamp, 'utf8').trim() === today) return 0; } catch { /* damga yok */ }
    }
    console.warn('UYARI install-version: bu repo v' + cur.join('.') + ' ile kurulmuş, makinede v' + instStr +
      ' var — "node ' + join(skillDir, 'verify.mjs').replace(/\\/g, '/') + ' --doctor --target=." ile değerlendir.');
    if (hasGit) { try { writeFileSync(stamp, today + '\n'); } catch { /* damga yazılamadı — sorun değil */ } }
  } catch { /* ölçülemedi → sessiz */ }
  return 0;
}

// =====================================================================================
// Dispatch
// =====================================================================================
const argv = process.argv.slice(2);
const ruleArg = argv.find(a => a.startsWith('--rule='));
const rest = argv.filter(a => a !== ruleArg);

const RUNNERS = {
  'rule-contracts': runRuleContracts,
  'orphan-gates': runOrphanGates,
  'design-tokens': runDesignTokens,
  'install-version': runInstallVersion,
};

if (ruleArg) {
  const rule = ruleArg.slice('--rule='.length);
  if (!RUNNERS[rule]) {
    console.error(`check-self-registry.mjs: bilinmeyen --rule="${rule}" (geçerli: ${RULES.join(', ')})`);
    process.exit(1);
  }
  process.exit(RUNNERS[rule](rest));
}

let worst = 0;
for (const name of RULES) {
  const code = RUNNERS[name]([]);
  if (code !== 0) worst = code;
}
process.exit(worst);

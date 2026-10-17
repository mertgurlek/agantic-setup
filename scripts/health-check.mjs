#!/usr/bin/env node
// Sağlık taraması / BAHÇIVAN RİTÜELİ (v0.11) — entropi dedektörü.
// NEDEN VAR: bu repo bir kez "9 kapı / 71 test" derken gerçekte 16 kapı / 204 test vardı —
// skill KENDİ doctrine'ini ("rehber gerçeği yansıtır") ihlal etmişti. Kapılar TEK BİR commit'in
// içindeki ihlali yakalar; entropi ise ZAMAN içinde, commit'ler ARASINDA birikir (drift, yetim
// dosya, bayat bundle, arşive gitmemiş "konsolide edildi" dosyası). Bu script o yavaş birikimi
// deterministik (E0, sıfır-token, LLM'siz) tarar.
//
// KİMLİK — bu bir KAPI DEĞİL, bir RİTÜELDİR: varsayılan UYARIR, bloke ETMEZ. Gerekçe (doctrine):
// "öznel tetiği makineye gömme" — neyin budanacağı/arşivleneceği insan kararıdır; makine yalnız
// "şuraya BAK" der. `--strict` ile (CI/release öncesi) bulgu varsa exit 1.
//
// Kullanım: node scripts/health-check.mjs [--strict] [--json]
//   varsayılan: bulguları yaz, exit 0 (bahçıvan uyarısı).
//   --strict:   herhangi bir UYARI varsa exit 1 (release kapısı).
//   --json:     bulguları JSON olarak yaz (araç entegrasyonu).
//
// GÜVENLİK AĞI = git geçmişi. "Temizlik için untrack" YASAK (çok-cihaz senkronunu kırar) —
// bu script silmez/taşımaz, yalnız RAPOR eder; eylemi insan git ile yapar (arşivle/sil/güncelle).

import { readdirSync, existsSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const argv = process.argv.slice(2);
const STRICT = argv.includes('--strict');
const JSON_OUT = argv.includes('--json');
// --fix (v0.13.1 — FRICTION_LOG "elle sayı senkronu" kaydı 3. tekrarla eşiği aşınca):
// health zaten ÖLÇTÜĞÜ kapı/test/şablon sayılarını README "Güncel envanter" satırına ve
// CLAUDE.md baseline test sayısına KENDİSİ yazar. Yalnız bu iki satıra dokunur, başka hiçbir
// şeyi düzeltmez (bahçıvan raporlar, --fix sadece sayı-senkron sürtünmesini öldürür).
// DÜRÜST SINIR: verify adım sayısı (10/10) elle kalır — health verify'ı koşmadan bilemez.
const FIX = argv.includes('--fix');

const findings = [];   // { level: 'UYARI'|'BİLGİ', kod, mesaj, ipucu }
const warn = (kod, mesaj, ipucu = '') => findings.push({ level: 'UYARI', kod, mesaj, ipucu });
const info = (kod, mesaj) => findings.push({ level: 'BİLGİ', kod, mesaj });

const read = (p) => { try { return readFileSync(join(ROOT, p), 'utf8'); } catch { return null; } };
const git = (...args) => {
  const r = spawnSync('git', ['-C', ROOT, ...args], { encoding: 'utf8' });
  return r.status === 0 ? (r.stdout || '').trim() : null;
};
const trackedFiles = () => (git('ls-files') || '').split('\n').filter(Boolean);
const countIn = (dir, re) => existsSync(join(ROOT, dir))
  ? readdirSync(join(ROOT, dir)).filter(f => re.test(f)).length : 0;

// ───────────────────────────────────────────────────────────────────────────
// 1) DOKÜMAN-SAYI DRİFTİ — bu reponun ÇÖKTÜĞÜ yer. README'nin "Güncel envanter"
//    işaretini gerçek fs sayımıyla karşılaştır. Kapı+şablon TAM eşleşmeli (fs = otorite),
//    test sayısı ±2 tolere edilir (subtest/dinamik-test sayım varyansı).
// ───────────────────────────────────────────────────────────────────────────
// Test sayımı KAYNAĞI (SB-15 düzeltmesi): grep `test(` çağrılarını sayar ama parametrize
// (tablo) testleri — `for (...) { test(...) }` döngüsü, tek literal çağrı N test üretir —
// yapısal olarak GÖREMEZ (JS parse etmeden döngü-genişlemesini bilmek mümkün değil; ölçüldü:
// v0.18.2'de 7'lik bir döngü grep'i 6 eksik saydı). Kırılgan AST-taklidi regex yazmak yerine
// `health:fix` zaten koştuğu GERÇEK `node --test` sonucunu bu dosyaya yazar; `checkDocCounts`
// grep yerine BU dosyayı okur — fix ile check artık AYNI kaynaktan besleniyor (asıl kusur
// ikisinin FARKLI kaynaklardan okumasıydı). Dosya yoksa (ör. taze klon, henüz fix koşulmamış)
// grep'e DÜŞ (eski davranış, ±2 tolerans) — sessiz kırılma yerine bilinen zayıf tolerans.
const TEST_BASELINE_PATH = 'scripts/test-count-baseline.json';
function grepTestCount() {
  let n = 0;
  const tdir = join(ROOT, 'tests');
  if (existsSync(tdir)) for (const f of readdirSync(tdir).filter(f => /\.test\.mjs$/.test(f)))
    n += (readFileSync(join(tdir, f), 'utf8').match(/\btest\(/g) || []).length;
  return n;
}
// SB-19: test-count-baseline.json bir SNAPSHOT'tır — yalnız `health:fix` koşulduğunda yazılır.
// checkDocCounts onu okuyup "kesin kaynak" sayıyordu ama baseline'ın kendisi BAYATLAYABİLİR
// (tests/ değişir, kimse --fix koşmaz → README/baseline eski sayıda donar, health kendi yazdığı
// kopyayla kendini onaylar → "temiz" der). Bu, tests/ içeriğinin sha1 özetini `--fix` anında
// diske yazıp, her `health` koşusunda GÜNCEL özetle karşılaştırarak tespit edilir: özet
// uyuşmuyorsa tests/ dosyaları baseline'dan SONRA değişmiş demektir → sayı artık güvenilmez.
// Dar sinyal BİLİNÇLİ: yalnız tests/*.test.mjs içeriği tetikler (SHA/tarih gibi HER commit'te
// tetiklenen geniş sinyaller DEĞİL) — FP ölçümü tests/health-check.test.mjs'te + SB-19 girdisinde.
function testsDirHash() {
  const tdir = join(ROOT, 'tests');
  if (!existsSync(tdir)) return null;
  const files = readdirSync(tdir).filter(f => /\.test\.mjs$/.test(f)).sort();
  const h = createHash('sha1');
  // SB-27: EOL-normalize (install-doctor sha256 kuralının aynısı) — CRLF smudge sahte baseline-bayat üretmesin.
  for (const f of files) h.update(readFileSync(join(tdir, f), 'utf8').replace(/\r\n/g, '\n'));
  return h.digest('hex');
}
function checkDocCounts() {
  const gerçekKapı = countIn('gates', /^check-.*\.mjs$/);
  const gerçekŞablon = countIn('templates', /\./);   // templates/ altındaki tüm dosyalar
  // test sayısı: önce ölçülmüş baseline (koşu-temelli, kesin), yoksa grep (bulanık, ±2 tolere).
  let testSayısı = grepTestCount();
  let testKaynağıKesin = false;
  const baseline = read(TEST_BASELINE_PATH);
  if (baseline) {
    try {
      const b = JSON.parse(baseline);
      if (Number.isFinite(b.pass)) { testSayısı = b.pass; testKaynağıKesin = true; }
      // SB-19: baseline bir SNAPSHOT — yalnız --fix anında yazılır. tests/ o andan SONRA değiştiyse
      // (yeni test eklendi/silindi) sayı artık güvenilmez ama testKaynağıKesin=true kalır ("temiz"
      // görünür). Kayıtlı hash ile GÜNCEL hash'i karşılaştır; uyuşmuyorsa ayrı bir bayatlık uyarısı ver
      // (test-drifti DEĞİL — sayı farklı olmayabilir bile, sadece "artık ölçülmemiş" olduğu bilgisi).
      if (b.testsHash && testKaynağıKesin) {
        const güncelHash = testsDirHash();
        if (güncelHash && güncelHash !== b.testsHash)
          warn('baseline-bayat',
            `${TEST_BASELINE_PATH} tests/ içeriği DEĞİŞTİKTEN SONRA güncellenmemiş (kayıtlı özet ≠ güncel özet) — "${testSayısı} test" sayısı artık ölçülmemiş olabilir.`,
            '`npm run health:fix` gerçek `node --test` koşusunu yeniden ölçüp baseline\'ı tazeler.');
      }
    } catch { /* bozuk baseline → grep'e düş */ }
  }
  const readme = read('README.md') || '';
  // v0.26 — FACT İŞARETİ TOLERANSI: envanter satırındaki sayılar artık `<!--fact:KEY-->N<!--/fact-->`
  // ile sarılı olabilir (facts katmanı). Regex'in sayıyı bulabilmesi için işaretleri ŞEFFAF say —
  // aksi halde health "envanter işareti yok" der ve kendi --fix'i satırı bulamaz (ölçüldü
  // 2026-09-06: iki mekanizma kurulduğu gün çakıştı; bu satır o çakışmanın çözümü).
  const unmark = (s) => s.replace(/<!--\s*fact:[A-Za-z0-9_.-]+\s*-->/g, '').replace(/<!--\s*\/fact\s*-->/g, '');
  const m = unmark(readme).match(/Güncel envanter[^\n]*?(\d+)\s*kapı[^\n]*?(\d+)\s*birim test[^\n]*?(\d+)\s*şablon/i);
  if (!m) {
    warn('envanter-isareti-yok',
      'README.md\'de makine-okunur "Güncel envanter (vX): N kapı · N birim testi · N şablon" işareti yok.',
      'Bu işaret drift-dedektörünün çapasıdır; ekle ki sayılar kaynağa bağlansın.');
    info('gerçek-sayılar', `Gerçek: ${gerçekKapı} kapı · ${gerçekŞablon} şablon (fs sayımı).`);
    return;
  }
  // --fix (v0.13.1): ölçülen değerleri README envanter satırına + CLAUDE.md baseline test
  // sayısına YAZ (FRICTION "elle sayı senkronu" kaydının çözümü — sayı elle değil ölçümden).
  // Yalnız bu iki satıra dokunur; sürüm etiketi (vX.Y) package.json'dan tazelenir.
  if (FIX) {
    // Test sayısı GERÇEK koşudan gelir: grep-sayımı ±1 sapabiliyor (ölçüldü: grep 302, koşu 301)
    // ve baseline manifestosu yalan söyleyemez. --fix nadir koşulur; 17 sn'lik gerçek `node --test`
    // dürüstlüğün bedeli. Koşu KIRMIZIYSA sayı YAZILMAZ — baseline yalnız yeşilden yazılır.
    // NOT: health-check.mjs kendisi bir `node --test` sürecinin İÇİNDEN (fixture testinde) ya da
    // dıştan koşulabilir. İçeriden koşulunca Node, `NODE_TEST_CONTEXT` env değişkenini miras
    // bırakıp iç içe --test'i "recursif çağrı" sayıp SESSİZCE atlıyor (dosya hiç koşulmuyor,
    // stdout boş kalıyor → pass parse edilemiyor). Miras alınan bu bayrağı temizle.
    const fixEnv = { ...process.env }; delete fixEnv.NODE_TEST_CONTEXT;
    // SB-9: yalnız tests/; açık dosya listesi (Node 20 --test glob'u açmaz).
    const t = spawnSync('node', ['--test', ...readdirSync(join(ROOT, 'tests')).filter(f => /\.test\.mjs$/.test(f)).sort().map(f => join('tests', f))], { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, env: fixEnv });
    const tOut = (t.stdout || '') + (t.stderr || '');
    const pass = Number((tOut.match(/^# pass (\d+)$/m) || [])[1]);
    const fail = Number((tOut.match(/^# fail (\d+)$/m) || [])[1]);
    if (!Number.isFinite(pass) || fail > 0) {
      warn('fix-iptal', `--fix test koşusu ${fail > 0 ? fail + ' FAIL verdi' : 'parse edilemedi'} — sayı YAZILMADI.`,
        'Önce testleri yeşile getir; baseline yalnız yeşil koşudan yazılır.');
      return;
    }
    testSayısı = pass;
    // SB-15: fix ile check'i AYNI kaynağa bağla — grep yerine bu ölçülmüş sayıyı diskte sakla.
    // check tarafı artık grep DEĞİL, bu dosyayı okur (bkz. TEST_BASELINE_PATH yukarıda).
    // SB-19: tests/ özetini de damgala — check tarafı bu özetin GÜNCEL özetle eşleşip eşleşmediğine
    // bakarak baseline'ın tests/ değiştikten SONRA bayatlayıp bayatlamadığını (snapshot körlüğü) tespit eder.
    writeFileSync(join(ROOT, TEST_BASELINE_PATH), JSON.stringify({ pass, testsHash: testsDirHash(), ölçüldü: new Date().toISOString().slice(0, 10) }, null, 2) + '\n');
    // v0.26 — FACTS: ölçülen değerleri `facts.json`'a da yaz. TEK KAYNAK ilkesi: aynı ölçüm
    // iki bağımsız dosyada yaşarsa biri bayatlar (bu katmanın tam olarak engellediği şey).
    // test-count-baseline.json geriye-uyumluluk için KORUNUR (SB-15/SB-19 mantığı ona bağlı),
    // ama facts.json artık dokümanların okuduğu kaynaktır.
    try {
      const fp = join(ROOT, 'facts.json');
      const doc = existsSync(fp) ? JSON.parse(readFileSync(fp, 'utf8')) : { generated_by: 'scripts/facts.mjs', measurements: {}, policy: {} };
      const bugün = new Date().toISOString().slice(0, 10);
      const set = (k, v, extra = {}) => { doc.measurements[k] = { status: 'measured', value: v, cmd: doc.measurements[k]?.cmd ?? null, ...extra, measured_at: bugün }; };
      set('test_count', testSayısı, { source_hash: testsDirHash() });
      set('gate_count', gerçekKapı);
      set('template_count', gerçekŞablon);
      writeFileSync(fp, JSON.stringify(doc, null, 2) + '\n');
      info('fix-facts', `facts.json ölçümle tazelendi: test=${testSayısı} · kapı=${gerçekKapı} · şablon=${gerçekŞablon}.`);
    } catch { /* facts.json bozuksa health'i düşürme — `npm run facts` yeniden üretir */ }

    // Fact-işaretli hücreleri yerinde güncelle (işareti BOZMADAN). İşaretsiz metin için
    // eski davranış korunur — hedef repo işaretlemeden de çalışsın (geriye-uyumluluk).
    const FACT_CELL = (key) => new RegExp(`(<!--\\s*fact:${key}\\s*-->)([\\s\\S]*?)(<!--\\s*/fact\\s*-->)`, 'g');
    const değerler = { test_count: testSayısı, gate_count: gerçekKapı, template_count: gerçekŞablon };
    const işaretliYaz = (dosya) => {
      let src = read(dosya); if (!src) return false;
      const önce = src;
      for (const [k, v] of Object.entries(değerler))
        src = src.replace(FACT_CELL(k), (_, aç, içerik, kapa) => aç + içerik.replace(/-?\d+/, String(v)) + kapa);
      if (src !== önce) { writeFileSync(join(ROOT, dosya), src); return true; }
      return false;
    };

    const pkgVer = (() => { try { return JSON.parse(read('package.json')).version; } catch { return null; } })();
    const mm = (pkgVer || '').match(/^(\d+\.\d+)/);
    if (işaretliYaz('README.md')) {
      info('fix-readme', `README fact hücreleri ölçümle yazıldı: ${gerçekKapı} kapı · ${testSayısı} test · ${gerçekŞablon} şablon.`);
    } else {
      let yeniSatır = m[0]
        .replace(/(\d+)(\s*kapı)/i, `${gerçekKapı}$2`)
        .replace(/(\d+)(\s*birim test)/i, `${testSayısı}$2`)
        .replace(/(\d+)(\s*şablon)/i, `${gerçekŞablon}$2`);
      if (mm) yeniSatır = yeniSatır.replace(/\(v\d+\.\d+(\.\d+)?\)/, `(v${mm[1]})`);
      if (yeniSatır !== m[0]) {
        writeFileSync(join(ROOT, 'README.md'), readme.replace(m[0], yeniSatır));
        info('fix-readme', `README envanteri ölçümle yazıldı: ${gerçekKapı} kapı · ${testSayısı} test · ${gerçekŞablon} şablon.`);
      }
    }
    // README sürüm etiketi işaretli yolda da tazelenir (envanter satırı "(vX.Y)" taşır).
    if (mm) {
      const r2 = read('README.md');
      if (r2) {
        const y2 = r2.replace(/(Güncel envanter\s*\()v\d+\.\d+(\.\d+)?(\))/, `$1v${mm[1]}$3`);
        if (y2 !== r2) writeFileSync(join(ROOT, 'README.md'), y2);
      }
    }

    if (!işaretliYaz('CLAUDE.md')) {
      const claude = read('CLAUDE.md');
      if (claude && /\*\*\d+ test yeşil\*\*/.test(claude)) {
        const yeni = claude.replace(/\*\*\d+ test yeşil\*\*/, `**${testSayısı} test yeşil**`);
        if (yeni !== claude) {
          writeFileSync(join(ROOT, 'CLAUDE.md'), yeni);
          info('fix-claude', `CLAUDE.md baseline test sayısı ölçümle yazıldı: ${testSayısı}.`);
        }
      }
    } else {
      info('fix-claude', `CLAUDE.md fact hücreleri ölçümle yazıldı: test=${testSayısı} · kapı=${gerçekKapı}.`);
    }
    return;   // fix sonrası drift uyarısı anlamsız (az önce eşitlendi)
  }
  const [, iddiaKapı, iddiaTest, iddiaŞablon] = m.map(Number);
  if (iddiaKapı !== gerçekKapı)
    warn('kapı-drifti', `README "${iddiaKapı} kapı" diyor ama gates/ altında ${gerçekKapı} kapı var.`,
      'Bu, "9 kapı derken 16 vardı" felaketinin tekrarı. `npm run health:fix` sayıyı ölçümle yazar.');
  if (iddiaŞablon !== gerçekŞablon)
    warn('şablon-drifti', `README "${iddiaŞablon} şablon" diyor ama templates/ altında ${gerçekŞablon} var.`);
  // Kaynak KESİNSE (test-count-baseline.json — gerçek `node --test` koşusu) TAM eşleşme
  // beklenir (fs sayımları gibi); kaynak grep TAHMİNİYSE (baseline yok) ±2 tolere edilir.
  const tolerans = testKaynağıKesin ? 0 : 2;
  if (Math.abs(iddiaTest - testSayısı) > tolerans)
    warn('test-drifti', testKaynağıKesin
      ? `README "${iddiaTest} birim testi" diyor ama ölçülmüş gerçek koşu ${testSayısı} test verdi (${TEST_BASELINE_PATH}).`
      : `README "${iddiaTest} birim testi" diyor ama tests/ ~${testSayısı} test( çağrısı var (±2 dışı, tahmini grep sayımı — ${TEST_BASELINE_PATH} yok).`,
      '`npm run health:fix` iki dosyadaki sayıyı da ölçümle yazar (elle senkron sürtünmesi kapandı).');
}

// ───────────────────────────────────────────────────────────────────────────
// 2) SÜRÜM-TUTARLILIĞI (D-A) — package.json ≡ SKILL.md başlığı ≡ public/ bundle.
//    "Update → version → output" boru hattının makine bekçisi. Bu repo bir kez kaynak
//    0.10.0-alpha iken bundle v0.9.0'da donmuştu.
// ───────────────────────────────────────────────────────────────────────────
function parseVer(s) { const m = (s || '').match(/(\d+\.\d+\.\d+(?:-[a-z0-9.]+)?)/i); return m ? m[1] : null; }
function checkVersion() {
  let pkgVer = null;
  try { pkgVer = JSON.parse(read('package.json')).version; } catch { /* yok */ }
  if (!pkgVer) { warn('paket-surumu-yok', 'package.json version okunamadı.'); return; }

  const skillVer = parseVer((read('SKILL.md') || '').split('\n').find(l => /^#\s/.test(l)) || '');
  if (skillVer && skillVer !== pkgVer)
    warn('surum-uyumsuz', `package.json (${pkgVer}) ≠ SKILL.md başlığı (${skillVer}).`,
      'Tek SemVer gerçeği: package ≡ SKILL ≡ bundle. Birini bump edince üçünü de et.');

  // public/ bundle sürümü
  const pub = join(ROOT, 'public');
  const bundles = existsSync(pub) ? readdirSync(pub).filter(f => /\.(skill|zip)$/.test(f)) : [];
  const bundleVers = [...new Set(bundles.map(b => parseVer(b)).filter(Boolean))];
  if (bundles.length === 0) info('bundle-yok', 'public/ altında .skill/.zip bundle yok (henüz paketlenmedi).');
  else if (!bundleVers.includes(pkgVer))
    warn('bundle-bayat', `public/ bundle sürüm(ler)i [${bundleVers.join(', ')}] ≠ kaynak sürüm (${pkgVer}).`,
      'Kaynağı değiştirdin ama çıktı üretmedin. `npm run pack:skill` ile bundle\'ı yeniden üret (D-A).');
  else {
    // İÇERİK-TAZELİĞİ (etiketten BAĞIMSIZ): sürüm aynı KALIP içerik değişince bundle sessizce
    // bayatlar (etiket karşılaştırması bunu KAÇIRIR). Bundle dosyası, PAKETLENEN kaynağın en son
    // commit tarihinden eski mi? git archive HEAD'i alır → paketlenen içeriğin son-commit epoch'u.
    const bundleFile = bundles.map(b => join(pub, b)).sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs)[0];
    const bundleMs = statSync(bundleFile).mtimeMs;
    // İÇERİK-tazeliği: bundle YALNIZ export-ignore'suz (paketlenen) dosyalardan üretilir → yalnız
    // ONLARIN commit'i bundle'ı bayatlatır. `public/` (bundle'ın kendisi), `pilot-proje/`, `pilot-sim/`
    // vb. export-ignore'lu → HARİÇ. Aksi halde bundle'ı commit'lemenin KENDİSİ (public/ değişir → HEAD
    // ilerler) yanlış-pozitif üretirdi (tavuk-yumurta). Bu yüzden HEAD değil, PAKETLENEN dosyaların
    // son-commit epoch'unu ölç: git log -1 -- <paketlenen yollar>.
    const packedPaths = ['SKILL.md', 'README.md', 'CONTRACT.md', 'INSTALL.md', 'verify.mjs',
      'package.json', 'gates/', 'templates/', 'reference/', 'scripts/', 'tests/', 'examples/'];
    const contentMs = Number(git('log', '-1', '--format=%ct', '--', ...packedPaths)) * 1000;
    if (Number.isFinite(contentMs) && bundleMs < contentMs - 5000)
      warn('bundle-icerik-bayat', `public/ bundle sürüm-etiketi güncel (${pkgVer}) AMA paketlenen içerik commit'inden ESKİ (bundle ${new Date(bundleMs).toISOString().slice(0,16)} < içerik ${new Date(contentMs).toISOString().slice(0,16)}).`,
        'Sürümü bump etmeden paketlenen dosyalara içerik eklediysen etiket aynı kalır ama bundle bayatlar. `npm run release` ile yeniden üret.');
  }

  // D-B: sürüm ↔ karar defteri bağı. major.minor için kökte bir aktif defter olmalı.
  const mm = pkgVer.match(/^(\d+)\.(\d+)/);
  if (mm) {
    const beklenen = `v${mm[1]}.${mm[2]}-KARAR-DEFTERI.md`;
    if (!existsSync(join(ROOT, beklenen)))
      warn('karar-defteri-yok', `Aktif sürüm ${pkgVer} için kökte ${beklenen} yok (karar=doküman, D-B).`,
        'Her sürümün "neden"i append-only bir deftere yazılır; eskisi archive/\'a devredilir.');
  }
}

// KURULU SKILL TAZELİĞİ (v0.30.1, kullanıcı kuralı 2026-10-04: "reponun kendi ürettiği yapı her zaman
// en güncel sürümde olmalı"). Saha denetimi: kaynak v0.29 iken makinede v0.26.3 kuruluydu → yeni
// kurulumlar bayat skill'le yapıldı. Mekanizma: `npm run release` zinciri scripts/install-local.mjs'i
// koşar; bu kontrol kaymayı görünür kılar. Skill dizini yoksa (CI, başka makine) sessiz.
function checkInstalledSkill() {
  let pkgVer = null;
  try { pkgVer = JSON.parse(read('package.json')).version; } catch { return; }
  const dizin = process.env.AGENTIC_SKILL_DIR || join(homedir(), '.claude', 'skills', 'agentic-repo-setup');
  const skillMd = join(dizin, 'SKILL.md');
  if (!existsSync(skillMd)) return;   // bu makinede kullanıcı-kapsamı kurulum yok (CI, başka makine) — ölçülecek bir şey yok
  const kurulu = parseVer(readFileSync(skillMd, 'utf8').split(/\r?\n/).find(l => /^#\s/.test(l)) || '');
  if (kurulu !== pkgVer)
    warn('kurulu-skill-bayat', `Makinedeki kurulu skill v${kurulu ?? '?'} ≠ kaynak v${pkgVer} (${dizin}).`,
      'Yeni kurulumlar bayat skill\'le yapılır. `npm run release` (ya da `npm run install:local`) kurulu skill\'i günceller.');
}

// ───────────────────────────────────────────────────────────────────────────
// 3) YETİM / BOŞ — boş dizinler (git izlemez → sessizce birikir), yetim build-artefaktı.
// ───────────────────────────────────────────────────────────────────────────
function walkDirs(dir, acc = []) {
  let entries; try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return acc; }
  const sub = entries.filter(e => e.isDirectory() && e.name !== '.git' && e.name !== 'node_modules');
  const files = entries.filter(e => e.isFile());
  if (sub.length === 0 && files.length === 0) acc.push(dir);
  for (const d of sub) walkDirs(join(dir, d.name), acc);
  return acc;
}
function checkOrphans() {
  for (const d of walkDirs(ROOT))
    warn('bos-dizin', `Boş dizin: ${d.replace(ROOT, '.').replace(/\\/g, '/')}`,
      'git boş dizin izlemez → sessiz kalıntı. Sil ya da bir .gitkeep ile niyetini belgele.');
}

// ───────────────────────────────────────────────────────────────────────────
// 4) UNTRACKED-DRİFT — yalnız-yerel (senkronsuz) iş. Uzun süre untracked kalmak
//    = başka cihazda kaybolabilir + "yapıldı" sanılan iş aslında paylaşılmamış.
// ───────────────────────────────────────────────────────────────────────────
function checkUntracked() {
  const out = git('status', '--porcelain', '--untracked-files=all') || '';
  const untr = out.split('\n').filter(l => l.startsWith('??')).map(l => l.slice(3));
  if (untr.length > 8)
    warn('untracked-drift', `${untr.length} untracked (izlenmeyen) dosya var — yalnız bu cihazda yaşıyor.`,
      'Değerliyse commit et, geçiciyse .gitignore\'a al. Senkronsuz iş kaybolabilir (çok-cihaz).');
  else if (untr.length > 0)
    info('untracked', `${untr.length} untracked dosya (eşik altı).`);
}

// ───────────────────────────────────────────────────────────────────────────
// 5) "KONSOLİDE EDİLDİ" ama AKTİF — kendini superseded ilan etmiş ama arşive gitmemiş dosya.
//    Bu reponun tam da yaşadığı entropi: faz2b-son-yapi.md "KONSOLİDE EDİLDİ" diyordu ama
//    aktif klasörde duruyordu.
// ───────────────────────────────────────────────────────────────────────────
function checkConsolidated() {
  // NET self-superseded beyanları ara. "yerine geçen" AMBİGÜ (replacement mı superseded mi?) → dışarıda.
  const İŞARET = /(KONSOL[İI]DE ED[İI]LD[İI]|\bSUPERSEDED\b|art[ıi]k (geçersiz|kullan[ıi]lm[ıi]yor|superseded)|bu (dosya|sürüm) art[ıi]k geçersiz)/i;
  const ARŞİV = /(^|\/)(arsiv|archive|arşiv)\//i;   // arşiv bölgeleri muaf
  for (const f of trackedFiles()) {
    if (!/\.(md|txt)$/i.test(f) || ARŞİV.test(f)) continue;
    const c = read(f); if (!c) continue;
    // yalnız dosyanın ÜST kısmında (ilk ~15 satır) kendini-superseded beyanı ara (gövde-içi atıf değil)
    const bas = c.split('\n').slice(0, 15).join('\n');
    if (İŞARET.test(bas))
      warn('konsolide-ama-aktif', `Kendini superseded ilan ediyor ama aktif klasörde: ${f}`,
        'arsiv/ veya archive/ altına taşı — aktif çalışma yüzeyi yalnız kanonik dosyaları taşımalı.');
  }
}

// ───────────────────────────────────────────────────────────────────────────
// 6) EXPORT-IGNORE BOŞLUĞU — pilot-benzeri içerik paylaşılan pakete sızmasın.
//    net10-durumu.html tam bu sınıftandı (kökte, hiçbir export-ignore şemsiyesi dışında).
// ───────────────────────────────────────────────────────────────────────────
function checkExportIgnore() {
  const attr = read('.gitattributes') || '';
  const pack = read('scripts/pack-skill.mjs') || '';
  for (const zone of ['pilot-proje/', 'pilot-sim/']) {
    if (existsSync(join(ROOT, zone))) {
      if (!attr.includes(zone))
        warn('export-ignore-eksik', `${zone} var ama .gitattributes export-ignore'da yok → pakete SIZAR.`);
      if (!pack.includes(zone))
        warn('banned-eksik', `${zone} pack-skill.mjs banned[] listesinde yok → sızıntı sessiz kalır.`);
    }
  }
  // kök-seviye başıboş pilot-benzeri dosya (şemsiye dışı)
  for (const f of trackedFiles().filter(f => !f.includes('/'))) {
    if (/\.(html|csv)$/i.test(f) && !attr.split('\n').some(l => l.trim() && f.endsWith(l.trim().split(/\s+/)[0].replace('*', ''))))
      info('kok-gevsek-dosya', `Kökte export-ignore belirsiz dosya: ${f} (sızıntı için kontrol et).`);
  }
}

// ── koştur ──────────────────────────────────────────────────────────────────
checkDocCounts();
checkVersion();
checkInstalledSkill();
checkOrphans();
checkUntracked();
checkConsolidated();
checkExportIgnore();

const uyarılar = findings.filter(f => f.level === 'UYARI');
// --strict = RELEASE KAPISI: yalnız release-KRİTİK bulgular bloke eder (bundle/sürüm/sızıntı/
// karar-defteri/doküman-drifti). Yerel HİJYEN (boş dizin, untracked-drift) --strict'te bile
// BLOKE ETMEZ — release, geliştiricinin/başka sürecin bıraktığı yerel kalıntı yüzünden düşmemeli
// ("gürültülü bahçıvan güvenilmez olur"; release yalnız PAKETİN kendi bütünlüğünden sorumlu).
const HIJYEN_KODLARI = new Set(['bos-dizin', 'untracked-drift', 'untracked', 'kok-gevsek-dosya']);
const bloklayan = uyarılar.filter(f => !HIJYEN_KODLARI.has(f.kod));
if (JSON_OUT) {
  console.log(JSON.stringify({ ok: uyarılar.length === 0, release_ok: bloklayan.length === 0, findings }, null, 2));
} else {
  console.log('agentic-repo-setup — SAĞLIK TARAMASI (bahçıvan ritüeli)\n');
  if (findings.length === 0) console.log('  ✓ Temiz — entropi bulgusu yok.');
  for (const f of findings) {
    const im = f.level === 'UYARI' ? 'UYARI' : 'bilgi';
    console.log(`  ${im.padEnd(5)} [${f.kod}] ${f.mesaj}`);
    if (f.ipucu) console.log(`        → ${f.ipucu}`);
  }
  console.log(`\n  ${uyarılar.length} uyarı · ${findings.length - uyarılar.length} bilgi.`);
  if (STRICT && bloklayan.length)
    console.log(`  (--strict: ${bloklayan.length} release-kritik bulgu → exit 1. Hijyen uyarıları bloke etmez.)`);
  else if (uyarılar.length && !STRICT)
    console.log('  (Bahçıvan uyarısı — bloke etmez. Release öncesi: node scripts/health-check.mjs --strict)');
  else if (STRICT)
    console.log('  (--strict: release-kritik bulgu yok → exit 0.)');
}
process.exit(STRICT && bloklayan.length ? 1 : 0);

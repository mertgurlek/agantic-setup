#!/usr/bin/env node
// Öz-doğrulama (v0.6) — paketin KENDİ bütünlüğünü kendi kapılarıyla kanıtlar.
// NEDEN VAR: "8 kapının 3'ünü koşup temiz demek" (Codex regresyonu) bu sistemin önlemek için
// var olduğu "ürettim, doğru sandım" hatasının ta kendisi. Bu komut HEPSİNİ koşar; özellikle
// doc-truth'u (layout/referans driftini yakalayan tek kapı) ATLAMAZ.
// Kullanım: node verify.mjs   (ya da: npm run verify).  Çıkış kodu: herhangi bir kapı fail → 1.
import { spawnSync } from 'node:child_process';
import { readdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// --install-exam (v0.10 YENİ) — K3 ÇIKIŞ SINAVI: bu ÖZ-DOĞRULAMADAN AYRI bir mod. Öz-doğrulama
// paketin KENDİ kapılarının statik olarak temiz geçtiğini kanıtlar (üretim öncesi); install-exam
// KURULUM BİTTİKTEN SONRA bir HEDEF repoya karşı koşulur ve "kapı kuruldu" değil "kapı gerçekten
// ETKİ ediyor mu" sorusunu sorar (archive/SKILL-V1-PLANI.md §4, Bulgu 3 — varlık≠etki).
// Ayrı dosyada yaşar (scripts/install-exam.mjs): mantığı büyük (4 bağımsız kontrol + negatif-kontrol
// denek üretimi), verify.mjs'in öz-doğrulama sorumluluğuyla karışmasın diye burada yalnız dispatch var.
if (process.argv.includes('--install-exam')) {
  const HERE = dirname(fileURLToPath(import.meta.url));
  const r = spawnSync('node', [join(HERE, 'scripts', 'install-exam.mjs'),
    ...process.argv.slice(2).filter(a => a !== '--install-exam')], { stdio: 'inherit' });
  process.exit(r.status ?? 1);
}

// --doctor (v0.14 YENİ — K23): kurulum MAKBUZU mutabakatı, install-exam kalıbının aynısı.
// Sınavdan AYRI mod çünkü soru farklı: exam kurulum ANINDA "etki var mı", doctor AYLAR SONRA
// "makbuza göre bütün mü" — iki yaşam-döngüsü sorusu tek exit koduna ezilmez.
// Mantık scripts/install-doctor.mjs'de yaşar (paketin kendi aracı; --seal mührü de orada).
if (process.argv.includes('--doctor')) {
  const HERE = dirname(fileURLToPath(import.meta.url));
  const r = spawnSync('node', [join(HERE, 'scripts', 'install-doctor.mjs'),
    ...process.argv.slice(2).filter(a => a !== '--doctor')], { stdio: 'inherit' });
  process.exit(r.status ?? 1);
}

// --upgrade (v0.15 YENİ — K24): kurulu hedef reponun GENERIC dosyalarını paketten tazeler.
// doctor ÖLÇER (salt-okur/hakem), upgrade YAZAR (uygulayıcı) — aynı araca konmadı: bu paketin
// "uygulayan ≠ doğrulayan" doktrininin araç düzeyindeki karşılığı. VARSAYILAN DRY-RUN.
if (process.argv.includes('--upgrade')) {
  const HERE = dirname(fileURLToPath(import.meta.url));
  const r = spawnSync('node', [join(HERE, 'scripts', 'upgrade.mjs'),
    ...process.argv.slice(2).filter(a => a !== '--upgrade')], { stdio: 'inherit' });
  process.exit(r.status ?? 1);
}

// Paketin KENDİ nesir/süreç dosyaları (üretilen hedef-repo doc'ları DEĞİL):
const docTruthDocs = [
  'SKILL.md', 'README.md', 'CONTRACT.md',
  'reference/multi-team.md', 'reference/doctrine.md', 'reference/external-integrations.md',
  'reference/surum-ve-karar-disiplini.md', 'reference/faz4-roller-surec.md',
  'reference/model-fiyat-referansi.md', 'reference/orkestrasyon-ve-paralellik.md',
  'archive/v0.6-KARAR-DEFTERI.md', 'archive/v0.7-KARAR-DEFTERI.md',
  'archive/v0.9-KARAR-DEFTERI.md',
  'archive/v0.14-KARAR-DEFTERI.md',
  // ⚠️ v0.12 defteri BİLİNÇLE listede değil: K18 metni hedef-repoda üretilen `scripts/size-baseline.json`
  // yoluna backtick'le atıf verir (bu repoda yok → doc-truth yanlış-FAIL üretirdi). SIDE-BUGS-LOG'da kayıtlı.
  // ⚠️ v0.16 — archive/v0.5 + v0.8 + v0.10 + v0.11 + v0.13 + v0.15 defterleri BİLİNÇLE listeden
  // çıkarıldı (AYNI emsal): 20→6 kapı konsolidasyonunda silinen eski dosya adlarına (gates/check-
  // acceptance.mjs, gates/check-brief-provenance.mjs, gates/check-placeholders.mjs, gates/check-
  // utf8.mjs, gates/check-rule-contracts.mjs, gates/check-orphan-gates.mjs, gates/check-design-
  // tokens.mjs, ...) backtick'le atıf veriyorlar. Append-only oldukları için düzeltilemez/silinemez;
  // doc-truth'a bağlı kalırsa bu dosyalar HER konsolidasyon kategorisinde yeniden FAIL üretir.
  // SIDE-BUGS-LOG'da kayıtlı (v0.12 emsaliyle aynı sınıf).
].filter(existsSync);

// v0.11 DOGFOOD: paketin KENDİ agentik katmanı (2026-07-22 kuruldu). Bunlar "hedef repoda
// üretilecek örnek" DEĞİL, bu reponun GERÇEK çalışan rehberleridir → doc-truth onları VOUCH EDER.
// Kurulmadan önce doc-truth bu repoda 0 dosya doğruluyordu (rehber yoktu) — kapı boşa dönüyordu.
// AYRI ADIMDA koşarlar (aşağıda 'doc-truth-self'): IGNORE önek listesi GLOBAL'dir — `.claude/` ve
// `docs/` öneklerini yok saysaydık BU dosyaların İÇİNDEKİ ölü yol da gizlenirdi (negatif deneyle
// doğrulandı 2026-07-22: docs/OLMAYAN-DOSYA.md IGNORE altında sessizce geçti). Bu yüzden dogfood
// rehberleri IGNORE'SUZ denetlenir; installer-doc'ları (SKILL.md/README) ise IGNORE'lu kalır.
const selfDocs = [
  'CLAUDE.md', 'AGENTS.md',
  'docs/STATE.md', 'docs/CONTEXT_BUDGET.md',
  // ⚠️ v0.16 — docs/SIDE-BUGS-LOG.md BİLİNÇLE listede değil (AYNI emsal, SB-6 kaydının kendisi):
  // append-only olduğu için satırlar düzenlenemez; SB-5 girdisi 20→6 konsolidasyonunda silinen
  // `gates/check-stale-constants.mjs` yoluna backtick'le atıf verir. Bu dosya HER konsolidasyon
  // adımında (kategori 1/2/6 dahil) yeni ölü referans üretecektir — kaynağında dışlandı.
  // ⚠️ v0.16 — docs/FRICTION_LOG.md da AYNI emsalle listeden çıkarıldı: append-only
  // (`check-history --rule=append-only` sabit listesinde), "Triyaj disiplini" bölümü
  // `gates/check-rule-contracts.mjs` adına backtick'le atıf verir (kategori-6 birleşiminde silindi,
  // yeni ad `check-self-registry.mjs --rule=rule-contracts`). Satır düzenlenirse append-only kapısı
  // FAIL verir (mekanik: dosya bazlı, tablo satırı/açıklama ayrımı yapmaz) — bu yüzden içeriği
  // DEĞİL, doc-truth listesi kaynağında dışlandı (SB-11'e ek girdi).
  '.claude/agents/kasif.md', '.claude/agents/uygulayici.md', '.claude/agents/hakem.md',
].filter(existsSync);
// placeholder taraması: harici araştırma notu da dahil (zararsız), şablonlar otomatik atlanır.
const prose = [...docTruthDocs, ...selfDocs,
  'reference/rlm-recursive-language-models-ozet.md'].filter(existsSync);
const md = (dir) => existsSync(dir)
  ? readdirSync(dir).filter(f => f.endsWith('.md')).map(f => dir === '.' ? f : `${dir}/${f}`)
  : [];
const allMd = [...md('.'), ...md('reference'), ...md('templates')];
// scripts/ = kurulumun HEDEF repoda YARATACAĞI yollar; SKILL.md onlara atıf verir ama o atıflar
// hedef-repo yollarıdır → installer-doc modunda atlanır (yanlış-pozitif değil).
// .claude/ ve docs/ önekleri de ATLANIR ama gerekçe artık FARKLI (v0.11 dogfood): bu dizinler
// ARTIK bu repoda GERÇEKTEN var. Önek yine yok-sayılır çünkü SKILL.md/README hâlâ HEDEF reponun
// docs/*.md yollarına atıf verir (docs/DECISIONS.md gibi — burada karşılığı v0.11-KARAR-DEFTERI.md).
// Bu repodaki gerçek dosyalar yine de DENETLENİR: docTruthDocs listesine AÇIKÇA eklendiler
// (önek-yoksay yalnız atıfları gevşetir, listelenen dosyanın kendi içindeki ölü yolu gizlemez).
// pilot-proje/ + pilot-sim/ = pilot proje/simülasyon alanları (export-ignore, .skill'e girmez)
// → doc-truth onları vouch ETMEZ. case-studies/ öneki KALIR: arşivlenmiş KARAR-DEFTERI'lerinin o
// tarihteki case-studies/ yol referansları (append-only, düzenlenmez) FAIL üretmesin diye (dir artık yok).
const IGNORE = '--ignore=.claude/,docs/,scripts/,case-studies/,pilot-proje/,pilot-sim/';

const steps = [
  ['utf8',         ['gates/check-hygiene.mjs', '--rule=utf8']],
  ['secrets',      ['gates/check-hygiene.mjs', '--rule=secrets', '--all']],
  ['placeholders', ['gates/check-hygiene.mjs', '--rule=placeholders', ...prose]],
  ['file-size',    ['gates/check-hygiene.mjs', '--rule=file-size', ...allMd]],
  ['doc-truth',    ['gates/check-doc-integrity.mjs', '--rule=doc-truth', ...docTruthDocs, IGNORE]],
  // v0.11 dogfood: paketin KENDİ rehberleri IGNORE'SUZ denetlenir (bkz. selfDocs yorumu —
  // IGNORE global önek filtresidir, .claude//docs/ yok-sayılsaydı bu dosyaların içindeki
  // ölü yol da gizlenirdi). Liste boşsa adım atlanır (kurulum yapılmamış repo).
  ...(selfDocs.length ? [['doc-truth-self', ['gates/check-doc-integrity.mjs', '--rule=doc-truth', ...selfDocs]]] : []),
  ['doc-recency',  ['gates/check-doc-integrity.mjs', '--rule=doc-recency', '--cascade']],   // pakette yalnız anchor ÖRNEKLERİ var (CONTRACT + module-claude şablonu, placeholder/path-değil → tripwire ATEŞLEMEZ); olgunluk katmanı yine de HER kapıyı koşar (doctrine: "8 kapının 3'ünü koşmak" hatası). `--cascade` AÇIK (dogfood, v0.18.3 hakem turu B1) — kademe 1/2 opt-in'dir, bu repo kendi zincirini koşar.
  ['acceptance',   ['gates/check-provenance.mjs', '--rule=acceptance', 'examples/acceptance.json']],
  // v0.26 dogfood: bu paketin KENDİ CLAUDE.md/README envanteri fact-işaretli — iddia↔ölçüm
  // sapması CI'da BLOKE edilir (--strict). Pre-commit'te yalnız UYARI koşar: yanlış-pozitif
  // riski (politika sabitinin ölçüm sanılması) commit'i durdurmasın, ama merge'e giremesin.
  ['facts-drift',  ['gates/check-doc-integrity.mjs', '--rule=facts-drift', '--strict']],
  // v0.13 dogfood (ECC incelemesinden uyarlanan iki VARLIK kapısı) — burada --strict koşarlar
  // çünkü ikisi de DETERMİNİSTİK varlık kontrolüdür (regex/dosya-var-mı; FP yüzeyi ~0):
  ['rule-contracts', ['gates/check-self-registry.mjs', '--rule=rule-contracts', '--strict']],   // doktrin cümlesi sessizce silinemez
  ['orphan-gates',   ['gates/check-self-registry.mjs', '--rule=orphan-gates', '--strict']],     // kurulu-ama-kayıtsız kapı kalamaz
];

console.log('agentic-repo-setup — ÖZ-DOĞRULAMA (paket kendi kapılarından geçiyor mu?)\n');
let failed = 0;
// v0.21 FAZ A (hız ekseni): adım süresi ÖLÇÜLÜR. Gözlem-only — davranış/çıkış kodu DEĞİŞMEZ.
// NEDEN: "hızlandırdık" iddiası ancak baseline varsa kanıtlanabilir; ölçmediğini vaat etme
// (doctrine). Ölçüm burada TÜRETİLİR, hiçbir dosyaya sabit olarak yazılmaz (bayatlama panzehiri).
const sureler = [];
const t0 = process.hrtime.bigint();
for (const [name, argv] of steps) {
  const adimBasi = process.hrtime.bigint();
  const r = spawnSync('node', argv, { encoding: 'utf8' });
  const ms = Number(process.hrtime.bigint() - adimBasi) / 1e6;
  sureler.push([name, ms]);
  const all = ((r.stdout || '') + (r.stderr || '')).trim();
  if (r.status === 0) {
    const last = (r.stdout || '').trim().split('\n').filter(Boolean).pop() || 'OK';
    const warned = /UYAR|⚠/i.test(all);   // kapı geçti ama uyarı bastıysa yüzeye çıkar (yutma)
    console.log(`  OK   ${name.padEnd(13)} ${last}${warned ? '   (uyarı ↓)' : ''}`);
    if (warned) console.log((r.stderr || '').trim().split('\n').map(l => '         ' + l).join('\n'));
  } else {
    failed++;
    console.log(`  FAIL ${name.padEnd(13)} ↓`);
    console.log(all.split('\n').map(l => '         ' + l).join('\n'));
  }
}
const toplamMs = Number(process.hrtime.bigint() - t0) / 1e6;
console.log();

// --sure: adım kırılımı (hangi kapı darboğaz). Bayraksız koşuda yalnız toplam basılır —
// mevcut çıktı biçimi korunur (kırılım isteyen açıkça ister).
if (process.argv.includes('--sure')) {
  console.log('SÜRE KIRILIMI (ms, yavaştan hızlıya):');
  for (const [name, ms] of [...sureler].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${String(Math.round(ms)).padStart(6)} ms  ${name}`);
  }
  // 🔴 ÖLÇÜM UYARISI (2026-08-12'de ampirik olarak yaşandı): İLK koşu soğuk-başlangıç taşır —
  // ölçümde toplam 2,6 sn çıktı, ısınmış ardışık koşularda 0,8 sn (CLAUDE.md baseline'ı DOĞRU).
  // Tek ölçümle "yavaşladı/hızlandı" denmez; karşılaştırma ısınmış koşular arasında yapılır.
  console.log('  (ilk koşu soğuk-başlangıç taşır — karşılaştırmayı ısınmış ardışık koşuda yap)');
  console.log();
}
if (failed) {
  console.error(`ÖZ-DOĞRULAMA BAŞARISIZ — ${failed} kapı fail. Yukarıyı düzelt, tekrar koş.`);
  process.exit(1);
}
// Sayı steps[]'ten TÜRETİLİR, elle yazılmaz: v0.11'de dogfood adımı eklenince sabit "7" drift
// etmişti (koşan 8, yazan 7). Rehberdeki sayı kaynağından okunmalı — bu paketin kendi doktrini.
console.log(`ÖZ-DOĞRULAMA OK — paket ${steps.length} statik kapısından temiz geçti. (${(toplamMs / 1000).toFixed(1)} sn)`);
console.log('(append-only + co-update = staged-diff kapıları; hedef reponun commit anında koşar, pakette no-op.)');

#!/usr/bin/env node
// Provenance kategori kapısı. Alt-kurallar: aşağıdaki RULES[]; sözleşme: CONTRACT.md "Kapı kayıt tablosu".
// ORTAK EKSEN: paylaşılan YAML/JSON mini-parser (gates/lib/mini-yaml.mjs) + "iddia edilen durum,
// gerçek durumla tutarlı mı" (provenance/traceability) doluluk kontrolü. Dördü de VARLIK-sınıfı:
// alanın DOLU/tutarlı olduğunu zorlar, İÇERİĞİN doğru olduğunu değil (o Hakem/E2 işidir — her
// alt-kuralın kendi başlık yorumunda ayrıca yazılıdır, silinmedi).
//
//
// Kullanım:
//   node check-provenance.mjs                              → argümansız: RULES[]'teki TÜM alt-kurallar koşar
//   node check-provenance.mjs --rule=acceptance [...]       → yalnız o alt-kural (eski bayraklar korunur)
//   node check-provenance.mjs --rule=brief-provenance [...]
//   node check-provenance.mjs --rule=coverage-gate [...]
//   node check-provenance.mjs --rule=registry-join [...]
//   node check-provenance.mjs --rule=config-flags [--strict] [--dictionary=<yol>] [dosya...]
//   node check-provenance.mjs --rule=integration-cards [manifest...] [--cards=<dizin>] [--bayat-gun=N] [--strict]
//
// 🔴 v0.17.1'de DENENİP GERİ ÇEKİLEN alt-kural: `behavior-anchor-fit` (behavior↔anchor token
// kesişimi). ÖLÇÜM ÇÜRÜTTÜ: 12 gerçekçi + DOĞRU anchor'lanmış çiftte 11 yanlış-pozitif (%92) —
// kapı semantik uyumu değil TR/EN DİL ÖZDEŞLİĞİNİ ölçüyordu ("Şifre en az 8 karakter olmalıdır"
// ↔ `src/auth/password.spec.ts#requiresMinLength` doğru anchor, yine de bağırıyordu). SB-8-rev emsali
// (docs/SIDE-BUGS-LOG.md) aynı gerekçeyle bir kapıyı zaten yazmamıştı: "yanlış-alarm kapıyı
// öldürür — ALTIN KURAL". Bu sınıfın kanonik savunması E2'dedir: `.claude/agents/hakem.md` md.3b.
// Yeniden denenecekse dil-agnostik bir sinyal gerekir (feature_ids/dosya-yolu örtüşmesi gibi).
// Argümansız TÜM-KURAL modda her alt-kural KENDİ argümansız (varsayılan hedef bulma) davranışıyla
// koşar; sıfırdan-fazla ihlal varsa toplam exit kodu en kötüsünü yansıtır (herhangi biri FAIL → 1).
import { execSync } from 'node:child_process';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname, resolve, relative, isAbsolute } from 'node:path';
import { kunyeSurumuEnAz, ESKI_KUNYE_NOTU } from './lib/kunye-surum.mjs';
import {
  parseRegistry, extractFeatureIds, parseBrief, scalar, filled,
  frontmatter, readTechDocs, readCoverageStatus, readCoverageMissing, readVerificationStatus,
  readMockGuardedCount, readRiskSinifi, readKanitTipi, countMockGuardedAnchors, hasTestAnchors,
  readAvailability, readYamlList, readIndentedBlock, parseConfigFlags, parseFeatureDictionary, parseTechFlags,
} from './lib/mini-yaml.mjs';

const RULES = ['acceptance', 'brief-provenance', 'coverage-gate', 'registry-join', 'config-flags', 'integration-cards'];

// =====================================================================================
// RULE: acceptance
// =====================================================================================
function runAcceptance(argv) {
  const releaseMode = argv.includes('--release');
  // NOT: `--allow-empty` burada BİLİNÇLE okunmaz — bu alt-kural boş-küme FAIL'inden muaftır
  // (aşağıdaki gerekçe bloğu). Bayrak verilirse zararsızca yok sayılır (geriye-uyum).
  const args = argv.filter(a => !a.startsWith('-'));
  const files = args.length
    ? args
    : execSync('git ls-files', { maxBuffer: 64 * 1024 * 1024 })
        .toString('utf8').split('\n').filter(Boolean)
        .filter(f => /\.acceptance\.json$/i.test(f));

  const fails = [];
  const warns = [];
  const missing = [];   // argümanla verildi ama diskte yok — ŞÜPHELİ (ana ajan ölçtü: 2026-08-06)
  let totalCriteria = 0;
  let scanned = 0;   // GERÇEKTEN okunan dosya sayısı — files.length NİYET EDİLENİ sayar, bunu değil

  for (const f of files) {
    if (!existsSync(f)) { if (args.length) missing.push(f); continue; }
    scanned++;
    let doc;
    try { doc = JSON.parse(readFileSync(f, 'utf8')); }
    catch (e) { fails.push(`${f}  →  JSON parse edilemedi: ${e.message}`); continue; }

    if (!Array.isArray(doc.criteria) || doc.criteria.length === 0) {
      fails.push(`${f}  →  "criteria" dizisi yok/boş (kabul ölçütü olmayan iş "ready" olamaz).`);
      continue;
    }
    const released = /released|ready_for_release/i.test(doc.status ?? '');
    for (const c of doc.criteria) {
      totalCriteria++;
      const tag = `${f} [${c.id ?? '?'}]`;
      if (typeof c.passes !== 'boolean') {
        fails.push(`${tag}  →  "passes" boolean değil (açık true/false şart).`); continue;
      }
      if (c.passes === true && !(typeof c.evidence === 'string' && c.evidence.trim().length >= 4)) {
        fails.push(`${tag}  →  passes:true ama "evidence" boş. Kanıtsız done kabul edilmez.`);
      }
      if (c.passes === false) {
        if (releaseMode || released)
          fails.push(`${tag}  →  passes:false ama status="${doc.status}". Release'e hazır değil.`);
        else
          warns.push(`${tag}  →  passes:false (henüz tamamlanmadı).`);
      }
    }
  }

  if (warns.length)
    console.warn(`\nACCEPTANCE UYARI (${warns.length}):\n` + warns.map(w => '  ' + w).join('\n'));
  if (fails.length) {
    console.error(`\nACCEPTANCE KAPISI FAIL (${fails.length}):\n` + fails.map(x => '  ' + x).join('\n'));
    console.error('\nYapilacak: kriteri gercekten karsila + kaniti yaz, ya da status\'u dururuma cek.');
    console.error('NOT: bu kapi kaniti DOGRULAMAZ; Hakem kaniti AC\'ye karsi denetler.\n');
    return 1;
  }

  if (missing.length) {
    console.error(`\nACCEPTANCE KAPISI FAIL — ${missing.length} verilen dosya diskte YOK:\n` +
      missing.map(f => `  ${f}`).join('\n'));
    console.error('\n  "temiz" ile "hiç bakmadım" farklıdır: argümanla verilen dosya okunamadıysa kayıptır.\n');
    return 1;
  }

  // Boş-küme körlüğü (v0.18.2, pilot bulgusu A) — `acceptance` BU KURALDAN MUAFTIR.
  // Hakem turu ölçtü ve ana ajanın ilk kapsam kararını ÇÜRÜTTÜ (2026-08-06): bu alt-kural OPT-IN
  // ARTEFAKT tabanlıdır ("tracked `*.acceptance.json` + opt-in" — CONTRACT kapı tablosu; SKILL.md:
  // "`*.acceptance.json` VARSA verify reçetesine ekle"). Kabul kriteri dosyası iş yapıldıkça DOĞAR;
  // henüz yazmamış bir hedef repoda 0 dosya DOĞALDIR — staged-diff kapılarındaki 0 ile aynı sınıf.
  // FAIL koymak "kurmayan/kullanmayan repo yeni FAIL görmez" sözleşmesini (CONTRACT madde 1-13)
  // kırar ve kurulumun ilk günü CI'ı kırmızıya çevirirdi = yanlış-alarm, kapıyı öldüren şey.
  // `missing[]` kontrolü (yukarıda) KALIR: açıkça verilen dosya diskte yoksa o hâlâ kayıptır.
  console.log(`Acceptance OK — ${scanned} dosyada ${totalCriteria} kriter denetlendi${releaseMode ? ' (release modu)' : ''}.${scanned === 0 ? ' (opt-in artefakt yok — no-op)' : ''} [taranan=${scanned}]`);
  return 0;
}

// =====================================================================================
// RULE: brief-provenance (parseBrief/scalar/filled
// artık gates/lib/mini-yaml.mjs'ten import edilir, gövde aynı)
// =====================================================================================
function runBriefProvenance(argv) {
  const strict = argv.includes('--strict');
  const posArgs = argv.filter(a => !a.startsWith('-'));

  const DEFAULT_DIRS = ['docs/test-briefs', 'test-briefs'];
  function listDefaultBriefs() {
    const files = [];
    for (const d of DEFAULT_DIRS) {
      if (!existsSync(d)) continue;
      let entries;
      try { entries = readdirSync(d); } catch { continue; }
      for (const f of entries) {
        if (/\.ya?ml$/i.test(f) && !/\.template\.ya?ml$/i.test(f)) files.push(join(d, f));
      }
    }
    return files;
  }

  const targets = posArgs.length ? posArgs : listDefaultBriefs();
  if (!targets.length) {
    console.log('Brief-provenance OK — test-brief yok (kapi opt-in; [toggle: test-koprusu] kapaliysa no-op).');
    return 0;
  }

  const fails = [];
  const warns = [];

  for (const path of targets) {
    if (!existsSync(path)) {
      fails.push(`${path}: dosya yok (arguman ile verildi ama bulunamadi).`);
      continue;
    }
    let brief;
    try { brief = parseBrief(readFileSync(path, 'utf8')); }
    catch (e) { fails.push(`${path}: parse edilemedi (${e.message}) — gecersiz test-brief.`); continue; }

    const approved = brief.status === 'approved';

    if (!filled(brief.source_commit))
      fails.push(`${path}: PROVENANCE EKSIK — source_commit bos/placeholder (hangi commit'ten turedigi izlenemez).`);
    if (!filled(brief.source.feature_id))
      fails.push(`${path}: PROVENANCE EKSIK — source.feature_id bos/placeholder (registry demiri yok).`);
    if (!filled(brief.source.tech_doc))
      fails.push(`${path}: PROVENANCE EKSIK — source.tech_doc bos/placeholder ([T] kaynagi izlenemez).`);

    brief.steps.forEach((s, i) => {
      if (!filled(s.derived_from))
        fails.push(`${path}: KAYNAKSIZ STEP — steps[${i}].derived_from bos ([T]-anchor yok; kaynaksiz test-case = uydurma riski).`);
    });
    brief.edges.forEach((e, i) => {
      if (!filled(e.derived_from))
        fails.push(`${path}: KAYNAKSIZ EDGE-CASE — edge_cases[${i}].derived_from bos ([T]-anchor yok; kaynaksiz test-case = uydurma riski).`);
    });

    if (approved && (brief.unknown_fields.length || brief.needs_review.length)) {
      const n = brief.unknown_fields.length + brief.needs_review.length;
      fails.push(`${path}: FAIL-CLOSED IHLALI — status: approved ama unresolved DOLU (${n} acik uc: ` +
        `unknown_fields=${brief.unknown_fields.length}, needs_review=${brief.needs_review.length}). Cozulmeden onay olamaz.`);
    }

    if (brief.crosscheck_status === 'mismatch' && approved) {
      fails.push(`${path}: SEMANTIK-DRIFT IHLALI — assertion_crosscheck.status: mismatch ama status: approved. ` +
        `[T].expected ile unit-test assertion'lari uyusmuyor; drift cozulmeden onay olamaz.`);
    }
    if (brief.crosscheck_status === 'no_unit_test' && approved) {
      warns.push(`${path}: CROSSCHECK UYARISI — assertion_crosscheck.status: no_unit_test ve approved. ` +
        `Fibery Test Scenario TEK oracle; --strict'te bu FAIL olur (insan crosscheck onayi zorunlu).`);
    }

    if (approved) {
      for (const k of ['module', 'client']) {
        const v = brief.fibery[k];
        if (v !== null && /^UNKNOWN$/i.test(scalar(v)))
          fails.push(`${path}: FIBERY SCHEMA-REQUIRED IHLALI — fibery_fields.${k} == UNKNOWN ama status: approved. ` +
            `Module/Client Fibery'de schema-required; cozulmeden yayina onay olamaz.`);
      }
    }
  }

  if (strict && warns.length) { fails.push(...warns.splice(0)); }

  if (warns.length)
    console.warn(`\nBRIEF-PROVENANCE UYARI (${warns.length}):\n` + warns.map(w => '  ' + w).join('\n') + '\n');

  if (fails.length) {
    console.error(`BRIEF-PROVENANCE FAIL (${fails.length}):\n` + fails.map(f => '  ' + f).join('\n'));
    console.error('\nYapilacak: her test-case bir [T]-anchor\'a demirlenmeli (derived_from DOLU); cozulmemis/uyusmayan');
    console.error('alan varken status: approved OLAMAZ. Kapi SADECE yapisal provenance denetler — icerik kalitesi Hakem (E2) isidir.\n');
    return 1;
  }
  console.log(`Brief-provenance OK — ${targets.length} test-brief denetlendi, provenance butunlugu saglam.`);
  return 0;
}

// =====================================================================================
// RULE: coverage-gate (frontmatter yardımcıları
// artık gates/lib/mini-yaml.mjs'ten import edilir, gövde aynı)
// =====================================================================================
const PARA_VERI_SINYAL = /\b(addcredits?|refund|payment|charge|invoice|billing|balance|credit|debit|wallet|payout|iade|bakiye|ödeme|tahsilat|fatura|cüzdan|para|kredi)\b|\b(delete|drop|truncate|purge|wipe|sil|kaldır)\b/i;
function paraVeriSinyaliVar(fm, body) {
  return PARA_VERI_SINYAL.test(fm) || PARA_VERI_SINYAL.test(body || '');
}

function runCoverageGate(argv) {
  const strict = argv.includes('--strict');
  const args = argv.filter(a => !a.startsWith('-'));

  let tracked = [];
  try {
    tracked = execSync('git ls-files', { maxBuffer: 64 * 1024 * 1024 })
      .toString('utf8').split('\n').filter(Boolean);
  } catch { /* git yoksa argüman zorunlu */ }

  let l0Files = args;
  if (!l0Files.length) {
    l0Files = tracked.filter(f => /^docs\/user\/.*\.md$/i.test(f) && !/\.template\.md$/i.test(f));
  }
  l0Files = l0Files.filter(f => !/\.template\.md$/i.test(f));

  const findings = [];
  // K81: v0.30'da eklenen YENİ yapısal bulgular (eksik-iken-susturulamaz yapısal + eksik/missing[] çapraz kontrolü)
  // ayrı tutulur: künyesi v0.30+ (ya da künyesiz) repoda --strict FAIL; eski künyede UYARI + yükseltme notu.
  const yeniFindings = [];
  const sikiKademe = kunyeSurumuEnAz('.', '0.30.0');
  let checkedL0 = 0;

  for (const l0Path of l0Files) {
    if (!existsSync(l0Path)) { findings.push(`${l0Path}  →  [L0] dosyası yok`); continue; }
    checkedL0++;
    const l0Text = readFileSync(l0Path, 'utf8');
    const l0Fm = frontmatter(l0Text);
    const techDocs = readTechDocs(l0Fm);
    const coverageStatus = readCoverageStatus(l0Fm);
    const docDir = dirname(l0Path);

    // İKİ SINIF (saha yaması pilot-backend, v0.30 B9a):
    //   yapisal[] = REFERANS GEÇERLİLİĞİ — `coverage.status: eksik` bunu SUSTURAMAZ
    //   problems[] = DOĞRULAMA DURUMU — `eksik` beyanı bunu susturur (eski davranış)
    // `eksik` bir BİLGİ BEYANIDIR, af yetkisi değil: "henüz doğrulanmadı" susturulabilir,
    // "referans bozuk" (dosya yok / kök-dışı / frontmatter okunamıyor) YANLIŞLIKTIR.
    const yapisal = [];
    const problems = [];

    if (!techDocs.length) {
      yapisal.push('anchors.tech_docs boş — hiçbir [T] beslemiyor');
    }

    for (const tPath of techDocs) {
      // Kök-dışı referans: çözülen mutlak yol repo kökünün (cwd) dışına çıkıyorsa.
      // (`../tech/x.md` docs/user/ içinden köke DÜŞÜYORSA meşrudur; `../../../etc/passwd` değildir.)
      const kokDisi = [resolve(tPath), resolve(docDir, tPath)].every(a => {
        const rel = relative(process.cwd(), a);
        return rel.startsWith('..') || isAbsolute(rel);
      });
      if (kokDisi) {
        yapisal.push(`[T] kök-dışı referans: ${tPath} — repo ağacının dışına çıkıyor`);
        continue;
      }
      const resolved = [tPath, join(docDir, tPath)].find(existsSync);
      if (!resolved) {
        yapisal.push(`[T] yok: ${tPath}`);
        continue;
      }
      // Dosya VAR ama frontmatter sınırı yok/bozuk → alanlar sessizce boş okunur.
      if (!frontmatter(readFileSync(resolved, 'utf8')).trim()) {
        yapisal.push(`[T] frontmatter okunamıyor (sınır yok/bozuk): ${tPath}`);
        continue;
      }
      const tFm = frontmatter(readFileSync(resolved, 'utf8'));
      const vStatus = readVerificationStatus(tFm);
      const declared = readMockGuardedCount(tFm);
      const actual = countMockGuardedAnchors(tFm);
      const riskSinifi = readRiskSinifi(tFm);
      const kanitTipi = readKanitTipi(tFm);
      const tBody = readFileSync(resolved, 'utf8').slice(tFm.length);

      const paraSinyali = paraVeriSinyaliVar(tFm, tBody);
      const beyanNormal = !riskSinifi || riskSinifi === 'normal';
      const gizliP0 = paraSinyali && beyanNormal;
      if (vStatus === 'dogrulandi' && gizliP0 && kanitTipi !== 'test' && kanitTipi !== 'calistirma') {
        problems.push(
          `[T] ${tPath}: 🔴 GİZLİ P0 — metin/anchor'larda PARA/VERİ sinyali VAR ama risk_sinifi=${riskSinifi ?? '(yok)'} beyan edilmiş. ` +
          `risk_sinifi enforcement'ı değiştiren SELF-REPORT'tur (Codex 7. dersi); sinyal varken 'normal' demek denetimden kaçış olabilir. ` +
          `→ ya risk_sinifi'nı düzelt (para/veri) ya kanit_tipi: test/calistirma ile kanıtla ya HAKEM 'normal'ı onaylasın (status: kontrol-bekliyor).`
        );
        continue;
      }

      if (vStatus === 'dogrulandi' && (riskSinifi === 'para' || riskSinifi === 'veri') && kanitTipi !== 'test' && kanitTipi !== 'calistirma') {
        problems.push(
          `[T] ${tPath}: 🔴 P0-REPRO EKSİK — risk_sinifi=${riskSinifi} + kanit_tipi=${kanitTipi ?? '(yok)'} ile \`dogrulandi\` OLAMAZ. ` +
          `Para/veri riskli davranışsal iddia salt-okumayla ya da eksik kanit_tipi ile KANITLANAMAZ (pilot: 35 [T]'nin yalnız 3'ü doğrulanmış). ` +
          `→ en az \`kanit_tipi: test\` ya da \`calistirma\` ister, ya da \`verification.status: kontrol-bekliyor\` OLMALI.`
        );
        continue;
      }

      if (declared !== actual) {
        problems.push(
          `[T] ${tPath}: 🔴 BEYAN-GERÇEK ÇELİŞKİSİ — mock_guarded_count=${declared} yazılmış ama ` +
          `test_anchors içinde ${actual} adet \`mock_depth: mock-guarded\` VAR. ` +
          `Rollup self-report'tur; GERÇEK sayı esastır (SKILL-V1-PLANI §2.2).`
        );
        continue;
      }

      const mockGuarded = Math.max(declared, actual);

      if (mockGuarded > 0) {
        problems.push(`[T] ${tPath}: mock-guarded test sayısı=${mockGuarded} → \`dogrulandi\` sayılamaz (davranış hiç koşmuyor — reference/pilot-dersleri.md §3)`);
        continue;
      }

      if (vStatus === 'dogrulandi' && !hasTestAnchors(tFm)) {
        problems.push(
          `[T] ${tPath}: 🔴 KANITSIZ \`dogrulandi\` — \`test_anchors\` YOK/BOŞ. ` +
          `"Doğrulandı" bir KANIT iddiasıdır; kanıtı test_anchor'dır. Test yoksa doğrulama da yoktur. ` +
          `→ \`verification.status: kontrol-bekliyor\` OLMALI (ya da test_anchors ekle).`
        );
        continue;
      }
      if (vStatus !== 'dogrulandi') {
        problems.push(`[T] ${tPath}: verification.status=${vStatus ?? '(yok)'} — \`dogrulandi\` değil`);
      }
    }

    // ① YAPISAL — `coverage.status` NE OLURSA OLSUN rapor edilir (af yok).
    // coverage.status≠eksik iken eski sürüm de bunları raporlardı (sert); `eksik` iken YENİ bulgu (kademeli).
    if (yapisal.length) {
      (coverageStatus === 'eksik' ? yeniFindings : findings).push(`${l0Path}  →  🔴 REFERANS BÜTÜNLÜĞÜ (coverage.status=${coverageStatus ?? '(yok)'} bunu SUSTURAMAZ):\n` +
        yapisal.map(p => `      - ${p}`).join('\n'));
    }

    // ② DOĞRULAMA DURUMU — `eksik` beyanı susturur (mevcut davranış korunur).
    if (problems.length && coverageStatus !== 'eksik') {
      findings.push(`${l0Path}  →  coverage.status=${coverageStatus ?? '(yok)'} olmalıydı \`eksik\`:\n` +
        problems.map(p => `      - ${p}`).join('\n'));
    }

    // ③ `eksik` BEYANININ BEDELİ — missing[] çapraz kontrol (yapisal da problem sayımına girer).
    // DÜRÜST SINIR: `missing: ["TODO"]` gibi SEMANTİK kandırma makineyle yakalanamaz.
    // Bulgular yalnız --strict'te FAIL olur (aşağıda); eski kurulumlara sessiz yeni FAIL dayatılmaz.
    if (coverageStatus === 'eksik') {
      const missing = readCoverageMissing(l0Fm);
      const toplam = problems.length + yapisal.length;
      if (!missing.length && toplam) {
        yeniFindings.push(`${l0Path}  →  🔴 coverage.status=eksik ama \`missing[]\` BOŞ — ` +
          `${toplam} problem ölçüldü, hiçbiri beyan edilmemiş. NEYİN eksik olduğu yazılmalı.`);
      } else if (!missing.length && !toplam) {
        yeniFindings.push(`${l0Path}  →  🔴 coverage.status=eksik ama ölçülen HİÇBİR problem YOK ` +
          `ve \`missing[]\` boş — besleyen [T]'lerin tümü \`dogrulandi\`. \`tam\` olmalı.`);
      }
    }
  }

  // Eski künye: yeni bulgular --strict'te bile yalnız UYARI (sert bulgu yoksa exit 0).
  const yeniSert = sikiKademe ? yeniFindings : [];
  if (!sikiKademe && yeniFindings.length) {
    console.warn(`\nCOVERAGE-GATE UYARI (${yeniFindings.length} [L0], eski künye — FAIL değil):\n` +
      yeniFindings.map(f => '  ' + f).join('\n') + `\n  ${ESKI_KUNYE_NOTU}\n`);
  }
  const tumFindings = [...findings, ...yeniSert];
  if (tumFindings.length) {
    const msg = `\nCOVERAGE-GATE ${strict ? 'FAIL' : 'UYARI'} (${tumFindings.length} [L0] tutarsız):\n` +
      tumFindings.map(f => '  ' + f).join('\n') +
      `\n\n  • Kural: [L0].anchors.tech_docs'un TAMAMI (a) dosya olarak VAR ve (b) verification.status: dogrulandi` +
      `\n    OLMADIKÇA (mock_guarded_count>0 olan [T] 'dogrulandi' SAYILMAZ) → coverage.status: eksik OLMALI.` +
      `\n  • P0-REPRO: risk_sinifi: para|veri + kanit_tipi test/calistirma OLMAYAN (okuma ya da boş) [T] de 'dogrulandi' SAYILMAZ` +
      `\n    (salt-okuma/eksik-beyan yüksek-riskli davranışsal iddiada kanıt değildir — pilot: 35 [T]'nin yalnız 3'ü doğrulanmış).` +
      `\n  • eksik iken bu makale YAYINA ÇIKAMAZ — halüsinasyon önlemi (gerçek pilot: "forgot-password rotası — henüz yok").` +
      `\n  • Düzelt: ya eksik [T]'yi tamamla/doğrulat, ya coverage.status: eksik + coverage.missing[] doldur.\n`;
    if (strict) { console.error(msg + '(--strict: commit/CI bloke edildi)\n'); return 1; }
    console.warn(msg);
    return 0;
  }
  console.log(`Coverage-gate OK — ${checkedL0} [L0] dosyasında besleme zinciri tutarlı.`);
  return 0;
}

// =====================================================================================
// RULE: registry-join (parseRegistry/extractFeatureIds
// artık gates/lib/mini-yaml.mjs'ten import edilir, gövde aynı)
// =====================================================================================
function runRegistryJoin(argv) {
  const strict = argv.includes('--strict');
  const ignoreT = (argv.find(a => a.startsWith('--ignore-t=')) || '')
    .replace('--ignore-t=', '').split(',').map(s => s.trim()).filter(Boolean);
  const posArgs = argv.filter(a => !a.startsWith('-'));

  const DEFAULT_LOCATIONS = ['docs/registry.yaml', 'docs/registry.yml', 'registry.yaml', 'registry.yml', 'docs/tech/registry.yaml'];
  const registryPath = posArgs[0] || DEFAULT_LOCATIONS.find(existsSync);
  if (!registryPath || !existsSync(registryPath)) {
    console.log('Registry-join OK — registry dosyası yok (kapı opt-in; kullanmayan ödemez).');
    return 0;
  }

  let registryFeatures;
  try {
    registryFeatures = parseRegistry(readFileSync(registryPath, 'utf8'));
  } catch (e) {
    console.error(`REGISTRY-JOIN FAIL — ${registryPath} okunamadı: ${e.message}`);
    return 1;
  }

  const tracked = execSync('git ls-files', { maxBuffer: 64 * 1024 * 1024 })
    .toString('utf8').split('\n').filter(Boolean);
  const tFiles = tracked.filter(f =>
    /\.md$/i.test(f) && !/\.template\.md$/i.test(f) &&
    !ignoreT.some(p => f.startsWith(p)));

  const tDocs = new Map();
  for (const f of tFiles) {
    let content;
    try { content = readFileSync(f, 'utf8'); } catch { continue; }
    const ids = extractFeatureIds(content);
    if (ids !== null) tDocs.set(f, ids);
  }

  if (!tDocs.size && !registryFeatures.size) {
    console.log('Registry-join OK — registry boş ve [T] dosyası yok (etki alanı boş).');
    return 0;
  }

  const fails = [];
  const warns = [];

  const orphanT = [...tDocs.entries()].filter(([, ids]) => ids.length === 0).map(([f]) => f);
  if (orphanT.length)
    warns.push(`YETİM [T] — feature_ids boş, hiçbir [L0]'a görünmez (${orphanT.length}):\n` +
      orphanT.map(f => `    ${f}`).join('\n'));

  for (const [id, docs] of registryFeatures) {
    for (const doc of docs) {
      if (!existsSync(doc))
        fails.push(`ÖLÜ YOL — features.${id}.tech_docs şuna işaret ediyor ama dosya yok: ${doc}`);
    }
  }

  for (const [tPath, ids] of tDocs) {
    for (const id of ids) {
      if (!registryFeatures.has(id)) {
        fails.push(`ÇAPRAZ TUTARSIZLIK — ${tPath} kendini "${id}" feature'ına ait sayıyor ama registry'de "${id}" YOK.`);
        continue;
      }
      if (!registryFeatures.get(id).has(tPath)) {
        fails.push(`ÇAPRAZ TUTARSIZLIK — ${tPath} "${id}" feature_ids'inde ama registry.features.${id}.tech_docs onu LİSTELEMİYOR.`);
      }
    }
  }
  for (const [id, docs] of registryFeatures) {
    for (const doc of docs) {
      if (!existsSync(doc)) continue;
      const ids = tDocs.get(doc);
      if (ids === undefined) {
        fails.push(`ÇAPRAZ TUTARSIZLIK — registry.features.${id}.tech_docs "${doc}"'yu listeliyor ama o dosyada feature_ids alanı yok (ya da [T] şablonu değil).`);
      } else if (!ids.includes(id)) {
        fails.push(`ÇAPRAZ TUTARSIZLIK — registry.features.${id}.tech_docs "${doc}"'yu listeliyor ama o dosyanın feature_ids'i "${id}"'yi İÇERMİYOR.`);
      }
    }
  }

  const totalFeatures = registryFeatures.size;
  const resolvedFeatures = [...registryFeatures.values()].filter(docs => docs.size > 0).length;
  const resolutionRate = totalFeatures ? resolvedFeatures / totalFeatures : 1;
  const orphanRate = tDocs.size ? orphanT.length / tDocs.size : 0;
  const healthMsgs = [];
  if (totalFeatures && resolutionRate < 0.90)
    healthMsgs.push(`ÇÖZÜNÜRLÜK ORANI DÜŞÜK — feature_id'lerin %${(resolutionRate * 100).toFixed(0)}'i ≥1 [T]'ye çözülüyor (eşik: ≥%90).`);
  if (tDocs.size && orphanRate >= 0.10)
    healthMsgs.push(`YETİM [T] ORANI YÜKSEK — [T]'lerin %${(orphanRate * 100).toFixed(0)}'i hiçbir feature'a bağlı değil (eşik: <%10).`);

  if (healthMsgs.length) {
    if (strict) fails.push(...healthMsgs);
    else warns.push(...healthMsgs);
  }

  if (warns.length)
    console.warn(`\nREGISTRY-JOIN UYARI (${warns.length}):\n` + warns.map(w => '  ' + w).join('\n') + '\n');

  if (fails.length) {
    console.error(`REGISTRY-JOIN FAIL (${fails.length}):\n` + fails.map(f => '  ' + f).join('\n'));
    console.error('\nYapilacak: registry.features[id].tech_docs ile [T].feature_ids birbirini KARSILIKLI dogrulamali.');
    console.error('Bu kapi SADECE yapisal butunlugu denetler — feature_id isimlendirme/granulerlik kalitesi Hakem (E2) isidir.\n');
    return 1;
  }
  console.log(`Registry-join OK — ${totalFeatures} feature, ${tDocs.size} [T] dosyası, ${orphanT.length} yetim, çapraz tutarsızlık yok.`);
  return 0;
}

// =====================================================================================
// RULE: config-flags (v0.20 — konfig ekseni; pilot geri bildirimi 2026-08-11 §5.1)
// SINIF: opt-in-artefakt. TETİKLEYİCİ = kanonik sözlük dosyası (`docs/FEATURE-DICTIONARY.md`).
// Sözlük YOKSA alt-kural TÜMÜYLE NO-OP'tur (registry-join deseni) — çok-kiracılı olmayan ya da
// toggle'ı kapalı repo TEK yeni FAIL görmez (CONTRACT madde 1-13 sözleşmesi).
//
// NE ZORLAR (YAPI, düşük-FP): beyan ↔ dayanak tutarlılığı + şema biçimi + sözlük drift'i.
// NE ZORLAYAMAZ (dürüstlük sınırı): ÖLÇÜMÜN DOĞRULUĞUNU. `paid_feature: null` yazan bir makale
// gerçekten ölçüldü mü yoksa uydurdu mu — bunu kapı GÖREMEZ, o Hakem/E2 işidir. Kapı yalnız
// "bu soru CEVAPLANDI mı" der; "cevap DOĞRU mu" demez.
// =====================================================================================
// v0.20.1 — BEŞİNCİ sınıf `kapsam` ÖLÇÜLEREK eklendi (hedef repoda kod okundu 2026-08-12):
//   `if (!isXFeatureActive) return listeyiOlduguGibi;` — kullanıcı hata GÖRMEZ, liste de
//   filtrelenmez; İŞLEMİN KAPSAMI sessizce daralır (bağlı kayıtlara dokunulmaz). Ne `engel`
//   (hata yok) ne `gorunurluk` (görünen veri eksilmiyor) — ayrı bir semptom, ayrı bir cevap.
// 🔴 İki aday sınıf (`giris-yok`, `akis`) ÖLÇÜLDÜ ve EKLENMEDİ: istemciye giden yetenek
//    bayrakları bulundu ama tüketen yüzeyde kullanımı DOĞRULANAMADI (0 dosya). "Enum'da olmak
//    ≠ kapı uygulanmak" — kanıtsız sınıf eklemek bu paketin kendi yasağıdır.
const ETKI_SINIFLARI = ['engel', 'kisit', 'hesap', 'gorunurluk', 'kapsam'];
// Ayar TİPİ (v0.20.1): şema eskiden BOOLEAN varsayıyordu. Hedef repoda ölçüldü — ayar
// alanlarının yaklaşık üçte biri bool DEĞİL (sayı eşiği/enum/metin). `when_false` onlarda ANLAMSIZDIR
// ("false" hâli yok) ve yazan kişi uydurmak zorunda kalıyordu; kapı da onaylıyordu.
const AYAR_TIPLERI = ['bool', 'sayi', 'secim', 'metin'];
const CS_HER_ZAMAN_ZORUNLU = ['field', 'default', 'etki'];

function runConfigFlags(argv) {
  const strict = argv.includes('--strict');
  const dictArg = argv.find(a => a.startsWith('--dictionary='));
  const args = argv.filter(a => !a.startsWith('-'));
  const dictPath = dictArg ? dictArg.slice('--dictionary='.length) : 'docs/FEATURE-DICTIONARY.md';

  if (!existsSync(dictPath)) {
    console.log(`Config-flags: kanonik sözlük yok (${dictPath}) → no-op (konfig ekseni kurulu değil).`);
    return 0;
  }

  const findings = [];
  const dict = parseFeatureDictionary(readFileSync(dictPath, 'utf8'));
  if (!dict) {
    findings.push(`${dictPath}  →  makine-okunur \`\`\`yaml bloğu YOK — sözlük yalnız nesirse kapı onu okuyamaz.\n` +
      `      → şablon: templates/feature-dictionary.template.md (canonical_source + consumers[] + features[])`);
  }
  const bilinenOzellikler = new Set((dict?.features || []).map(f => f.name));
  if (dict) {
    if (!dict.canonicalSource) {
      findings.push(`${dictPath}  →  \`canonical_source\` boş — kanonik kaynağı BEYAN EDİLMEMİŞ sözlük ` +
        `çok-repo drift'ini önleyemez (kapıyı FİİLEN uygulayan repoyu yaz).`);
    }
    const gorulen = new Set();
    for (const f of dict.features) {
      if (gorulen.has(f.name)) findings.push(`${dictPath}  →  \`${f.name}\` sözlükte İKİ KEZ tanımlı (kanonik ad tekil olmalı).`);
      gorulen.add(f.name);
    }
  }

  let tracked = [];
  try {
    tracked = execSync('git ls-files', { maxBuffer: 64 * 1024 * 1024 })
      .toString('utf8').split('\n').filter(Boolean);
  } catch { /* git yoksa argüman zorunlu */ }

  let l0Files = args.length ? args : tracked.filter(f => /^docs\/user\/.*\.md$/i.test(f));
  l0Files = l0Files.filter(f => !/\.template\.md$/i.test(f));

  let checked = 0;
  const gorulenT = new Set();
  for (const p of l0Files) {
    if (!existsSync(p)) { findings.push(`${p}  →  [L0] dosyası yok`); continue; }
    checked++;
    const fm = frontmatter(readFileSync(p, 'utf8'));
    const availability = readAvailability(fm);
    const requires = readYamlList(fm, 'requires_features');
    const cf = parseConfigFlags(fm);
    const problems = [];

    if (!availability) {
      problems.push('`availability` beyan edilmemiş — konfig ekseni kuruluyken her [L0] ' +
        '"bu özelliğe kim erişir" sorusunu CEVAPLAR (always | feature_gated | flag_gated).');
    } else if (availability === 'feature_gated' && !requires.length) {
      problems.push('`availability: feature_gated` ama `requires_features` BOŞ — dayanaksız beyan.');
    } else if (availability === 'flag_gated' && !cf.gated) {
      problems.push('`availability: flag_gated` ama `config_flags` bir KOŞUL taşımıyor — dayanaksız beyan ' +
        '(`paid_feature: null` + boş `company_settings` = koşul YOK demektir).');
    } else if (availability === 'always' && (requires.length || cf.gated)) {
      problems.push('`availability: always` (koşulsuz) ama `requires_features`/`config_flags` gerçek bir ' +
        'KOŞUL taşıyor — çelişki.');
    }

    if (cf.declared && !cf.answered) {
      problems.push('`config_flags: {}` — "ÖLÇÜLDÜ, kapı YOK" ile "hiç BAKILMADI" ayrılamıyor. ' +
        'Ölçtüysen `paid_feature: null` yaz (boş bırakmak da bir CEVAPTIR, ama beyan edilmiş olmalı).');
    }

    if (cf.answered) {
      if (cf.paidFeature === undefined) {
        problems.push('`config_flags` dolu ama `paid_feature` anahtarı YOK — lisans sorusu cevapsız ' +
          '(kapı yoksa açıkça `paid_feature: null`).');
      } else if (cf.gated && cf.paidFeature && cf.paidFeature !== 'null' && dict && !bilinenOzellikler.has(cf.paidFeature)) {
        problems.push(`\`paid_feature: ${cf.paidFeature}\` kanonik sözlükte YOK (${dictPath}) — ` +
          'ya ad drift etti ya sözlük eksik. Kanonik ad TEK yerde yaşar.');
      }
      cf.settings.forEach((s, i) => {
        const et = `company_settings[${i}]`;
        for (const alan of CS_HER_ZAMAN_ZORUNLU) {
          if (!filled(s[alan])) problems.push(`\`${et}\` → \`${alan}\` boş/eksik.`);
        }
        // `tip` YAZILMAMIŞSA bool varsayılır — v0.20.0 biçimi AYNEN çalışmaya devam eder
        // (geriye-uyumluluk: sahada 22 dosyada `when_false` DOLU, migrasyon borcu YARATILMADI).
        const tip = filled(s.tip) ? s.tip : 'bool';
        if (!AYAR_TIPLERI.includes(tip)) {
          problems.push(`\`${et}.tip: ${s.tip}\` geçersiz — kapalı küme: ${AYAR_TIPLERI.join(' | ')}.`);
          return;
        }
        if (tip === 'bool') {
          const sinif = filled(s.when_false) ? s.when_false : s.etki_sinifi;
          if (!filled(sinif)) {
            problems.push(`\`${et}\` → \`when_false\` (ya da \`etki_sinifi\`) eksik.`);
          } else if (!ETKI_SINIFLARI.includes(sinif)) {
            problems.push(`\`${et}\` → \`${sinif}\` geçersiz sınıf — kapalı küme: ` +
              `${ETKI_SINIFLARI.join(' | ')} (cevabın TONUNU bu belirler).`);
          }
        } else {
          if (filled(s.when_false)) {
            problems.push(`\`${et}\` → \`tip: ${tip}\` iken \`when_false\` ANLAMSIZ ("false" hâli yok). ` +
              'Davranış DEĞERE bağlı → `kosul` + `etki_sinifi` kullan.');
          }
          if (!filled(s.kosul)) {
            problems.push(`\`${et}\` → \`tip: ${tip}\` DEĞERE bağlıdır; \`kosul\` ZORUNLU ` +
              '(örn. "talep tutarı bu değeri aşarsa" / "şu seçenek seçiliyse").');
          }
          if (!filled(s.etki_sinifi)) {
            problems.push(`\`${et}\` → \`etki_sinifi\` eksik.`);
          } else if (!ETKI_SINIFLARI.includes(s.etki_sinifi)) {
            problems.push(`\`${et}.etki_sinifi: ${s.etki_sinifi}\` geçersiz — kapalı küme: ` +
              `${ETKI_SINIFLARI.join(' | ')}.`);
          }
        }
      });
    }

    // --- BESLEYEN [T] KATMANI (v0.20.1) -------------------------------------------------
    // Pilotun ölçülmüş kök nedeni: 6 [T] `flags: []` diyordu, gerçekte ayar ÇAĞRILAN SERVİSTE
    // okunuyordu → "şu an yanlış bilgi veren" dokümanlar. Doktrin ("türetilmiş katman kanıt
    // değildir") bunu ajana ANLATIYOR ama hiçbir kapı ÖLÇMÜYORDU. Çelişki mekanik yakalanır:
    // [L0] gerçek bir koşul beyan ederken besleyen [T] "koşul YOK" diyorsa İKİSİNDEN BİRİ yanlıştır.
    const docDir = dirname(p);
    for (const tPath of readTechDocs(fm)) {
      const resolved = [tPath, join(docDir, tPath)].find(existsSync);
      if (!resolved) continue;   // çözülemeyen [T] = coverage-gate'in işi, burada TEKRAR ETME
      const tf = parseTechFlags(frontmatter(readFileSync(resolved, 'utf8')));

      if (cf.gated && tf.declared && tf.empty) {
        problems.push(`🔴 ÇELİŞKİ — besleyen [T] \`${tPath}\` \`flags: []\` (koşul YOK) diyor, ` +
          'ama bu [L0] gerçek bir KOŞUL beyan ediyor. İkisinden biri YANLIŞ ölçülmüş. ' +
          '→ Kaynağı aç ve ÇAĞIRDIĞI SERVİSE de bak ("gövdesinde yok" ≠ "yapmıyor").');
      }

      if (gorulenT.has(resolved)) continue;      // her [T] bir kez biçim denetlenir
      gorulenT.add(resolved);
      tf.entries.forEach((e, i) => {
        const et = `[T] ${tPath} → flags[${i}]`;
        if (!filled(e.ad)) problems.push(`\`${et}\` → \`ad\` boş/eksik (kanonik ad).`);
        else if (dict && !bilinenOzellikler.has(e.ad)) {
          problems.push(`\`${et}.ad: ${e.ad}\` kanonik sözlükte YOK (${dictPath}) — ad drift'i.`);
        }
        if (!filled(e.etki_sinifi)) problems.push(`\`${et}\` → \`etki_sinifi\` eksik.`);
        else if (!ETKI_SINIFLARI.includes(e.etki_sinifi)) {
          problems.push(`\`${et}.etki_sinifi: ${e.etki_sinifi}\` geçersiz — kapalı küme: ` +
            `${ETKI_SINIFLARI.join(' | ')}.`);
        }
      });
    }

    if (problems.length) findings.push(`${p}\n` + problems.map(x => `      - ${x}`).join('\n'));
  }

  if (findings.length) {
    const msg = `\nCONFIG-FLAGS ${strict ? 'FAIL' : 'UYARI'} (${findings.length} bulgu, ${checked} [L0] tarandı):\n` +
      findings.map(f => '  ' + f).join('\n') +
      `\n\n  • Kural: konfig ekseni KURULUYSA (${dictPath} var) her [L0] "bu özelliğe kim erişir" sorusunu` +
      `\n    CEVAPLAR. Cevap "koşul yok" olabilir — ama BEYAN edilmiş olmalı (\`paid_feature: null\`).` +
      `\n  • Dört sınıf (when_false) chatbot'un cevap TONUNU belirler: engel(yapamazsınız) · kisit(eksik alan)` +
      `\n    · hesap(sonuç değişir) · gorunurluk(SESSİZ filtre — kullanıcı hata görmez, eksik veri görür).` +
      `\n  • Ölçüm reçetesi (6 adım) + sınıf tanımları: reference/multi-team.md §4.6.` +
      `\n  • 🔴 Bu kapı ÖLÇÜMÜN DOĞRULUĞUNU göremez, yalnız CEVAPLANMIŞ olmasını — doğruluk Hakem işidir.\n`;
    if (strict) { console.error(msg + '(--strict: commit/CI bloke edildi)\n'); return 1; }
    console.warn(msg);
    return 0;
  }
  console.log(`Config-flags OK — ${checked} [L0] dosyasında erişim beyanı ↔ dayanak tutarlı (sözlük: ${dictPath}).`);
  return 0;
}

// NOT: sözlük eşleşmesi BİREBİRDİR (case-insensitive DEĞİL) — `LoyaltyProgram` ≠
// `loyaltyprogram` drift'i pilotta gerçekten ölçülen bir vakadır, normalize etmek onu gizlerdi.

// =====================================================================================
// RULE: integration-cards (v0.27 — dış-sistem ekseni; saha vakası 2026-09-26)
// SINIF: opt-in-artefakt. TETİKLEYİCİ = manifestte bilinen bir DIŞ SERVİS SDK'sı
// (package.json · *.csproj · requirements.txt). Hiç yoksa alt-kural TÜMÜYLE NO-OP'tur.
//
// VAKA: AWS SES iki bölgede kurulu, biri sandbox biri production. Ajan servisin BÖLGE başına
// bölündüğünü bilmiyordu; ölçmeden "sandbox'tasın" dedi ve kullanıcının karşı kanıtına rağmen
// ~1 saat ısrar etti. Kök neden: dış servisin YAPISI (bölge/ortam/hesap/paket) repoda hiçbir
// yerde yazılı değildi ve ajanı resmî belgeye + salt-okur prob'a zorlayan hiçbir şey yoktu.
//
// NE ZORLAR (YAPI, düşük-FP): her dış SDK paketi bir entegrasyon kartına (docs/integrations/*.md)
// bağlı mı + kartın kaynak/boyut/prob/tarih alanları DOLU mu. Bayat kart (dogrulandi > N gün)
// NOT'tur — --strict'te bile bloke ETMEZ (servis değişmemiş olabilir; tarih yalnız sinyal).
// NE ZORLAYAMAZ (dürüstlük sınırı): kartın DOĞRU olduğunu ve ajanın iddiadan önce GERÇEKTEN
// prob koştuğunu. Kapı "soru cevaplandı mı" der, "cevap doğru mu" demez — o Hakem/E2 işidir.
// =====================================================================================
// Desen listesi KAPALI ve dardır: yalnız bölge/ortam/hesap/paket ekseniyle bölünen bulut,
// ödeme, mesajlaşma ve AI servisleri. Genel kütüphaneler (nodemailer, axios) DIŞ SERVİS değildir.
const DIS_SERVIS_DESENLERI = [
  [/^@aws-sdk\//, 'AWS'], [/^aws-sdk$/, 'AWS'], [/^AWSSDK\./, 'AWS'], [/^boto(3|core)$/i, 'AWS'],
  [/^@azure\//, 'Azure'], [/^Azure\./, 'Azure'], [/^Microsoft\.Azure\./, 'Azure'], [/^azure-/i, 'Azure'],
  [/^@google-cloud\//, 'Google Cloud'], [/^Google\.Cloud\./, 'Google Cloud'], [/^google-cloud-/i, 'Google Cloud'],
  [/^firebase(-admin)?$/i, 'Firebase'], [/^FirebaseAdmin$/i, 'Firebase'],
  [/^stripe(\.net)?$/i, 'Stripe'], [/^iyzipay$/i, 'iyzico'],
  [/^twilio$/i, 'Twilio'], [/^@sendgrid\//, 'SendGrid'], [/^sendgrid$/i, 'SendGrid'],
  [/^resend$/i, 'Resend'], [/^postmark$/i, 'Postmark'], [/^mailgun(\.js)?$/i, 'Mailgun'],
  [/^openai$/i, 'OpenAI'], [/^@anthropic-ai\//, 'Anthropic'], [/^anthropic$/i, 'Anthropic'],
  [/^@supabase\//, 'Supabase'], [/^@slack\//, 'Slack'], [/^slack[-_]sdk$/i, 'Slack'],
];
const KART_ZORUNLU = ['servis', 'kaynak', 'dogrulandi', 'prob'];

function disServis(paket) {
  if (paket.startsWith('@types/')) return null;
  const hit = DIS_SERVIS_DESENLERI.find(([re]) => re.test(paket));
  return hit ? hit[1] : null;
}

function manifestPaketleri(dosya, metin) {
  if (/package\.json$/i.test(dosya)) {
    try {
      const j = JSON.parse(metin);
      return Object.keys({ ...(j.dependencies || {}), ...(j.devDependencies || {}),
        ...(j.peerDependencies || {}), ...(j.optionalDependencies || {}) });
    } catch { return []; }
  }
  if (/\.csproj$/i.test(dosya)) {
    return [...metin.matchAll(/<PackageReference\s+Include="([^"]+)"/gi)].map(m => m[1]);
  }
  if (/requirements[^/]*\.txt$/i.test(dosya)) {
    return metin.split(/\r?\n/).map(l => l.replace(/#.*$/, '').trim())
      .filter(l => l && !l.startsWith('-')).map(l => l.split(/[\s\[=<>~!;]/)[0]).filter(Boolean);
  }
  return [];
}

// NuGet ve pip paket adları büyük/küçük harfe duyarsızdır (`Boto3` ≡ `boto3`) → eşleşme de öyle.
// Tek başına `*` (boş önek) HİÇBİR şeyi kapsamaz — her servisi tek karta yıkmak kartı anlamsızlaştırır.
function kartKapsar(desen, paket) {
  const d = desen.toLowerCase(); const p = paket.toLowerCase();
  if (!d.endsWith('*')) return d === p;
  const onek = d.slice(0, -1);
  return onek.length > 0 && p.startsWith(onek);
}

// Alan değerleri: satır-içi skaler (`k: x`) · satır-içi liste (`k: [a, b]`) · blok liste (`k:\n  - a`)
// · blok metin (`k: |`). Kart yazarı hangisini seçerse seçsin aynı soru sorulur: DOLU mu?
function alanDegerleri(fm, key) {
  const blk = readIndentedBlock(fm, key);
  if (!blk) return [];
  const liste = readYamlList(fm, key);
  if (liste.length || /^\[.*\]$/.test(blk.inline)) return liste;
  if (/^[|>][-+]?$/.test(blk.inline)) return blk.body.map(l => l.trim()).filter(Boolean);
  return blk.inline ? [scalar(blk.inline)] : [];
}
const gercekDeger = v => filled(v) && !/\{\{[^}]*\}\}/.test(v);

function runIntegrationCards(argv) {
  const strict = argv.includes('--strict');
  const cardsArg = argv.find(a => a.startsWith('--cards='));
  const bayatArg = argv.find(a => a.startsWith('--bayat-gun='));
  const cardsDir = cardsArg ? cardsArg.slice('--cards='.length) : 'docs/integrations';
  const bayatGun = bayatArg ? Number(bayatArg.slice('--bayat-gun='.length)) : 90;
  const args = argv.filter(a => !a.startsWith('-'));
  if (!Number.isInteger(bayatGun) || bayatGun <= 0) {
    // NaN'lı karşılaştırma hep false döner → bayatlık NOT'u SESSİZCE susardı. Geçersiz bayrak = hata.
    console.error(`Integration-cards: --bayat-gun pozitif tam sayı olmalı ("${bayatArg}").`);
    return 1;
  }
  const missing = args.filter(a => !existsSync(a));
  if (missing.length) {
    console.error(`\nINTEGRATION-CARDS FAIL — ${missing.length} verilen manifest diskte YOK:\n` +
      missing.map(f => `  ${f}`).join('\n') +
      '\n\n  "temiz" ile "hiç bakmadım" farklıdır: argümanla verilen dosya okunamadıysa kayıptır.\n');
    return 1;
  }

  let manifestler = args;
  if (!args.length) {
    try {
      manifestler = execSync('git ls-files', { maxBuffer: 64 * 1024 * 1024 })
        .toString('utf8').split('\n').filter(Boolean)
        .filter(f => /(^|\/)(package\.json|requirements[^/]*\.txt)$|\.csproj$/i.test(f))
        .filter(f => !/(^|\/)(node_modules|templates|examples|fixtures?)\//i.test(f));
    } catch { manifestler = []; }
  }

  const bulunan = new Map();   // paket → { servis, dosyalar[] }
  manifestler = manifestler.filter(m => existsSync(m));   // argüman yolu yukarıda denetlendi; burada yalnız ls-files
  for (const m of manifestler) {
    for (const p of manifestPaketleri(m, readFileSync(m, 'utf8'))) {
      const servis = disServis(p);
      if (!servis) continue;
      if (!bulunan.has(p)) bulunan.set(p, { servis, dosyalar: [] });
      bulunan.get(p).dosyalar.push(m);
    }
  }
  if (!bulunan.size) {
    console.log(`Integration-cards: manifestte dış servis SDK'sı yok (${manifestler.length} manifest) → no-op.`);
    return 0;
  }

  const findings = [];
  const notlar = [];
  const kartlar = [];
  const kartDosyalari = existsSync(cardsDir)
    ? readdirSync(cardsDir).filter(f => /\.md$/i.test(f) && !/\.template\.md$/i.test(f) && !/^readme\.md$/i.test(f))
    : [];
  const bugun = Date.now();
  for (const f of kartDosyalari) {
    const yol = join(cardsDir, f).replace(/\\/g, '/');
    const metin = readFileSync(yol, 'utf8');
    const fm = frontmatter(metin);
    const paketler = alanDegerleri(fm, 'paketler').filter(gercekDeger);
    kartlar.push({ yol, paketler });
    // Bir alan, öğelerinden BİRİ bile doldurulmamışsa eksiktir: `[{{BOYUT}}]` ve `[TBD]` liste
    // olarak "dolu" görünür ama cevap değildir (hakem B-1: şablonu kopyalayıp boyutlar'ı
    // doldurmayan kart --strict'te geçiyordu — oysa özelliğin asıl sorusu o alan).
    const eksik = [...KART_ZORUNLU, 'paketler'].filter(k => {
      const v = alanDegerleri(fm, k);
      return !v.length || !v.every(gercekDeger);
    });
    const boyutlar = alanDegerleri(fm, 'boyutlar');
    const boyutYok = boyutlar.length === 1 && /^yok$/i.test(boyutlar[0]);
    if (!boyutYok && (!boyutlar.length || !boyutlar.every(gercekDeger))) eksik.push('boyutlar');
    if (eksik.length) {
      findings.push(`${yol}  →  kartta boş/eksik alan: ${eksik.join(', ')}.\n` +
        `      → şablon: templates/entegrasyon-karti.template.md (boyut yoksa \`boyutlar: yok\` yaz — boş bırakma)`);
    }
    if (alanDegerleri(fm, 'paketler').some(d => d.trim() === '*')) {
      findings.push(`${yol}  →  \`paketler\` içinde tek başına \`*\` — her servisi tek karta yıkar; önek yaz (ör. \`@aws-sdk/*\`).`);
    }
    // Kod (``` blok + `satır-içi`) MUAF: SES/SendGrid/Postmark e-posta şablonları `{{ad}}`
    // sözdizimi kullanır ve bu tam da kartın "Tuzaklar" bölümüne yazılacak olgudur (hakem Y-1).
    const govde = metin.replace(/^---\r?\n[\s\S]*?\r?\n---/, '').replace(/<!--[\s\S]*?-->/g, '')
      .replace(/```[\s\S]*?```/g, '').replace(/`[^`\n]*`/g, '');
    const govdeYerTutucu = govde.match(/\{\{[^}]*\}\}/g);
    if (govdeYerTutucu) {
      findings.push(`${yol}  →  gövdede ${govdeYerTutucu.length} doldurulmamış alan (ör. ${govdeYerTutucu[0]}) — ` +
        `ölçülen durum tablosu şablon hâlinde kalmış.`);
    }
    for (const kaynak of alanDegerleri(fm, 'kaynak').filter(gercekDeger)) {
      if (!/^https?:\/\//i.test(kaynak)) {
        findings.push(`${yol}  →  \`kaynak\` bir URL değil ("${kaynak}") — kart RESMÎ belgeye bağlanır, hafızaya değil.`);
      }
    }
    const tarih = alanDegerleri(fm, 'dogrulandi')[0] ?? '';
    if (gercekDeger(tarih)) {
      const t = Date.parse(tarih);
      // Gidiş-dönüş kontrolü: Date.parse('2026-02-30') hata VERMEZ, 03-02'ye kayar.
      const gecerli = /^\d{4}-\d{2}-\d{2}$/.test(tarih) && !Number.isNaN(t)
        && new Date(t).toISOString().slice(0, 10) === tarih;
      if (!gecerli) {
        findings.push(`${yol}  →  \`dogrulandi\` geçerli bir YYYY-AA-GG tarihi değil ("${tarih}").`);
      } else if (t - bugun > 86400000) {
        findings.push(`${yol}  →  \`dogrulandi\` GELECEKTE (${tarih}) — ölçülmemiş bir tarih yazılmış.`);
      } else if ((bugun - t) / 86400000 > bayatGun) {
        notlar.push(`${yol}  →  son doğrulama ${tarih} (>${bayatGun} gün). Dış servis değişmiş olabilir: ` +
          `prob'u yeniden koş, tarihi güncelle.`);
      }
    }
  }

  const kartsiz = new Map();   // servis → paket[]
  for (const [p, { servis }] of bulunan) {
    if (kartlar.some(k => k.paketler.some(d => kartKapsar(d, p)))) continue;
    if (!kartsiz.has(servis)) kartsiz.set(servis, []);
    kartsiz.get(servis).push(p);
  }
  for (const [servis, paketler] of kartsiz) {
    findings.push(`${servis}: ${paketler.join(', ')}  →  entegrasyon kartı YOK.\n` +
      `      → ${cardsDir}/<servis>.md aç (şablon: templates/entegrasyon-karti.template.md); ` +
      `resmî belgeyi oku, salt-okur prob koş, ölçüleni yaz.`);
  }

  if (notlar.length) {
    console.log(`\nINTEGRATION-CARDS NOT (bloke ETMEZ — ${notlar.length} bayat kart):\n` +
      notlar.map(n => '  ' + n).join('\n') + '\n');
  }
  if (findings.length) {
    const msg = `\nINTEGRATION-CARDS ${strict ? 'FAIL' : 'UYARI'} (${findings.length} bulgu, ${bulunan.size} dış SDK paketi, ` +
      `${kartDosyalari.length} kart):\n` + findings.map(f => '  ' + f).join('\n') +
      `\n\n  • Kural: dış servis hakkında "var/yok/şu durumda" iddiası ÖLÇÜM ya da "bilmiyorum"dur —` +
      `\n    resmî belge + salt-okur prob. Servisin BÖLÜNME biçimi (bölge/ortam/hesap/paket) karta yazılır.` +
      `\n  • Gerekçe: reference/doctrine.md D-33 · reçete: reference/external-integrations.md §7.` +
      `\n  • 🔴 Bu kapı kartın DOĞRULUĞUNU göremez, yalnız VARLIĞINI ve doluluğunu — doğruluk Hakem işidir.\n`;
    if (strict) { console.error(msg + '(--strict: commit/CI bloke edildi)\n'); return 1; }
    console.warn(msg);
    return 0;
  }
  console.log(`Integration-cards OK — ${bulunan.size} dış SDK paketi ${kartDosyalari.length} karta bağlı.`);
  return 0;
}

// =====================================================================================
// Dispatch
// =====================================================================================
const argv = process.argv.slice(2);
const ruleArg = argv.find(a => a.startsWith('--rule='));
const rest = argv.filter(a => a !== ruleArg);

const RUNNERS = {
  'acceptance': runAcceptance,
  'brief-provenance': runBriefProvenance,
  'coverage-gate': runCoverageGate,
  'registry-join': runRegistryJoin,
  'config-flags': runConfigFlags,
  'integration-cards': runIntegrationCards,
};

if (ruleArg) {
  const rule = ruleArg.slice('--rule='.length);
  if (!RUNNERS[rule]) {
    console.error(`check-provenance.mjs: bilinmeyen --rule="${rule}" (geçerli: ${RULES.join(', ')})`);
    process.exit(1);
  }
  process.exit(RUNNERS[rule](rest));
}

// argümansız: tüm alt-kuralları koştur, her biri kendi argümansız (varsayılan hedef bulma)
// davranışıyla çalışır — herhangi biri FAIL → toplam exit 1.
let worst = 0;
for (const name of RULES) {
  const code = RUNNERS[name]([]);
  if (code !== 0) worst = code;
}
process.exit(worst);

#!/usr/bin/env node
// Process-discipline kategori kapısı. Alt-kurallar: aşağıdaki RULES[]; sözleşme: CONTRACT.md "Kapı kayıt tablosu".
// ORTAK EKSEN: "anlamlı değişiklik mi kozmetik mi" ayrımı + (hedef repo) opt-in — pakette
// tetikleyecek staged-diff/dal bağlamı yoksa üçü de no-op döner, hedef repoda commit anında koşar.
//
// Plan metadata (goal/proof/write_set) uyarıları plan-exists içinde warn-only'dir: eski planlar
// kırılmaz; alanların içeriğinin kalitesi bu kapının değil hakemin işidir.
//
// Kullanım:
//   node check-process-discipline.mjs                            → argümansız: RULES[]'teki TÜM alt-kurallar koşar
//   node check-process-discipline.mjs --rule=hakem-verdict [...]  → yalnız o alt-kural (eski bayraklar korunur)
//   node check-process-discipline.mjs --rule=plan-exists [...]
//   node check-process-discipline.mjs --rule=mode-escalation [...]
//   node check-process-discipline.mjs --rule=spec-receipt [--strict]
//   node check-process-discipline.mjs --rule=delege-kotasi [--strict] [--kota=N]   (PreToolUse stdin okur)
//   node check-process-discipline.mjs --rule=dosya-sahipligi [--uyari]    (PreToolUse/Stop/SubagentStop/SessionEnd stdin okur; çakışmada exit 2)
import { execSync } from 'node:child_process';
import { readFileSync, existsSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { stateAdaylari } from './lib/state-yolu.mjs';
import { al, birak, sahipTarifi } from './lib/sahiplik.mjs';

const RULES = ['hakem-verdict', 'plan-exists', 'mode-escalation', 'spec-receipt', 'delege-kotasi', 'dosya-sahipligi'];

// =====================================================================================
// RULE: hakem-verdict
// =====================================================================================
function runHakemVerdict(argv) {
  const strict = argv.includes('--strict');
  const dirArg = (argv.find(a => a.startsWith('--dir=')) || '').replace('--dir=', '');
  const branchArg = (argv.find(a => a.startsWith('--branch=')) || '').replace('--branch=', '');

  const CODE = /\.(mjs|cjs|js|jsx|ts|tsx|py|go|rb|java|kt|cs|php|rs|c|cpp|h|hpp)$/i;
  const EXCLUDE = /(^|\/)(gates|tests|templates)\/|\.template\.|\.test\.|\.spec\.|(^|\/)\.hakem\/|(^|\/)docs\/verdicts\//i;

  const staged = execSync('git diff --cached --name-only --diff-filter=ACMR', { maxBuffer: 16 * 1024 * 1024 })
    .toString('utf8').split('\n').filter(Boolean);
  const codeChanged = staged.filter(f => CODE.test(f) && !EXCLUDE.test(f));

  if (!codeChanged.length) {
    console.log('Hakem-verdict OK — staged diff\'te uygulama-kodu yok (kapı bu commit\'te no-op).');
    return 0;
  }

  function currentBranch() {
    if (branchArg) return branchArg;
    try {
      const b = execSync('git rev-parse --abbrev-ref HEAD', { maxBuffer: 1024 * 1024 }).toString('utf8').trim();
      return b === 'HEAD' ? null : b;
    } catch { return null; }
  }
  const branch = currentBranch();

  const DIRS = dirArg ? [dirArg] : ['.hakem', 'docs/verdicts'];
  function listVerdictFiles() {
    const files = [];
    for (const d of DIRS) {
      if (!existsSync(d)) continue;
      for (const f of readdirSync(d)) {
        if (/\.verdict\.json$/i.test(f)) files.push(join(d, f));
      }
    }
    return files;
  }

  function parseVerdict(path) {
    try { return JSON.parse(readFileSync(path, 'utf8')); }
    catch (e) { return { __parseError: e.message }; }
  }

  const verdictFiles = listVerdictFiles();

  function matchesBranch(path, v) {
    if (!branch) return true;
    const base = path.replace(/\\/g, '/').split('/').pop().replace(/\.verdict\.json$/i, '');
    if (base === branch) return true;
    const declared = v?.dal ?? v?.branch;
    return declared === branch;
  }

  const candidates = verdictFiles.filter(f => matchesBranch(f, parseVerdict(f)));

  const findings = [];

  if (!candidates.length) {
    findings.push(
      `Kod diff'i var (${codeChanged.length} dosya) ama hakem-verdict artefaktı YOK ` +
      `(aranan konum: ${DIRS.join(' , ')}${branch ? ` — dal: ${branch}` : ''}).\n` +
      `      → hakem çağrılmamış — uygulayan≠doğrulayan zinciri koşmadı.`
    );
  } else {
    for (const path of candidates) {
      const v = parseVerdict(path);
      if (v.__parseError) {
        findings.push(`${path}: JSON parse edilemedi (${v.__parseError}) — geçersiz VERDICT artefaktı, hakem çağrısı KANITLANAMADI.`);
        continue;
      }
      const missing = ['uygulayan', 'dogrulayan', 'verdict', 'gerekce']
        .filter(k => v[k] === undefined || v[k] === null || v[k] === '');
      if (missing.length) {
        findings.push(`${path}: şema eksik alan(lar) — ${missing.join(', ')} (bkz. templates/hakem-verdict.template.json).`);
      }
      if (!['onay', 'red', 'kosullu'].includes(v.verdict)) {
        findings.push(`${path}: verdict="${v.verdict}" — geçerli değer değil (onay|red|kosullu olmalı).`);
      }

      const dm = v.dis_model;
      if (dm === undefined || dm === null || dm === '') {
        findings.push(
          `${path}: \`dis_model\` beyanı YOK — dış-model denetimi (hakem.md madde 10) koşuldu mu ` +
          `atlandı mı BELİRSİZ.\n      → Atlamak SERBEST, sessiz atlamak DEĞİL: ` +
          `{"dis_model":{"durum":"atlandi","gerekce":"<neden>"}} yaz.`
        );
      } else if (typeof dm === 'string') {
        if (!/(kosuldu|koştu|kostu|çalıştı|calisti|atlandi|atlandı|skip)/i.test(dm)) {
          findings.push(`${path}: \`dis_model\` beyanı ("${dm}") durum bildirmiyor — "kosuldu" ya da "atlandi" geçmeli.`);
        }
      } else if (typeof dm === 'object') {
        const durum = String(dm.durum ?? '').toLowerCase();
        if (!['kosuldu', 'atlandi'].includes(durum)) {
          findings.push(`${path}: \`dis_model.durum\`="${dm.durum ?? '(yok)'}" — geçerli değil (kosuldu|atlandi olmalı).`);
        } else if (durum === 'atlandi' && !dm.gerekce) {
          findings.push(
            `${path}: \`dis_model.durum\`="atlandi" ama \`gerekce\` BOŞ — sessiz atlama YASAK ` +
            `(pilot bulgusu: iki kez atlandı, hiç iz kalmadı).`
          );
        } else if (durum === 'kosuldu' && !dm.model) {
          findings.push(`${path}: \`dis_model.durum\`="kosuldu" ama \`model\` alanı BOŞ — atıf zorunlu (hangi model/komut).`);
        }
      }

      // dayanak (v0.24, GERİYE UYUMLU opt-in): alan HİÇ YOKSA kapı sessizdir — eski verdict'ler
      // kırılmaz, gates_contract_version ARTMAZ. VARSA: dayanak_durumu ZORUNLU ve geçerli.
      // "COZULMEDI" bir HATA değil DÜRÜST BEYANdır — ama sessiz geçmez (doctrine TB-5/TB-6/TB-7).
      // 🔴 SINIR: kapı çapanın GERÇEKTEN çözüldüğünü DENETLEMEZ, yalnız beyanın DOLU+geçerli
      // olduğunu (VARLIK kapısı, D-3 emsali). Çözünürlük denetimi kalibre edilmeden kodlanmaz:
      // REPLAY ölçümü aynı sınıftan aday imzaların 19/19 YANLIŞ-ALARM verdiğini gösterdi.
      if (v.dayanak !== undefined && v.dayanak !== null && v.dayanak !== '') {
        const ds = String(v.dayanak_durumu ?? '');
        if (!['cozuldu', 'COZULMEDI'].includes(ds)) {
          findings.push(
            `${path}: \`dayanak\` VAR ama \`dayanak_durumu\`="${v.dayanak_durumu ?? '(yok)'}" — ` +
            `geçerli değil (cozuldu|COZULMEDI olmalı).`
          );
        } else if (ds === 'COZULMEDI') {
          findings.push(
            `${path}: \`dayanak_durumu\`="COZULMEDI" — verdict kaynağa BAĞLANAMADI. Bu DÜRÜST bir ` +
            `beyandır ama sessiz geçmez (doctrine TB-5/TB-6/TB-7): çapayı çöz ya da insan onayı al.`
          );
        }
      }

      if (v.uygulayan && v.dogrulayan && v.uygulayan === v.dogrulayan) {
        findings.push(
          `${path}: 🔴 UYGULAYAN≠DOĞRULAYAN İHLALİ — uygulayan="${v.uygulayan}" ile dogrulayan="${v.dogrulayan}" AYNI. ` +
          `Hakem uygulayıcıyla asla aynı ajan/kişi olamaz (roles.template.md, hakem.md).`
        );
      }

      if (v.verdict === 'red') {
        console.warn(
          `\n  ℹ️  ${path}: hakem VERDICT = "red" (gerekçe: ${v.gerekce ?? '(yok)'}).\n` +
          `      Bu RAPOR amaçlıdır — kapı bloklamaz, ne yapılacağı insan kararıdır.\n`
        );
      } else if (v.verdict === 'kosullu') {
        console.warn(
          `\n  ℹ️  ${path}: hakem VERDICT = "kosullu" (gerekçe: ${v.gerekce ?? '(yok)'}).\n` +
          `      Bu RAPOR amaçlıdır — kapı bloklamaz, koşulun karşılanması insan/süreç takibi.\n`
        );
      }
    }
  }

  if (findings.length) {
    const msg = `\nHAKEM-VERDICT ${strict ? 'FAIL' : 'UYARI'} (${findings.length} bulgu):\n` +
      findings.map(f => '  ' + f).join('\n') +
      `\n\n  • Kural: kod diff'i varken karşılık gelen .hakem/<dal>.verdict.json (ya da docs/verdicts/)` +
      `\n    artefaktı ZORUNLUDUR — bu, hakemin GERÇEKTEN ÇAĞRILDIĞININ mekanik kanıtıdır.` +
      `\n  • uygulayan alanı == dogrulayan alanı → HER ZAMAN FAIL (aynı kişi kendi işini onaylayamaz).` +
      `\n  • \`dis_model\` beyanı ZORUNLU (v0.12): dış-model denetimini ATLAMAK serbest, SESSİZ atlamak` +
      `\n    değil. {"durum":"atlandi","gerekce":"..."} ya da {"durum":"kosuldu","model":"<ID>"}.` +
      `\n  • VERDICT içeriği (onay/red/kosullu) bu kapının YARGI ALANI DEĞİLDİR — sadece çağrıldığını zorlar.` +
      `\n  • Şablon: templates/hakem-verdict.template.json\n`;
    if (strict) { console.error(msg + '(--strict: commit/CI bloke edildi)\n'); return 1; }
    console.warn(msg);
    return 0;
  }
  console.log(`Hakem-verdict OK — ${codeChanged.length} kod dosyası değişti, ${candidates.length} verdict artefaktı doğrulandı.`);
  return 0;
}

// =====================================================================================
// RULE: plan-exists
// =====================================================================================
function runPlanExists(argv) {
  const strict = argv.includes('--strict');
  const branchArg = (argv.find(a => a.startsWith('--branch=')) || '').replace('--branch=', '');

  const CODE_EXT = /\.(ts|tsx|js|jsx|mjs|cjs|py|go|rs|java|cs|dart|kt|kts|fs|scala|swift)$/i;

  function sh(cmd, fallback = '') {
    try { return execSync(cmd, { maxBuffer: 16 * 1024 * 1024 }).toString('utf8'); }
    catch { return fallback; }
  }

  const staged = sh('git diff --cached --name-only --diff-filter=ACM')
    .split('\n').filter(Boolean);
  const codeFiles = staged.filter(f => CODE_EXT.test(f));

  function stripComment(line, ext) {
    const l = line.trim();
    if (/\.py$/.test(ext) && l.startsWith('#')) return '';
    if (!/\.py$/.test(ext) && (l.startsWith('//') || l.startsWith('*') || l.startsWith('/*'))) return '';
    return l;
  }

  const anlamliDegisenKod = codeFiles.filter(f => {
    const diff = sh(`git diff --cached -U0 -- "${f.replace(/"/g, '\\"')}"`, null);
    if (diff === null) return true;
    return diff.split('\n')
      .filter(l => /^[+-]/.test(l) && !/^(\+\+\+|---)/.test(l))
      .map(l => l.slice(1))
      .some(l => stripComment(l, f) !== '');
  });

  if (!anlamliDegisenKod.length) {
    console.log('Plan-exists OK — staged diff\'te anlamlı kod değişikliği yok (plan gerekmiyor).');
    return 0;
  }

  const branch = branchArg || sh('git rev-parse --abbrev-ref HEAD').trim() || 'HEAD';
  const slug = branch.replace(/[^\w.-]+/g, '-').replace(/^-+|-+$/g, '') || 'HEAD';
  const candidates = [`docs/plans/${slug}.plan.json`, `docs/plans/${slug}.plan.md`];
  let planPath = candidates.find(existsSync);

  if (!planPath && existsSync('docs/plans')) {
    const anyPlan = sh('git ls-files docs/plans').trim().split('\n')
      .filter(f => /\.plan\.(json|md)$/.test(f));
    if (anyPlan.length) planPath = anyPlan.find(existsSync) || anyPlan[0];
  }

  const REQUIRED_MSG =
    `  • Kural: anlamlı kod diff'i varsa docs/plans/<dal>.plan.json (ya da .md) VAR ve şema-dolu OLMALI.\n` +
    `    Zorunlu alanlar: davranis_degisir (bool) · etkilenen_anchors (dizi) · kapsam (hafif|tam).\n` +
    `    Şablon: templates/plan.template.json\n` +
    `  • Bu kapı yalnız VARLIK+ŞEMA-DOLULUK'a bakar — planın KALİTESİ Hakem işi (E2), bu kapının sınırı değil.\n`;

  if (!planPath) {
    const msg = `\nPLAN-EXISTS ${strict ? 'FAIL' : 'UYARI'}: staged'de ${anlamliDegisenKod.length} dosyada anlamlı kod ` +
      `değişikliği var ama dal "${branch}" için plan artefaktı yok:\n` +
      `  aranan: ${candidates.join(' veya ')}\n\n` + REQUIRED_MSG;
    if (strict) { console.error(msg + '\n(--strict: commit/CI bloke edildi)\n'); return 1; }
    console.warn(msg);
    return 0;
  }

  const raw = readFileSync(planPath, 'utf8');
  const problems = [];
  let davranisDegisir, etkilenenAnchors, kapsam, planObj = null;

  if (planPath.endsWith('.json')) {
    try { planObj = JSON.parse(raw); }
    catch (e) { problems.push(`JSON parse edilemedi: ${e.message}`); planObj = {}; }
    davranisDegisir = planObj.davranis_degisir;
    etkilenenAnchors = planObj.etkilenen_anchors;
    kapsam = planObj.kapsam;
  } else {
    const fm = (raw.match(/^---\r?\n([\s\S]*?)\r?\n---/) || [, ''])[1];
    const boolM = fm.match(/^davranis_degisir:\s*(true|false)\s*$/mi);
    davranisDegisir = boolM ? boolM[1].toLowerCase() === 'true' : undefined;
    const inlineAnchors = fm.match(/^etkilenen_anchors:\s*\[([^\]]*)\]\s*$/mi);
    const blockAnchors = fm.match(/^etkilenen_anchors:\s*\r?\n((?:\s+-\s+.+\r?\n?)+)/mi);
    if (inlineAnchors) {
      etkilenenAnchors = inlineAnchors[1].split(',').map(s => s.trim().replace(/^['"]|['"]$/g, '')).filter(Boolean);
    } else if (blockAnchors) {
      etkilenenAnchors = blockAnchors[1].split('\n')
        .map(l => l.match(/^\s+-\s+(.+)\s*$/)).filter(Boolean)
        .map(m => m[1].trim().replace(/^['"]|['"]$/g, ''));
    } else {
      etkilenenAnchors = undefined;
    }
    const kapsamM = fm.match(/^kapsam:\s*([^\s#]+)/mi);
    kapsam = kapsamM ? kapsamM[1].trim() : undefined;
  }

  if (typeof davranisDegisir !== 'boolean') {
    problems.push('davranis_degisir: bool ZORUNLU (eksik/tip yanlış)');
  }
  if (!Array.isArray(etkilenenAnchors)) {
    problems.push('etkilenen_anchors: dizi ZORUNLU (eksik/tip yanlış)');
  } else if (davranisDegisir === true && etkilenenAnchors.length === 0) {
    problems.push('davranis_degisir=true ama etkilenen_anchors boş — hangi anchor etkileniyor belirtilmemiş');
  }
  if (kapsam !== 'hafif' && kapsam !== 'tam') {
    problems.push(`kapsam: hafif|tam ZORUNLU (bulunan: ${kapsam === undefined ? '(yok)' : JSON.stringify(kapsam)})`);
  }

  if (problems.length) {
    const msg = `\nPLAN-EXISTS ${strict ? 'FAIL' : 'UYARI'}: ${planPath} bulundu ama şema-dolu DEĞİL (dolgu-plan):\n` +
      problems.map(p => '  - ' + p).join('\n') + '\n\n' + REQUIRED_MSG;
    if (strict) { console.error(msg + '\n(--strict: commit/CI bloke edildi)\n'); return 1; }
    console.warn(msg);
    return 0;
  }

  const metadataWarnings = [];
  const steps = planObj && Array.isArray(planObj.plan_adimlari) ? planObj.plan_adimlari : [];
  const writeSets = [];
  if (planObj && Object.prototype.hasOwnProperty.call(planObj, 'plan_adimlari') && !Array.isArray(planObj.plan_adimlari)) {
    metadataWarnings.push('plan_adimlari dizi değil — metadata uyarısı, eski plan sözleşmesi korunuyor');
  }
  for (const [i, step] of steps.entries()) {
    if (!step || typeof step !== 'object' || Array.isArray(step)) {
      metadataWarnings.push(`plan_adimlari[${i}] nesne değil`);
      continue;
    }
    if (!String(step.goal_id || '').trim()) metadataWarnings.push(`plan_adimlari[${i}] goal_id eksik`);
    if (!String(step.expected_outcome || '').trim()) metadataWarnings.push(`plan_adimlari[${i}] expected_outcome eksik`);
    if (!Array.isArray(step.proof_artifacts) || !step.proof_artifacts.some(v => String(v || '').trim())) {
      metadataWarnings.push(`plan_adimlari[${i}] proof_artifacts boş`);
    }
    if (Object.prototype.hasOwnProperty.call(step, 'write_set')) {
      if (!Array.isArray(step.write_set)) metadataWarnings.push(`plan_adimlari[${i}] write_set dizi değil`);
      else writeSets.push({ index: i, paths: step.write_set.map(v => String(v || '').trim()).filter(Boolean) });
    }
  }
  for (let i = 0; i < writeSets.length; i++) {
    for (let j = i + 1; j < writeSets.length; j++) {
      const overlap = writeSets[i].paths.filter(p => writeSets[j].paths.includes(p));
      if (overlap.length) metadataWarnings.push(
        `plan_adimlari[${writeSets[i].index}]↔[${writeSets[j].index}] write_set kesişimi: ${overlap.join(', ')} (sıralama/hakem kararı gerekir)`
      );
    }
  }
  if (metadataWarnings.length) {
    console.warn(`PLAN-METADATA UYARI — ${planPath} (warn-only, exit 0):\n` +
      metadataWarnings.map(w => `  - ${w}`).join('\n'));
  }

  console.log(`Plan-exists OK — ${planPath} şema-dolu, staged kod diff'iyle eşleşiyor.`);
  return 0;
}

// =====================================================================================
// RULE: mode-escalation
// =====================================================================================
function runModeEscalation(argv) {
  const strict = argv.includes('--strict');

  const HEAVY_SIGNALS = [
    ['public API / route', /(^|\/)(controllers?|routes?|routers?|endpoints?|api)\/|(^|\/)(page|route)\.[tj]sx?$|Controller\.[a-z]+$/i],
    ['DTO/şema/enum',      /(Dto|Request|Response)\.[a-z]+$|(^|\/)(schemas?|contracts?|enums?)\/|\.proto$|(^|\/)migrations?\//i],
    ['config/auth',        /(^|\/)(auth|security)[\w.-]*\.[a-z]+$|(^|\/)\.env(\..+)?$|(^|\/)(appsettings|config)[\w.-]*\.(json|ya?ml)$/i],
    ['migration',          /migrations?\/.+\.(sql|cs|ts|js|py)$|__migrations__/i],
  ];

  let changed = [];
  let stagedMode = false;
  try {
    changed = execSync('git diff --cached --name-only --diff-filter=ACMRD', { maxBuffer: 16 * 1024 * 1024 })
      .toString('utf8').split('\n').filter(Boolean);
    if (changed.length) stagedMode = true;
  } catch { /* git yoksa (repo dışı test) → boş, no-op */ }
  if (!changed.length) {
    try {
      changed = execSync('git show --name-only --diff-filter=ACMRD --pretty=format: HEAD', { maxBuffer: 16 * 1024 * 1024 })
        .toString('utf8').split('\n').filter(Boolean);
    } catch { /* HEAD yok veya git yok → boş kalır, no-op */ }
  }

  const hits = [];
  for (const f of changed) {
    for (const [label, re] of HEAVY_SIGNALS) {
      if (re.test(f)) { hits.push({ file: f, label }); break; }
    }
  }

  if (!hits.length) {
    console.log('Mode-escalation OK — değişen dosyalarda ağır sinyal yok.');
    return 0;
  }

  function readCommitTrailerMode() {
    try {
      const msg = execSync('git log -1 --pretty=%B', { maxBuffer: 1024 * 1024 }).toString('utf8');
      const m = msg.match(/^\s*(?:Mode|Mod)\s*:\s*(\S+)/im);
      return m ? m[1].trim().toLowerCase() : null;
    } catch { return null; }
  }
  // v0.30 B4 (saha: saha-G): STATE.md kökte VEYA docs/ altında yaşayabilir.
  // Önce kök (paketin orijinal sözleşmesi), sonra docs/. mode/mod alanı OLMAYAN aday atlanır,
  // sıradaki denenir (kökte alansız bir STATE.md docs/STATE.md'deki beyanı gizlemesin).
  // v0.30.4: kök → docs/ → docs/<alt>/ (saha: docs/agentic/STATE.md) — tek yardımcı gates/lib/state-yolu.mjs.
  function readStateFileMode() {
    for (const aday of stateAdaylari('.')) {
      const m = readFileSync(aday, 'utf8').match(/^\s*(?:mode|mod)\s*:\s*(\S+)/im);
      if (m) { modKaynak = aday; return m[1].trim().toLowerCase(); }
    }
    return null;
  }
  let modKaynak = null;   // raporda hangi STATE dosyasından okunduğu görünsün (birden çok aday varsa kök öncelikli)

  const declaredRaw = stagedMode
    ? readStateFileMode()
    : (readCommitTrailerMode() ?? readStateFileMode());
  const declared = declaredRaw ? declaredRaw.replace(/['",.;]+$/, '') : null;
  const isLight = declared === 'hafif' || declared === 'light';
  const isFull = declared === 'tam' || declared === 'full';
  const NO_CODE_TYPES = { devir: 'DEVİR', handoff: 'DEVİR', engel: 'ENGEL', blocked: 'ENGEL' };
  const noCodeLabel = declared ? NO_CODE_TYPES[declared] : undefined;

  if (isFull) {
    console.log(`Mode-escalation OK — ${hits.length} ağır sinyal var ama mod zaten "tam" olarak beyan edilmiş.`);
    return 0;
  }

  if (noCodeLabel) {
    const CODE = /\.(mjs|cjs|js|jsx|ts|tsx|py|go|rb|java|kt|cs|php|rs|c|cpp|h|hpp|sql)$/i;
    const NOT_CODE = /(^|\/)(gates|tests|templates|docs)\/|\.template\.|\.test\.|\.spec\./i;
    const codeTouched = changed.filter(f => CODE.test(f) && !NOT_CODE.test(f));

    console.log(
      `\n  ℹ️  MOD = ${noCodeLabel} ("${declared}") — ${hits.length} ağır sinyal var ama beyan "kod yazılmayacak".\n` +
      `      Kapı BLOKLAMAZ: yükseltilecek bir dalga yok. Doğrulanması gereken (E2, hakem/insan):\n` +
      `      • ${noCodeLabel === 'DEVİR'
            ? 'kök nedenin başka serviste olduğu KANITLANDI mı, bulgu aktarıldı mı (kime/nereye)?'
            : 'engelin ne olduğu ve neyin beklendiği yazıldı mı (kim açacak)?'}\n`
    );

    if (codeTouched.length) {
      console.warn(
        `  🟠 ÇELİŞKİ UYARISI — beyan "${declared}" (kod yazılmaz) ama diff'te ${codeTouched.length} ` +
        `uygulama-kodu dosyası değişmiş:\n` +
        codeTouched.slice(0, 10).map(f => `      - ${f}`).join('\n') +
        (codeTouched.length > 10 ? `\n      … (+${codeTouched.length - 10} dosya)` : '') +
        `\n      → Gerçekten kod yazıldıysa mod "tam" olmalı. Bu bir E2 yargısıdır (hakem karar verir);\n` +
        `        kapı bloke etmez, yalnız GÖRÜNÜR kılar.\n`
      );
    }
    return 0;
  }

  const byLabel = {};
  for (const h of hits) (byLabel[h.label] ??= []).push(h.file);

  const msg = `\nMOD-ESKALASYON ${strict ? 'FAIL' : 'UYARI'} (${hits.length} ağır sinyal, mod beyanı: ${declared ?? '(yok)'}${modKaynak ? `, kaynak: ${modKaynak}` : ''}):\n` +
    Object.entries(byLabel).map(([label, files]) =>
      `  [${label}]\n` + files.map(f => `      - ${f}`).join('\n')).join('\n') +
    `\n\n  • Kural: public API/route, DTO/şema/enum, config/auth veya migration dosyası değiştiyse` +
    `\n    mod "hafif" OLAMAZ (ya da beyansız kalamaz) — bunlar TAM DALGA sinyalidir.` +
    `\n  • Mod nasıl beyan edilir: commit mesajına \`Mode: tam\` trailer'ı EKLE, ya da STATE.md'de` +
    `\n    \`mode: tam\` yaz — gerçekten hafifse ve bu sinyaller yanlış-pozitifse trailer'ı yine de` +
    `\n    \`Mode: tam\` yaparak geçebilirsin (kapı "ağır mı" demiyor, "tam-dalga sürecinden geçti mi" diyor).` +
    `\n  • KOD YAZILMAYACAKSA "hafif" DEME — iki ayrı iş tipi var (v0.12):` +
    `\n      \`Mode: devir\` → kök neden başka serviste/ekipte; kanıtla ve AKTAR (kod yazılmaz).` +
    `\n      \`Mode: engel\` → bilgi/erişim eksik; iş araştırmaya döner (kod yazılmaz).` +
    `\n    Bu ikisi bloke ETMEZ ama sessiz de geçmez — kapı görünür bir doğrulama satırı basar.` +
    `\n  • Bu bir HEURİSTİK'tir (dosya-deseni tabanlı, kesin sınıflandırma değil) — asıl doğrulama` +
    `\n    Hakem'in işi (roles.template.md §8b); bu kapı yalnız "hiç bakılmadı" olasılığını kapatır.\n`;

  if (isLight || !declared) {
    if (strict) { console.error(msg + '(--strict: commit/CI bloke edildi)\n'); return 1; }
    console.warn(msg);
    return 0;
  }

  if (strict) { console.error(msg + '(--strict: commit/CI bloke edildi)\n'); return 1; }
  console.warn(msg);
  return 0;
}

// =====================================================================================
// Dispatch
// =====================================================================================
const argv = process.argv.slice(2);
const ruleArg = argv.find(a => a.startsWith('--rule='));
const rest = argv.filter(a => a !== ruleArg);

// =====================================================================================
// RULE: spec-receipt (v0.23.0, K55 ②) — TERS-SPEC: VAAT (plan write_set) ↔ GERÇEK (staged diff).
//
// ÇEKİRDEK FİKİR: "bitti" cümlesi kanıt DEĞİLDİR. Kapanış koşulu, diff'in plandaki vaadi
// ÖRTMESİDİR. Modele HİÇ SORU SORULMAZ (öz-beyan kapı girdisi olamaz — S3b'nin tanımı budur).
//
// ÖLÇÜM (2026-08-27, 127 doğrulanmış S3b vakası) — KAPSAM DÜRÜSTÇE DAR:
// 127 vakanın yalnız ~24'ü (%19) kod/dosya iddiasıdır; 103'ü ekran/mimari/anlatı iddiasıdır ve
// git diff onları GÖRMEZ. Tamamlanma iddiası taşıyan yalnız 11 vaka. Bu kapı ~24 vakayı hedefler,
// 127'yi DEĞİL. K55'teki "S3b · 127" kapsamı bu ölçümle DARALTILDI.
//
// İKİ TUZAK ÖLÇÜLDÜ, İKİSİNDEN DE KAÇINILDI:
// ① PLAN BAYATLIĞI: bu repoda plan 2026-07-29'dan, HEAD 2026-08-27 — bir ay bayat. Naif
//    "vaat ≠ diff → FAIL" kuralı HER commit'te patlardı (ölçüldü: 4 vaat / 8 gerçek, kesişim 0).
//    → Plan HEAD'den eskiyse kapı NO-OP olur; bayat vaadi gerçekle kıyaslamak yanlış-alarmdır.
// ② YÖN SEÇİMİ: "vaat var ama diff yok" MEŞRUDUR (adım henüz koşmadı / dalga sürüyor) — bu yön
//    SESSİZ. Yalnız "vaat DIŞINDA yazım" raporlanır: plan bir şey söz verdi, başka yere yazıldı.
//
// SINIF: staged-diff (0 dosya DOĞAL — commit dışı staged yoktur; --allow-empty gereksiz).
// warn-only VARSAYILAN (plan-exists metadata deseni); `--strict` ile bloke eder.
// =====================================================================================
function runSpecReceipt(argv) {
  const strict = argv.includes('--strict');
  const dirArg = (argv.find(a => a.startsWith('--dir=')) || '').slice(6);
  const branchArg = (argv.find(a => a.startsWith('--branch=')) || '').slice(9);
  const cwd0 = process.cwd();
  if (dirArg) process.chdir(dirArg);
  try {
    const sh = (cmd, fb = '') => {
      try { return execSync(cmd, { maxBuffer: 16 * 1024 * 1024 }).toString('utf8'); } catch { return fb; }
    };
    const staged = sh('git diff --cached --name-only --diff-filter=ACM').split('\n').filter(Boolean);
    if (!staged.length) {
      console.log('Spec-receipt OK — staged diff boş (staged-diff sınıfı: 0 dosya DOĞAL, no-op).');
      return 0;
    }

    const branch = branchArg || sh('git rev-parse --abbrev-ref HEAD').trim() || 'HEAD';
    const slug = branch.replace(/[^\w.-]+/g, '-').replace(/^-+|-+$/g, '') || 'HEAD';
    const planPath = [`docs/plans/${slug}.plan.json`].find(existsSync)
      || (existsSync('docs/plans')
        ? sh('git ls-files docs/plans').trim().split('\n').filter(f => /\.plan\.json$/.test(f)).find(existsSync)
        : undefined);
    if (!planPath) {
      console.log('Spec-receipt OK — plan dosyası yok (vaat yoksa kıyaslanacak şey de yok; plan-exists ayrı denetler).');
      return 0;
    }

    // TUZAK ① — plan bayatsa kıyaslama yanlış-alarmdır (ölçüldü: bu repoda plan 1 ay geride).
    const planCommit = sh(`git log -1 --format=%H -- "${planPath}"`).trim();
    const behind = planCommit
      ? +(sh(`git rev-list --count ${planCommit}..HEAD`).trim() || '0') : 0;
    const STALE_LIMIT = 3;
    if (behind > STALE_LIMIT) {
      console.log(`Spec-receipt OK — plan ${behind} commit geride (>${STALE_LIMIT}), bayat vaat kıyaslanmaz (no-op).`);
      console.log(`  → Vaadi tazelemek için ${planPath} dosyasını bu dalganın write_set'iyle güncelle.`);
      return 0;
    }

    let plan;
    try { plan = JSON.parse(readFileSync(planPath, 'utf8')); }
    catch { console.log(`Spec-receipt OK — ${planPath} JSON parse edilemedi (plan-exists denetler, burada no-op).`); return 0; }

    const steps = Array.isArray(plan?.plan_adimlari) ? plan.plan_adimlari : [];
    const vaat = steps.flatMap(s => Array.isArray(s?.write_set) ? s.write_set.map(v => String(v || '').trim()) : [])
      .filter(Boolean);
    if (!vaat.length) {
      console.log('Spec-receipt OK — planda write_set beyanı yok (plan-exists warn-only uyarır, burada no-op).');
      return 0;
    }

    // write_set öğesi yol ya da glob olabilir → prefix/glob eşleşmesi.
    const matches = (file) => vaat.some(v => {
      if (v === file) return true;
      if (v.endsWith('/')) return file.startsWith(v);
      if (v.includes('*')) {
        const re = new RegExp('^' + v.split('*').map(s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('.*') + '$');
        return re.test(file);
      }
      return file.startsWith(v.replace(/\/$/, '') + '/');
    });

    // TUZAK ② — TEK YÖN: yalnız "vaat DIŞINDA yazım". "Vaat var ama diff yok" MEŞRUDUR (sessiz).
    const vaatDisi = staged.filter(f => !matches(f));
    if (!vaatDisi.length) {
      console.log(`Spec-receipt OK — staged ${staged.length} dosyanın tümü plandaki write_set'i örtüyor. [taranan=${staged.length}]`);
      return 0;
    }

    const head = `SPEC-RECEIPT ${strict ? 'FAIL' : 'UYARI'} — ${vaatDisi.length}/${staged.length} staged dosya plan vaadinin DIŞINDA (${planPath}):`;
    const body = vaatDisi.map(f => `  - ${f}`).join('\n');
    const tail = [
      '',
      '  Vaat (write_set): ' + vaat.join(', '),
      '  "bitti" cümlesi kanıt degildir — kapanis kosulu diffin vaadi ORTMESIDIR.',
      '  Yapilacak: ya planin write_setini gercege gore GUNCELLE, ya da vaat disi yazimi geri al.',
      '  Olculdu (2026-08-27): 127 S3b vakasinin ~24u kod/dosya iddiasi — bu kapi onlari hedefler.',
      ''
    ].join('\n');
    if (strict) { console.error(`\n${head}\n${body}${tail}`); return 1; }
    console.warn(`${head}\n${body}${tail}`);
    return 0;
  } finally {
    if (dirArg) process.chdir(cwd0);
  }
}

// =====================================================================================
// RULE: delege-kotasi (v0.23.0, K60) — ana turda ardışık HAM KEŞİF okuması kotayı aşarsa uyarır.
//
// ÇEKİRDEK FİKİR: alt-ajanın okuması ana bağlama GİRMEZ [ÖLÇÜLDÜ]: 33.117 doğrudan okuma ana
// bağlama 57,3 MB soktu; 2.007 Agent çağrısı yalnız 3,8 MB (%6). Yani keşif delege edilirse
// bağlam korunur. Kapı "delege et" DEMEZ — kotanın dolduğunu SÖYLER, karar ajanındır.
//
// 🔴 STDIN SÖZLEŞMESİ ÖLÇÜLDÜ (2026-08-27, geçici prob ile — beyan DEĞİL):
//   PreToolUse stdin = 823 baytlık JSON; üst seviye alanlar:
//   session_id · transcript_path · cwd · prompt_id · permission_mode · effort ·
//   hook_event_name · tool_name · tool_input · tool_use_id
//   `prompt_id` = TUR kimliği → sayaç sıfırlaması için transcript PARSE ETMEYE GEREK YOK.
//   `tool_name` = çağrılan araç → hangi aracın sayılacağı doğrudan bilinir.
//   Bu ölçüm K54'teki doğrulanmamış beyanı KANITA çevirdi (türetilmiş katman kanıt değildir).
//
// EŞİK KALİBRE EDİLDİ (647 okuma içeren gerçek turn üzerinden, yanlış-alarm maliyeti ölçüldü):
//   ≥10 → %14,2 tetiklenme (çok sık, gürültü) · **≥15 → %7,9 (13 turn'de 1, SEÇİLDİ)** ·
//   ≥20 → %3,4 · ≥25 → %1,4 (neredeyse hiç). Eşik `--kota=N` ile değiştirilebilir.
//
// SAYILAN ARAÇLAR: Read · Grep · Glob YALNIZ. Bash/PowerShell SAYILMAZ — ölçüm gösterdi ki
// 28.180 Bash çağrısının çoğu bileşiktir (`cd X && node verify`) ve keşif/eylem ayrımı
// GÜVENİLİR YAPILAMAZ (`cat > dosya` yazma olduğu hâlde okuma desenine uyuyor).
// Bash dahil edilseydi seri sayısı 725'e şişerdi; saf okumayla gerçek sayı 54'tür (≥15).
//
// SINIF: opt-in-artefakt (sayaç dosyası iş yapıldıkça DOĞAR — 0 çağrı DOĞALDIR, şüpheli değil).
// Varsayılan UYARI (exit 0); `--strict` ile exit 2 → PreToolUse'ta araç çağrısı REDDEDİLİR.
// =====================================================================================
// stdin TEK kez okunur (argümansız koşuda birden çok alt-kural aynı akışı paylaşır).
let _stdin = null;
function stdinOku() {
  if (_stdin === null) { try { _stdin = readFileSync(0, 'utf8'); } catch { _stdin = ''; } }
  return _stdin;
}
const KOTA_STATE = '.claude/.quota-state.json';
const KESIF_ARACLARI = new Set(['Read', 'Grep', 'Glob']);

function runDelegeKotasi(argv) {
  const strict = argv.includes('--strict');
  const kotaArg = (argv.find(a => a.startsWith('--kota=')) || '').slice(7);
  const KOTA = Number.isFinite(+kotaArg) && +kotaArg > 0 ? +kotaArg : 15;
  const dirArg = (argv.find(a => a.startsWith('--dir=')) || '').slice(6);
  const cwd0 = process.cwd();
  if (dirArg) process.chdir(dirArg);
  try {
    // stdin YOKSA no-op: kapı hook dışında (verify/CI) çağrılabilir — orada tur kavramı yoktur.
    let raw = '';
    raw = stdinOku();
    if (!raw.trim()) {
      console.log('Delege-kotasi OK — hook stdin yok (hook dışı çağrı, tur bağlamı yok → no-op).');
      return 0;
    }
    let payload;
    try { payload = JSON.parse(raw); } catch {
      console.log('Delege-kotasi OK — stdin JSON değil (sözleşme dışı çağrı → no-op).');
      return 0;
    }

    const toolName = String(payload.tool_name || '');
    const promptId = String(payload.prompt_id || '');
    if (!KESIF_ARACLARI.has(toolName)) {
      console.log(`Delege-kotasi OK — "${toolName || '?'}" keşif aracı değil (sayılmaz).`);
      return 0;
    }
    if (!promptId) {
      console.log('Delege-kotasi OK — prompt_id yok, tur sınırı bilinemez (sayaç güvenilmez → no-op).');
      return 0;
    }

    // Sayaç: prompt_id DEĞİŞİNCE sıfırlanır — transcript parse etmeye gerek yok (ölçülmüş şema).
    let state = { prompt_id: '', n: 0 };
    if (existsSync(KOTA_STATE)) {
      try { state = JSON.parse(readFileSync(KOTA_STATE, 'utf8')); } catch { /* bozuksa sıfırla */ }
    }
    if (state.prompt_id !== promptId) state = { prompt_id: promptId, n: 0 };
    state.n += 1;
    try {
      if (!existsSync('.claude')) mkdirSync('.claude', { recursive: true });
      writeFileSync(KOTA_STATE, JSON.stringify(state));
    } catch { /* yazamazsak sayaç ilerlemez; kapı yine de karar verir */ }

    if (state.n <= KOTA) {
      console.log(`Delege-kotasi OK — bu turda ${state.n}/${KOTA} keşif okuması.`);
      return 0;
    }

    const head = `DELEGE-KOTASI ${strict ? 'BLOKE' : 'UYARI'} — bu turda ${state.n} ham keşif okuması (kota ${KOTA}).`;
    const body = [
      '',
      '  Bu keşif ALT-AJANA verilse ana bağlam korunurdu.',
      '  Ölçüldü: 33.117 doğrudan okuma ana bağlama 57,3 MB soktu; 2.007 Agent çağrısı yalnız 3,8 MB (%6).',
      '  Alt-ajanın okuması ana bağlama GİRMEZ — yalnız özeti girer.',
      '',
      '  Yapilacak: kalan keşfi Task/Agent ile delege et. Brif şeması:',
      '    soru · bütçe · dönüş_şekli (bulgular + kanıt path:satır + açık varsayımlar + bilinmeyenler)',
      `  Kota bilinçli aşılıyorsa: --kota=${state.n + 10} ile yükselt (gerekçesini raporla).`,
      '',
    ].join('\n');
    if (strict) { console.error(`\n${head}${body}`); return 2; }   // PreToolUse: 2 = araç REDDEDİLİR
    console.warn(`${head}${body}`);
    return 0;
  } finally {
    if (dirArg) process.chdir(cwd0);
  }
}

// =====================================================================================
// RULE: dosya-sahipligi (v0.31.0) — paralel ajanların aynı dosyaya yazmasını önleyen sahiplik kaydı.
// Kayıt mantığı gates/lib/sahiplik.mjs (dosya başına wx kayıt); bu alt-kural yalnız hook yüzüdür.
//
// 🔴 SAHİPLİK ÖMRÜ = ÇALIŞMA ANI (v0.31 tasarım düzeltmesi, 2026-10-07): ana ajanın kayıtları TUR SONUNDA
//   (Stop) bırakılır, alt ajanınkiler SubagentStop'ta, oturumunkiler SessionEnd'de; TTL yalnız çöküş yedeği.
//   Sonuç: kayıt VARSA sahibi şu an çalışıyordur → çakışmada ENGELLEMEK güvenlidir (boşta bekleyen oturum
//   dosya tutmaz — yanlış-alarmın ana kaynağı buydu). Bekleyenin `notify_when_idle` aboneliği tam da
//   sahipliğin bırakıldığı anda tetiklenir.
// 🔴 VARSAYILAN ENGELLE — ÖLÇÜLDÜ (2026-10-06/07 uçtan uca `claude -p`): uyarı modunda (exit 0 +
//   additionalContext) mesaj modele YAZIM BİTTİKTEN SONRA ulaştı, dosya zaten değişmişti → uyarı önlemez.
//   exit 2 + stderr ise yazımı reddetti, dosya değişmedi. Düz stdout + exit 0 modele HİÇ ulaşmaz (SB-37).
//   `--uyari`: yalnız bilgi (additionalContext, exit 0) — geçiş/teşhis için. `--strict` geriye-uyum (no-op).
// 🔴 STDIN ALANLARI ÖLÇÜLDÜ (alt ajan): agent_id · agent_type · cwd · session_id · tool_input · tool_name ·
//   hook_event_name; SessionEnd: session_id · reason · cwd; SubagentStop: agent_id · session_id · cwd;
//   Stop: session_id · cwd · background_tasks (agent_id YOK → yalnız ana ajanın kayıtları bırakılır).
//   `prompt_id` `claude -p`'de YOK — kullanılmaz. Stop'ta HER ZAMAN exit 0 (non-zero turu sürdürür).
// Hook hatası kullanıcının işini KIRMAZ: beklenmedik exception → stderr'e tek satır, exit 0.
// SINIF: opt-in-artefakt (kayıtlar iş yapıldıkça doğar; stdin yok → sessiz no-op).
// =====================================================================================
const SAHIPLIK_ARACLARI = new Set(['Edit', 'Write', 'MultiEdit', 'NotebookEdit']);

function runDosyaSahipligi(argv) {
  const engelle = !argv.includes('--uyari');
  try {
    const raw = stdinOku();
    if (!raw.trim()) return 0;
    let p;
    try { p = JSON.parse(raw); } catch { return 0; }
    if (!p || typeof p !== 'object') return 0;
    const cwd = p.cwd || process.cwd();
    const session = p.session_id;
    const olay = p.hook_event_name;

    if (olay === 'SubagentStop') {
      if (p.agent_id) birak({ cwd, session, agent: p.agent_id });
      return 0;
    }
    if (olay === 'SessionEnd') { birak({ cwd, session }); return 0; }
    if (olay === 'Stop') { birak({ cwd, session, agent: null }); return 0; } // tur bitti → ana ajanın kayıtları
    if (olay !== 'PreToolUse' || !SAHIPLIK_ARACLARI.has(p.tool_name)) return 0;

    const ti = p.tool_input || {};
    const yol = p.tool_name === 'NotebookEdit' ? ti.notebook_path : ti.file_path;
    if (!yol) return 0;
    const r = al({ cwd, yol, session, agent: p.agent_id ?? null, kaynak: 'claude' });

    let mesaj = null;
    if (r.durum === 'cakisma') {
      const ad = r.sahip?.yol || yol;
      mesaj = `DOSYA SAHİPLİĞİ: ${ad} şu an ${sahipTarifi(r.sahip, { cwd })} elinde ve sahibi ŞU AN ÇALIŞIYOR ` +
        '(sahiplik turu/alt ajanı bitince kendiliğinden bırakılır). Bu yazım yapılmadı. Seçenekler: ' +
        '① kendi dokunma kümendeki başka dosyaya geç, sonra bu dosyayı YENİDEN OKUYUP tekrar dene ' +
        '② ana oturumsan: sahibe SendMessage ile sıra iste ve notify_when_idle ile boşa düşmesini bekle ("bitti mi?" yoklaması yapma; oturum adı yoksa kullanıcıya çık) ' +
        '③ 3+ bekleyen / karşılıklı bekleme / kilitli dosya → yönetici (insan ya da atanan ana oturum). ' +
        'Alt ajansan: ana ajana bildir, kendin çözmeye çalışma.';
      if (engelle) { console.error(mesaj); return 2; }
    } else if (r.durum === 'devralindi') {
      mesaj = `DOSYA SAHİPLİĞİ (bilgi): ${yol} bayat kayıttan devralındı (önceki sahip: ${sahipTarifi(r.sahip, { cwd })}). Dosyayı yeniden okuduğundan emin ol.`;
    }
    // oturum-ici: sessiz — ana ajan ↔ alt ajanı arası yazım olağan delegasyondur, her Edit'te bildirim gürültüdür.
    if (mesaj) {
      console.log(JSON.stringify({ hookSpecificOutput: { hookEventName: 'PreToolUse', additionalContext: mesaj } }));
    }
    return 0;
  } catch (e) {
    console.error(`dosya-sahipligi: beklenmedik hata yutuldu (${String(e && e.message).split(/\r?\n/)[0]})`);
    return 0;
  }
}

const RUNNERS = {
  'hakem-verdict': runHakemVerdict,
  'plan-exists': runPlanExists,
  'spec-receipt': runSpecReceipt,
  'delege-kotasi': runDelegeKotasi,
  'dosya-sahipligi': runDosyaSahipligi,
  'mode-escalation': runModeEscalation,
};

if (ruleArg) {
  const rule = ruleArg.slice('--rule='.length);
  if (!RUNNERS[rule]) {
    console.error(`check-process-discipline.mjs: bilinmeyen --rule="${rule}" (geçerli: ${RULES.join(', ')})`);
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

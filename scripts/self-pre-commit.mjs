#!/usr/bin/env node
// Paketin KENDİ pre-commit'i (v0.8) — dogfood: bu repo da kendi kapılarına tabi olmalı.
// NEDEN VAR: README v0.9 yol haritası madde 6'daki açık — paketin karar defterleri (v0.5…v0.8)
// "append-only ruhunda" deniyordu ama hiçbir kapı zorlamıyordu. Bu shim onu commit anında zorlar:
//   • check-history --rule=append-only → karar defterleri APPEND_ONLY_EXTRA ile korunur
//   • check-hygiene --rule=secrets / --rule=utf8 → staged içerikte sızıntı/encoding bozulması yakalanır
// Kurulum (bir kez):  npm run hook:install   (ya da elle: bkz. README "Kurulum").
// Argümansız tüm staged-diff kapıları paketin kendi köküne koşar; bir kapı fail → commit bloke.
import { spawnSync } from 'node:child_process';

// Paketin kendi append-only tarihsel kayıtları (hedef-repo'nun docs/* yollarından AYRI):
const KARAR_DEFTERLERI = ['v0.31-KARAR-DEFTERI.md'];   // public sürüm: önceki defterler geliştirme reposunda tutulur
// 🔴 YENİ DEFTER AÇARKEN: bu listeye VE .claude/settings.json APPEND_ONLY_EXTRA'ya EKLE.
// İkisinden biri eksikse kapı o defterde SESSİZCE no-op olur (v0.17+v0.18 tam bunu yaşadı —
// hakem 2026-08-06'da deneyle kanıtladı: kayıtsız defterden 172 satır silindi, kapı exit 0 verdi).

const steps = [
  ['append-only', ['gates/check-history.mjs', '--rule=append-only'], { APPEND_ONLY_EXTRA: KARAR_DEFTERLERI.join(',') }],
  ['secrets',     ['gates/check-hygiene.mjs', '--rule=secrets'], {}],   // argümansız = staged (index) içerik
  ['utf8',        ['gates/check-hygiene.mjs', '--rule=utf8'], {}],
  // v0.12 — DOGFOOD: bu paket kendi rol dosyalarını da denetler. Kurulduğu gün BU repoda
  // 2 gerçek yakalama yaptı (hakem.md/uygulayici.md "213 test" derken gerçek 260'tı).
  // Argümansız = staged `.claude/agents/*.md`; rol dosyası dokunulmamışsa no-op.
  ['stale-constants', ['gates/check-history.mjs', '--rule=stale-constants', '--strict'], {}],
  // v0.16 — bu pakette UI dosyası/DESIGN.md yok → no-op (kullanmayan ödemez); hedef repoda
  // kurulduğunda staged UI dosyasını tarar. Argümansız = staged .jsx/.tsx/.vue/.svelte/....
  ['design-tokens', ['gates/check-self-registry.mjs', '--rule=design-tokens', '--strict'], {}],
  // v0.20 — DOGFOOD: sürtünme günlüğünün triyaj disiplini artık SAYILIYOR. VARSAYILAN uyarıdır
  // (--strict YOK): "Mekanizma-adayı" eksikliği bir kalite bulgusudur, commit'i bloke etmesi
  // sürtünme kaydını caydırırdı — kaydın hiç yazılmaması, kötü yazılmasından beterdir.
  // Argümansız = staged FRICTION_LOG/GARDEN_LOG; dokunulmamışsa no-op.
  ['friction-repeat', ['gates/check-history.mjs', '--rule=friction-repeat'], {}],
  // v0.26 — FACTS: işaretli ölçüm hücresi ile facts.json arasındaki sapma. VARSAYILAN uyarı
  // (--strict YOK, `friction-repeat` emsali). GEREKÇE: ölçüm kaynağı (`npm run facts`) ~26 sn
  // sürer ve her commit'te koşulmaz → commit anında facts.json meşru olarak bir adım geride
  // olabilir; bunu bloke etmek commit'i cezalandırırdı. CI (`verify.mjs`) --strict koşar:
  // sapma commit'i durdurmaz ama merge'e giremez. `facts.json` yoksa no-op.
  ['facts-drift', ['gates/check-doc-integrity.mjs', '--rule=facts-drift'], {}],
];

let failed = 0;
for (const [name, argv, env] of steps) {
  const r = spawnSync('node', argv, { encoding: 'utf8', env: { ...process.env, ...env } });
  const out = ((r.stdout || '') + (r.stderr || '')).trim();
  if (r.status !== 0) { failed++; console.error(`\n[pre-commit] FAIL ${name}:\n${out}`); }
}
if (failed) {
  console.error(`\nPaket pre-commit'i ${failed} kapıda bloke etti. Yukarıyı düzelt, tekrar commit et.`);
  process.exit(1);
}
console.log(`[pre-commit] OK — paketin kendi kapıları temiz (${steps.map(s => s[0]).join(' + ')}).`);

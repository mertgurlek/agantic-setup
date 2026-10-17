#!/usr/bin/env node
// Doc-integrity kategori kapısı. Alt-kurallar: aşağıdaki RULES[]; sözleşme: CONTRACT.md "Kapı kayıt tablosu".
// ORTAK EKSEN: paylaşılan anchor-çözümleme (gates/lib/anchor-resolve.mjs `astSecondOpinion`) +
// "rehber/[T]/[L0] iddiası ↔ gerçek durum" ayrışmasını yakalama — doc-truth ölü YOL/KOMUT
// referansını, doc-recency anchor'lı kod değişip dokümanın DOKUNULMAMASINI, integrity
// "tamamlandı" iddiası ile stub/çakışma/yetim durumunu yakalar.
//
// Bu dosya İNCE BİR ROUTER: her alt-kural kendi dosyasında (gates/lib/doc-integrity/*.mjs).
//
// Kullanım:
//   node check-doc-integrity.mjs                              → argümansız: RULES[]'teki TÜM alt-kurallar koşar
//   node check-doc-integrity.mjs --rule=doc-truth [--strict] [--ignore=..] [dosya...]
//   node check-doc-integrity.mjs --rule=doc-recency [--strict] [--cascade] [--base <ref>] [dosya...]
//     --base <ref>: değişen kümeyi staged yerine `git diff <ref>...HEAD` ile ölç (CI; fetch-depth: 0 gerekir)
//   node check-doc-integrity.mjs --rule=integrity [--strict] [--registry=<yol>]
//   node check-doc-integrity.mjs --rule=facts-drift [--strict] [--facts=<yol>] [dosya...]
import { runDocTruth } from './lib/doc-integrity/doc-truth.mjs';
import { runDocRecency } from './lib/doc-integrity/doc-recency.mjs';
import { runIntegrity } from './lib/doc-integrity/integrity.mjs';
import { runFactsDrift } from './lib/doc-integrity/facts-drift.mjs';

const RULES = ['doc-truth', 'doc-recency', 'integrity', 'facts-drift'];
const RUNNERS = { 'doc-truth': runDocTruth, 'doc-recency': runDocRecency, 'integrity': runIntegrity, 'facts-drift': runFactsDrift };

const argv = process.argv.slice(2);
const ruleArg = argv.find(a => a.startsWith('--rule='));
const rest = argv.filter(a => a !== ruleArg);

if (ruleArg) {
  const rule = ruleArg.slice('--rule='.length);
  if (!RUNNERS[rule]) {
    console.error(`check-doc-integrity.mjs: bilinmeyen --rule="${rule}" (geçerli: ${RULES.join(', ')})`);
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

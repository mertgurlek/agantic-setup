// Hedef repoya KURULAN şablon metni, yalnız bu pakette var olan dizinlere backtick'li yol VERMEZ.
// NEDEN (v0.28.1 hakem B-1, ÖLÇÜLDÜ): rol şablonuna `reference/faz4-roller-surec.md` atfı kondu; hedef
// repoda reference/ yoktur ve doc-truth `.claude/agents/*.md` + CLAUDE.md'yi tarar → kâşif/hakem rolü
// kurulan HER hedefte doc-truth kırmızıya düşerdi. Paket testleri bunu görmüyordu (şablon metni
// .template.md muafiyetiyle doc-truth dışında). Bu test o kör noktayı kapatır.
// Kapsam: HTML yorumları (<!-- ÜRETİM TALİMATI -->) kurulmaz → taranmaz; atıf gerekiyorsa backtick'siz
// "agentic-repo-setup paketi, reference/..." biçimi kullanılır (doc-truth yalnız backtick'li yolu denetler).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const TPL = join(dirname(fileURLToPath(import.meta.url)), '..', 'templates');
const PAKET_ICI = /`((?:reference|archive|pilot-[a-z]+)\/[^`\s]*)`/g;
const ihlaller = (metin) => [...metin.replace(/<!--[\s\S]*?-->/g, '').matchAll(PAKET_ICI)].map(m => m[1]);

test('şablonlar: hedefe kurulan metinde paket-içi dizine backtick\'li yol yok', () => {
  const bulunan = [];
  for (const f of readdirSync(TPL).filter(f => /\.template\.md$/.test(f))) {
    for (const yol of ihlaller(readFileSync(join(TPL, f), 'utf8'))) bulunan.push(`${f}: ${yol}`);
  }
  assert.deepEqual(bulunan, [], 'hedef repoda bu yollar YOK → doc-truth FAIL üretir:\n' + bulunan.join('\n'));
});

test('şablonlar: negatif deney — kurulan metindeki yol yakalanır; yorumdaki ve backtick\'siz atıf geçer', () => {
  assert.deepEqual(ihlaller('Kaynak: `reference/doctrine.md`.'), ['reference/doctrine.md']);
  assert.deepEqual(ihlaller('<!-- ÜRETİM: `reference/doctrine.md` -->\nMetin.'), []);
  assert.deepEqual(ihlaller('Kaynak: agentic-repo-setup paketi, reference/doctrine.md.'), []);
  assert.deepEqual(ihlaller('<!-- a -->\n`archive/v0.9-KARAR-DEFTERI.md`\n<!-- b -->'), ['archive/v0.9-KARAR-DEFTERI.md']);
});

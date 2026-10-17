# AGENTS.md

Kanonik proje kuralları **CLAUDE.md** dosyasındadır — plan/kod yazmadan önce oku ve uy.

Vazgeçilmez minimum (CLAUDE.md'yi okuyamasan bile):
- Dosya encoding'i UTF-8 (BOM'suz) — `gates/check-hygiene.mjs --rule=utf8` commit'te bloke eder.
- Her değişiklik sonrası: `npm run check` (verify + test) yeşil — baseline: CLAUDE.md.
- **Alan sınırı:** kök = paylaşılabilir generic skill; `pilot-proje/` ve `pilot-sim/` İÇERİĞİ
  pakete GİRMEZ (kaynak-atıf/provenance serbest — CLAUDE.md §"Üç alan").
- **Karar defterleri append-only:** kökteki en güncel `vX.Y-KARAR-DEFTERI.md` + `archive/*-KARAR-DEFTERI.md`
  düzenlenmez/silinmez, yalnız yeni girdi eklenir (kapı zorlar).
- Sürüm değiştiriyorsan üç yeri birden bump et: `package.json` ≡ `SKILL.md` başlığı ≡ `public/`
  bundle adı; sonra `npm run release`.
- Secret'lara dokunma; gerektiğinde dur ve insana sor.

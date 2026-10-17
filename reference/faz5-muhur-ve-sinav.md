# FAZ 5 — Makbuz mühürleme ve çıkış sınavının yedi kontrolü

> SKILL.md FAZ 5 ağır detayı buraya taşındı (SKILL.md tavanı ~300 satır; ağır içerik
> `reference/`e). SKILL.md kısa işaretçi ile buraya bakar.
> Bu iki blok kurulumun ÇIKIŞ KAPISIDIR: mühür olmadan yükseltme, sınav olmadan "tamam" yoktur.

## 1) Kurulum makbuzunu mühürle (yükseltmenin ön koşulu)

4a. **MAKBUZU MÜHÜRLE (v0.14 — sınavdan ÖNCE):** kurulum künyesi (FAZ 2 sonu, `.agentic-repo-setup.json`)
   FAZ 3-4 ürünleriyle GÜNCELLENMİŞ olmalı (repo_owned listesine CLAUDE/STATE/roller eklendi mi?);
   sonra `node verify.mjs --doctor --seal --target=.` — generic girdilere sha256 mührünü MAKİNE yazar
   (ajan beyanı değil). Aylar sonra mutabakat: `node verify.mjs --doctor` (eksik/drift tespiti).
   **Yükseltme (v0.15):** yeni skill sürümü çıkınca `node verify.mjs --upgrade` (DRY-RUN rapor) →
   uygunsa `--apply`. Yalnız mühürlü + drift'siz generic dosyalar tazelenir; elle değiştirilmiş
   (drift'li), mühürsüz ve silinmiş dosyalar ATLANIR — repo-özgü dosyalara ASLA dokunulmaz.

## 2) `verify.mjs --install-exam` — yedi kontrol

> Kanonik uygulama: `scripts/install-exam.mjs`. Buradaki liste o kodun ANLATIMIDIR;
> çelişki olursa KOD kazanır (türetilmiş katman kanıt değildir).

5. **🔴 K3 ÇIKIŞ SINAVI — `node verify.mjs --install-exam` KOŞ (yedi kontrol, VARLIK değil ETKİ):**
   ① anchor çözünürlüğü · **② kapı negatif kontrolü — v0.20'de ÇİFT YÖNLÜ** (bozuk deneği YAKALIYOR mu
   + meşru deneği GEÇİRİYOR mu; ayrıca kapının ÇÖKMESİ artık "yakaladı" SAYILMAZ — v0.16'dan beri
   süren sahte-PASS düzeltildi) · ③ CI fiilen koştu mu · ④ registry çözünürlüğü ·
   **⑤ doğruluk kapısı** (tipli stack'te pre-commit'te tip kontrolü var mı — yoksa BASELINE'a
   yazılı mı? Sessiz boşluk FAIL, bilinçli karar PASS) · **⑥ size-baseline kalibrasyonu** (tavanı
   aşan dosya varken muafiyet listesi üretildi mi — pilotta bu adım atlandı ve kapı reddedildi) ·
   **⑦ bilimsel-çalışma bölümü** (CLAUDE.md'de v0.13 disiplin bölümü var mı — yoksa bilinçli ret
   STATE'te yazılı mı? ⑤ ile aynı eksen: sessiz boşluk FAIL).
   FAIL varsa kurulum "tamam" DEĞİLDİR. `ÖLÇÜLEMEDİ`/`UYGULANAMAZ` ayrı sınıftır: sınavı düşürmez
   ama STATE'e DÜRÜSTÇE yazılır — uydurma yok.

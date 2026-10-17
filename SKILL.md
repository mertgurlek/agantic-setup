---
name: agentic-repo-setup
description: Bir repoyu çok-ajanlı (vibe-coding) AI geliştirmeye hazırlayan, kurduğu yapıyı YAŞATAN 360° REPO ZEKÂSI — kur · kanıtla · güncel tut · yükselt · iyileştir (runtime motoru/daemon değil; bakım komutlarını insan çağırır). Önce mini-denetim yapar (ölçer, varsaymaz), sonra repoya ÖZGÜ rehber (CLAUDE.md), makine kapıları (secret/doc-truth/placeholder/utf8/file-size/append-only), takip defterleri, roller ve token/context ekonomisi katmanlarını ÜRETİR. ÜÇ dik eksende toggle'la ölçeklenir — boyut (küçük/orta/büyük) × muhatap (dev/PM/QA/son-kullanıcı/çok-kiracılı konfig) × dış-entegrasyon (CI platformu + Fibery/iş-takip). Şunları isteyince TETİKLE: "bu repoyu çok-ajanlı geliştirmeye hazırla", "agentik altyapı/repo kurulumu", "vibe coding setup", "repoya kapı/CI/guardrail ekle", "prepare repo for AI agents", "set up agentic repo", "add gates/CI/guardrails to a repo", "mevcut CLAUDE.md'yi/kapıları güncelle (augment modu)", "update an existing repo's guide/gates"; ayrıca mevcut rehber gerçeğe aykırı düştüğünde (bayat CLAUDE.md), iyi bir kuruluma kapı/takip/CI eklerken veya çok-ekip (ürün/QA) ya da dış-sistem (CI/Fibery) akışı kurarken. Olgun beta: bir AI ajanı çalıştırır — ölçer, sorular sorar, repoya-özgü üretir (sabit installer DEĞİL).
---

# Agentic Repo Setup — 360° Repo Zekâsı (v0.31.0)

Sen bir **REPO ZEKÂSISIN**: agentik kod süreçlerini verimli hale getiren, bir DOKTRİN ve
DOKÜMANTASYON yapısı kuran, o yapıyı repoda YAŞATAN ve iş akışlarını İYİLEŞTİREN 360 derece
bir süreç. Görevin bu repoyu, birden çok AI ajanının (ve gerekirse birden çok EKİBİN) güvenle
geliştirme yapabileceği hale getirmek — ve o hâlde TUTMAK.

**Beş vaat, beş mekanizma (her vaadin arkasında koşan kod vardır — vaat ederken mekanizmasını göster):**
| Vaat | Mekanizma | Faz |
|------|-----------|-----|
| ① KUR | ölçüm → repoya-özgü üretim (CLAUDE.md, kapılar, roller, defterler) | FAZ 0-4 |
| ② KANITLA | pilot dalga + `verify.mjs --install-exam` (yedi kontrol, VARLIK değil ETKİ) | FAZ 5 |
| ③ GÜNCEL TUT | kurulum makbuzu + `verify.mjs --doctor` (sha256 mutabakat, drift tespiti) | FAZ 5/4a |
| ④ YÜKSELT | `verify.mjs --upgrade` (dry-run → apply; yalnız mühürlü+drift'siz generic dosyalar) | sürüm-sonrası |
| ⑤ İYİLEŞTİR | FRICTION_LOG (sistem-kuralı sürtünmesi) + bahçıvan turu + budama yasası | sürekli |

🔴 **SINIR — "360 derece" ne DEĞİL:** bu paket bir runtime motoru / daemon / zamanlayıcı /
model-gateway KURMAZ ve KENDİSİ DEĞİLDİR. ③-④ İNSANIN çağırdığı komutlardır, kendi kendine
koşmaz. "Sürekli çalışan bir zekâ" değil, **repo yaşam döngüsünün her aşamasında çağrılabilen
bir süreçtir.** Bu ayrım dürüstlük gereğidir: ölçmediğini ve koşmayanı vaat etme.

(Bu dosyanın hedef tavanı ~300 satır — ağır gerekçe/sürüm-tarihçesi `reference/doctrine.md`'de yaşar,
burada yalnız GÜNCEL davranış anlatılır. Atıf listesi tekrar etmesin diye tek yerde: bu dosyanın
sonundaki "Derin gerekçe + sık hatalar" bölümü. Henüz kod olmayan parçalar "[tasarım]" işaretli —
varsayma, KURMA, dürüstçe STATE'e yaz.)

## ALTIN KURAL (her şeyden önce)

**① İçerik kopyalanmaz, üretilir:** şablonlar sadece FORMAT verir; CLAUDE.md'ye yazılan
her cümle BU repoda az önce ÖLÇÜLMÜŞ bir gerçekten gelir. Başka reponun kuralını taşımak =
ilk günden yalan söyleyen rehber. Emin değilsen yazma — ölç ya da atla.
**② Mekanizması olmayan kural gürültüdür:** kuralı kim zorluyor (script/CI/hook/Hakem)?
Cevabı yoksa yazma. Bu v0.5'te dört zorlama halkasına genişler (FAZ 2).
**②b ZAMAN ekseni (v0.20):** *kendi tanımladığın ŞEMA ALANININ kapısı AYNI commit'te doğar*
(kalibrasyon gerektirmez, biçimi sen belirlersin) — **başkasının kodu** hakkında çıkardığın
invariant içinse "önce pilot, sonra kapı" geçerlidir. Kapısız yayınlanan şema alanı ÖLÜ ALANDIR:
sessizce boş kalır, sonra toplu geriye-dönük borç olur (ölçüldü: makalelerin büyük çoğunluğu).
Ve her kapı İKİ kontrolle doğar — **yakalama** (bozuğu yakalar) + **geçirme** (meşruyu geçirir);
ikincisi atlanırsa kapı yanlış-alarma boğulur ve kapatılır. Gerekçe: `reference/doctrine.md`.
**③ Context de bütçedir:** ajan belleği sınırsız sanılmaz. Uzun keşif ham geçmiş olarak
taşınmaz; focus summary'ye sıkıştırılır. Ama kabul kriteri, insan kararı, baseline,
güvenlik/prod riski ve aktif kilitler gibi taahhütler ASLA düşürülemez.

---

## ADIM 0 — Ortam kabulü + boyutlandırma + muhatap (ÖLÇ, sonra sor)

**ORTAM KABUL KONTROLÜ (en başta):** `git` var mı? (yoksa tam kurulum YOK — hook/CI/rollback
git'e dayanır; sadece verify+rehber kur, durumu bildir). `node --version` MAKİNEDE var mı? (Node
projenin değil ARACIN bağımlılığıdır — repoda package.json yoksa da kapıları KUR, D-34; makinede
de yoksa yine kur, başlatıcı atlar ve söyler — STATE'e yaz). Monorepo/workspace ise: kapı ve
doc-truth'un `package.json` çözümlemesi workspace-köküne göre KURULUMDA ÖLÇEREK ayarlanır.

**İDEMPOTENTLİK (v0.5):** kurulum yarıda kesilmiş/önce koşmuş olabilir. Her FAZ başında "bu
katman zaten kurulu mu?" diye BAK; varsa ve doğruysa YENİDEN ÜRETME, eksiği tamamla. Tekrar
koşuşta iyi dosyayı churn'lemek hiç kurmamak kadar zararlı.

**Boyutlandırma — önce ÖLÇ, sonra öner:** dosya sayısını say (`git ls-files`), stack/test
varlığına bak → seviye ÖNERİSİ çıkar ve öneriyle sor (override edilebilir):

| Seviye | Kime uygun | Kurulacak katmanlar |
|--------|-----------|---------------------|
| KÜÇÜK | hobi/tek kişilik, <100 dosya | doğrulama çekirdeği (verify + kapılar) + mini CLAUDE.md (≤60 satır). Takip dosyası YOK, rol YOK. |
| ORTA | aktif solo proje, 100-500 dosya | + DECISIONS.md, STATE.md [toggle: takip.state — soru; açıksa Aktif iş = CANLI BOARD] + 3 rol (kasif/uygulayici/hakem) + hafif/tam mod + dalga dosyası (v0.18.1) |
| BÜYÜK | büyük/çok-ajanlı, 500+ dosya | + TECH_DEBT, BASELINE, WAVES ölçüm logu, modül CLAUDE.md'leri, QA gezgini, tüm roller |

**ÜÇ DİK EKSEN — ayrıntı `reference/adim0-toggle-ve-mod.md`:** ① **muhatap toggle'ları**
(PM · UI/senaryo · son-kullanıcı dokümanı · QA ekosistemi · çok-müşteri · çok-repo · FRICTION_LOG)
② **dış entegrasyon toggle'ı** (CI platformu · iş-takip aracı · AST-indeks — ortamda BAĞLI değilse
ölü soru, SORMA) ③ **kurulum modu tespiti** (yeşil alan → tam kurulum · çürümüş → yeniden üret ·
olgun-iyi → **augment modu**; kesin karar FAZ 1 madde 7 + doc-truth ölçümüyle verilir).
🔴 Ortak ilke: **kullanmayan ödemez** — kapalı toggle o katmanın TEK satırını bile kurmaz.
🔴 **ZORUNLU kurulum soruları (v0.30):** boyut sorusuyla AYNI soru turunda (tek `AskUserQuestion`,
çoklu soru) muhatap toggle'ları (`pm_urun` · `qa_senaryo` · `son_kullanici_dokumani` · `test_koprusu`)
+ takip katmanları (`takip.state` · `takip.yan_bug`) SORULUR; cevap true/false künyeye yazılır.
**Sorulmadan false yazmak YASAK** — sorulmayan alan `null` kalır ve `install-exam` ⑧ FAIL verir.
(Saha: v0.23-v0.24 kurulumlarında yalnız boyut soruldu, künyeye şablonun sabit false'u yazıldı.)
`son_kullanici_dokumani=true` ise hook + CI'a doc-recency `--cascade` bağlanır. Ayrıntı: reference/adim0-toggle-ve-mod.md §1a.

Stack envanteri (sorma, bak): manifest'ten (package.json/pyproject/go.mod) framework, test
runner, lint, CI, deploy config'i çıkar.

**TOKEN/CONTEXT + MODEL/MCP ENVANTERİ (v0.6/v0.7/v0.10/v0.11 — sorma, BAK):** context bütçesi
(ORTA/BÜYÜK'te `docs/CONTEXT_BUDGET.md`, KÜÇÜK'te CLAUDE.md'ye 3-5 satır), erişilebilir model
tier envanteri (rol `model:` alanının hammaddesi — erişilemeyen modele işaret etmek ölü-referans),
MCP maliyet envanteri (sunucu başına ~34K token oturum-önek yükü — gereksizi kaldır/daralt) ve
dış-model çağrı yolunun KANIT'lanması (varsayma, KOŞARAK doğrula) hepsi burada ÖLÇÜLÜR, yazılmaz.
Tam gerekçe + rubrik + kaçış-yolu detayları: **`reference/model-effort-tiering.md`** (FAZ 4'ün
`model:`/`effort:` doldurma adımıyla aynı kaynak — burada oku, orada uygula).

---

## FAZ 1 — Mini-denetim (ölç, varsayma)

Her maddeyi KOMUTLA doğrula, `BULGULAR` tablosu çıkar. Bu tablo CLAUDE.md'nin hammaddesi.

0. **İLK KOMUT — çalışma ağacı:** `git status --short`. Commit'lenmemiş iş varsa kurulum
   SADECE yeni dosya ekler; src'ye dokunan işler (lint burn-down) "temiz ağaç sonrası" diye
   STATE'e yazılır. 🔴 **`git add -A` / `git add .` YAPMA** — yalnız kurulumun yazdığı yolları adıyla
   stage'le; kullanıcının commit'lenmemiş dosyası kurulum commit'ine girmez (saha: 3 kullanıcı dosyası süpürüldü).
1. **Komutlar:** dev/build/test/lint/typecheck gerçekten çalışıyor mu? Her birini KOŞ,
   süre + çıkış kodu not et.
2. **Test gerçeği:** test dosyası sayısı, kaç geçiyor, süre, DB/network bağımlılığı.
   (Burada "test yok" sanıp 1504 test'i atlamak klasik felakettir — say, varsayma.)
3. **Lint/typecheck baseline:** temiz ağaçta yeşil mi? Kaç hata? (Kırmızı baseline = ajan
   kırmızıyı yok saymayı öğrenir → Faz 2 ön koşulu düzeltmek.)
4. **En büyük 10 dosya** — bağlam-bombası adayları + okuma kara-listesi hammaddesi.
4a. **Context hotspot'ları (v0.6):** sadece büyük dosya değil, pahalı OKUMA DESENİ ölç:
   tekrar açılan log/dump dosyaları, uzun terminal çıktıları, çok sık okunan rehberler, append-only
   logların tam okutulma riski, ve "her görevde okunuyor ama karar taşımıyor" adayları. Çıktı:
   `dosya/desen | neden pahalı | öneri (grep/focus/index/okuma-yasak)`.
5. **Secret taraması** (`check-hygiene --rule=secrets --all`): bulguyu HEMEN bildir; ajan-yapılabilir kısmı
   yap (scrub, untracked debris sil); rotasyona kadar dalga açılmayacağını STATE'e yaz.
6. **Hook/CI durumu:** `git config core.hooksPath` geçerli mi? CI ne koşuyor?
7. **Mevcut rehber dosyalar:** CLAUDE.md/AGENTS.md/.cursorrules — her iddiayı gerçeğe karşı doğrula.
8. **Doküman çürümesi:** bayat/çelişkili durum dosyaları → arşiv adayları.
9. **Merkezi altyapı envanteri:** auth wrapper, API client, LLM wrapper, hata zarfı — tekil yapılar;
   grep'le bul. Dış servis SDK'sı varsa → entegrasyon kartı (`reference/external-integrations.md` §7).
10. **Tekrar/yerleşim:** jscpd varsa koş; feature yerleşiminde kaç rakip ev var?
10a. [ORTA+, UI-ağır repo sinyali varsa] **Tasarım-dili/akış hijyeni (v0.16):** DESIGN.md var mı?
   Sinyal say — tailwind.config/theme uzantısı, CSS custom properties, components/ui/ envanteri,
   shadcn/Radix/MUI bağımlılığı (≥2 sinyal = "dil MEVCUT", tek/sıfır = FAZ 3'te insan onayı
   sorulur). docs/flows.md + docs/screens.md var mı? Gerekçe + eşik detayı:
   `reference/tasarim-dili-ve-akis.md`.

Çıktı: `BULGULAR` tablosu (madde | ölçülen değer | kaynak komut). Kullanıcıya özetle.

---

## FAZ 2 — Kapılar (L2: önce güven, sonra genişletme) — DÖRT HALKA

v0.5'te zorlama dört halkadır (ucuzdan pahalıya, erkenden geçe):
**① Claude Code hook (döngü-içi, en erken)** → **② git pre-commit** → **③ CI** → **④ Hakem (LLM).**
Aynı kapı birden çok halkaya bağlanabilir; otorite CI'dır, hook hijyendir, Hakem son süzgeç.
**③ CI halkası platforma göre ÜRETİLİR (v0.9 DEAK):** GitHub Actions için `templates/ci-workflow.template.yml`'den
repo-özgü workflow; Azure/GitLab ise verify reçetesi elle dökülür (üreteç GHA-only). Detay: reference/external-integrations.md §1.

**Kurulum güvenliği — AYRI COMMIT'LER:** kurulum
öncesi temiz nokta. Üç ayrı commit: **(a)** makine katmanı (gates + hook config), **(b)**
baseline burn-down (varsa), **(c)** bilgi/rol katmanı. Her commit'in geri-alma envanteri
rapora yazılır → istenen katman tek revert'le geri alınır. Her commit'te yalnız kurulumun yazdığı yollar
adıyla stage'lenir (`git add -A`/`git add .` YASAK — kullanıcının commit'lenmemiş dosyası girmez). (Pilot dalga FAZ 5'te, kuruluma
karışmaz.)

**Kapı DEDUP'ı:** repoda eşdeğer kontrol varsa (CI'da gitleaks/secretlint → `check-hygiene --rule=secrets`
KURMA; mevcut encoding/size kontrolü → aynısı) ikincisini ekleme; mevcut olanı hook'a bağla.
"Yeniden yazma" ilkesi kapılar için de geçerli. Augment modunda ÖNCE mevcut CI'ı oku, eksik
olan kapıyı ekle.

**Aşama A (hemen):**
1. **Baseline'ı yeşillet:** lint/typecheck hatası varsa sor — şimdi mi, muafiyet mi?
   Burn-down hemen olmuyorsa pre-commit'i STAGED-ONLY lint yap (`lint-staged`+eslint);
   kırmızı baseline'ı BASELINE.md'ye "bilinen N hata; N+1.'si senindir" diye yaz.
2. **`verify` script'i** (stack'e uyarla): tip + birim test + (varsa) şema. Hedef <60 sn,
   ÖLÇEREK doğrula. Aşarsa kaçışlar (sırayla): incremental typecheck → hedefli test → verify'ı
   daralt, tam süiti CI'a bırak. Tavan dogma değil, "ajan beklemekten kaçınmasın" aracı.
   **STACK-TESPİTLİ verify reçetesi (v0.8.2 — global; manifest'e BAK, varsayma):**
   `package.json` → `npm/pnpm test` + `tsc --noEmit`/`biome`; `*.csproj`/`*.sln` → `dotnet build` +
   `dotnet test` + (varsa) `dotnet format --verify-no-changes`; `pyproject.toml`/`requirements.txt` →
   `pytest` + `ruff`/`mypy`; `pubspec.yaml` → `flutter test` + `flutter analyze`; `go.mod` → `go test ./...`
   + `go vet`; `*.tf` → `terraform validate` + `terraform fmt -check`. Karma/mikroservis repoda HER
   manifest'i ayrı ölç; tek "verify" birden çok runner sarabilir. Komut adlarını rehbere yazmadan ÖNCE
   KOŞ (`check-doc-integrity --rule=doc-truth` artık dotnet/flutter/terraform alt-komut drift'ini de yakalar — ölü komut FAIL).
3. **`gates/` script'lerini kopyala — TEK kanonik konum (belirsizlik = iki ajan iki ev → drift):**
   konumu şu algoritmayla SEÇ (sorma, bak): mevcut çalışan hook/CI zaten kök `gates/`'e bağlıysa onu
   KORU (otorite o); aksi halde kanonik default `scripts/gates/` — ikinci bir konum YARATMA. İki dizin
   birden varsa hook/CI'ın işaret ettiği otoritedir, diğeri arşivlenir/silinir (onayla). pre-commit
   hook'taki yollar seçilen TEK konumla TUTARLI olmalı. Konumu seçince KALİBRE et. **6 kategori kapı
   script'i** (her biri `--rule=<alt-kural>` ile tek alt-kuralı koşar; argümansız TÜMÜNÜ koşar —
   ayrıntı `CONTRACT.md` "Kapı kayıt tablosu"):
   - **Hangi kapı, hangi halka, hangi sınıf → `reference/faz2-kapi-katalogu.md`.** Orada: 6 kategori
     script, seviyeye göre çekirdek/toggle ayrımı, stack profili (dotnet/flutter/IaC), kapı DEDUP
     kuralı, kapı kayıt tablosu ve context-budget kaydı. Kurulumda o dosyayı AÇ ve sırayla uygula.
4. **Hook kur — İKİ tür (v0.5):**
   - **git pre-commit:** ÖNCE `git config core.hooksPath` oku (taşınmış repoda mutlak yol =
     sessiz ölüm; bozuksa unset). Başlatıcı: `templates/pre-commit-shim.template.sh`. Pre-commit =
     lint(staged,`--cache`) + kapılar. TAVAN 10 sn, smoke-testte ÖLÇ; aşarsa eslint cache.
   - **🔴 DOĞRULUK KAPISI — pre-commit hijyenle yetinmez (v0.12, pilot bulgusu):** yukarıdaki
     çekirdek kapıların HEPSİ metinsel/hijyen (secret, encoding, boyut, placeholder) — hiçbiri
     "bu kod derleniyor mu" sormaz. Tipli bir stack'te (TS/C#/Kotlin/Go…) **tip kontrolünü
     pre-commit'e AL**: hatalı kod commit'lenip dakikalar sonra CI'da yakalanmasın (zarfa bakıp
     içine bakmamak). KARAR KURALI — sayı ezberleme, ÖLÇ: staged-typecheck süresini kendin koş;
     **≤15 sn ise pre-commit'e al**, aşarsa incremental/proje-bazlı daraltmayı dene, yine aşarsa
     CI'a bırak ve BASELINE'a "pre-commit'te tip kontrolü YOK" diye yaz (sessiz bırakma).
     Tam test süiti bilinçle DIŞARIDA kalır (çoğu repoda tavanı aşar) — o CI'ın işi.
     ⭐ Kurduktan sonra NEGATİF KONTROL: bilerek tip hatası olan bir dosya stage'le → kapı
     durduruyor mu? Durmuyorsa kurulu ama çalışmıyordur (pilot-dersleri §2). Sonra sil.
   - **Claude Code yerel hook'ları (K4 — ① halka):** `.claude/settings.json`
     PreToolUse (Edit/Write öncesi placeholder/secret/append-only; exit 2 → reddi Claude'a geri
     besler) + Stop (oturum sonu verify); yollar `$CLAUDE_PROJECT_DIR` ile. Git'ten ÖNCE, ajan
     yazarken yakalar — en erken+ucuz savunma. Örnek settings.json reference/multi-team.md'de.
5. **Test→prod guard:** testler prod kaynağa yazabiliyorsa (DB URL, gerçek API) guard ekle —
   URL'de test işareti yoksa entegrasyon testi koşmayı reddet.

**Aşama B — bu oturumda YAPILMAZ; STATE.md'ye "ertelenmiş" YAZILIR** (tetik: baseline yeşil
+ ~1 hafta gözlem + onay): duplikasyon kapısı CI'da, file-size kapısının CI'a alınması,
stack'e özgü import yasakları, [toggle] feature-traceability kapısı (commit-ID + index,
chore/deps kaçışlı). Skill tek oturumluk — "sonra yap"ın çıktısı bir STATE satırıdır.

**KURULUM KÜNYESİ (zorunlu — yükseltmenin ön koşulu):** kapılar kopyalandıktan sonra
`templates/install-manifest.template.json`'dan hedef reponun köküne `.agentic-repo-setup.json` yaz.
İki listeyi DÜRÜSTÇE ayır: `generic_files` = skill'den BİREBİR kopyalananlar (yükseltme bunları
tazeleyebilir) · `repo_owned_files` = bu repodaki ölçümlerden ÜRETİLENLER (CLAUDE.md, STATE, DECISIONS,
roller — yükseltme bunlara ASLA dokunmaz). Künye olmadan repo "hangi sürümle kuruldu" sorusuna
cevap veremez ve yükseltme KÖRDÜR. Yalnız ölçüleni yaz; bilinmeyeni tahmin etme.

---

## FAZ 3 — Bilgi katmanı (L1)

1. **Kök CLAUDE.md'yi ÜRET** — `templates/CLAUDE.template.md` formatında, içerik tamamen
   FAZ 1 bulgularından. Tavan: KÜÇÜK ≤60, ORTA/BÜYÜK ≤150. Zorunlu: Çalıştırma&Doğrulama
   (ölçülmüş sürelerle) · baseline manifestosu · merkezi altyapı tablosu · yerleşim kuralları ·
   okuma kara-listesi · talimat öncelik sırası. YASAK: "şu an şöyle" anlatısı, kod parçacığı
   (file:line işaretçisi kullan), koddan okunabilen her şey, başka repodan kopya satır.
   **Tavan aşılırsa içerik ATILMAZ, KATMAN DEĞİŞTİRİR** (v0.20 taşma yasası → `reference/faz3-bilgi-katmani.md`).
2. **AGENTS.md stub'ı** (≤15 satır): kanonik dosyaya işaret + satır içi vazgeçilmezler.
   (AGENTS.md artık Linux Foundation/AAIF standardı — otomatik kod-inceleme bunu okur.)
3. [ORTA+] **Takip dosyaları, context bütçesi, kod-yazma disiplini, tasarım-dili, registry/[L0],
   kanonik sözlük → `reference/faz3-bilgi-katmani.md`.** Maddeler `3 … 3d` orada sırayla yaşar;
   her biri bir TOGGLE taşır (kapalı toggle = o dosya KURULMAZ). Kurulumda o dosyayı AÇ ve uygula.
   🔴 Toggle kapalıyken dosya üretmek = ölü dizin; toggle açıkken atlamak = sessiz boşluk.
4. [BÜYÜK] TECH_DEBT.md (gerçek borçlar, son-doğrulama tarihli) + BASELINE.md (ölçülmüş).
5. [BÜYÜK] **TEK pilot modül CLAUDE.md'si** — en ağır modüle, `templates/module-claude.template.md`,
   ≤50 satır. Format kanıtlanana kadar İKİNCİSİNİ KURMA. İçindeki HER yolu/komutu yazmadan ÖNCE
   çalıştırarak doğrula (altın kuralın modül hali).
6. **Enkaz temizliği** (onayla): bayat dosyalar → docs/archive/ veya silme. Çelişkili durum
   dosyası bırakma.
7. 🔴 **FACTS — türetilebilir değer ELLE YAZILMAZ** (kademe K0/K1/K2 + gerekçe + sınırlar →
   **`reference/facts-katmani.md`**). Ölçüm `facts.json`'da yaşar, dokümanda `<!--fact:KEY-->N`
   işaretiyle görünür; ÖLÇÜM ≠ POLİTİKA · ölçülemeyen `unknown` kalır, **asla 0 yazılmaz**.

> FAZ 3 bitince **`--rule=placeholders` + `--rule=doc-truth` (+ işaretlediysen `--rule=facts-drift`)
> KOŞ** — doldurulmamış `{{...}}`, ölü yol/komut ya da iddia↔ölçüm sapması kalmadığını makineyle
> kanıtla: "ürettim, doğru sandım" hatasının panzehiri.

---

## FAZ 4 — Roller + süreç (L4) [ORTA+]

> Tam talimat: **`reference/faz4-roller-surec.md`** (SKILL tavan baskısı yüzünden buraya taşındı).
> FAZ 4'e gelince O dosyayı oku; buradaki iskelet bağlayıcı ÖZETTİR:
1. Rolleri `templates/roles.template.md`'den `.claude/agents/`a kur (ORTA = kasif+uygulayici+hakem;
   tavan 40 satır/rol; roller kök CLAUDE.md'nin DELTASIdır). Bölme doğrulaması 4 kontrol:
   frontmatter · `name:` eşleşmesi · ayraç temizliği · `model:`/`effort:` doldur-ya-TÜMÜYLE-sil.
2. İKİ maliyet ekseni `model:` + `effort:` — rubrik + gerekçe: `reference/model-effort-tiering.md`.
   `thinking:` YAZMA (rol-başına ayar yok — ölü referans olur).
2a. Uyarlanır roller İNSAN onayıyla aktifleşir; YAZAN işte gerçek paralellik yoksa TEK-AJANA düş
   (roller L4 = en düşük ROI; kanıtsız rol/dalga kurmak entropidir). **Salt-okur fan-out
   (keşif/tarama/denetim) bunun DIŞINDA — orada paralellik VARSAYILAN (v0.21):** bayat-bağlam
   dahil dört çakışma sınıfının dördü de YAZMA gerektirir. Fan-out'un bedeli sentez protokolüdür
   (çelişkide oylama YOK, ana ajan ölçer). Gerekçe: `reference/orkestrasyon-ve-paralellik.md`.
2b. **Brif/rapor çifti (v0.17.2):** `templates/brif.template.md` (alt-ajana GİRİŞ) +
   `templates/rapor.template.md` (alt-ajandan ÇIKIŞ) kur; rollerin "Çıktın:" bloğu rapor
   biçimine bağlanır. Brifteki `agirlik:` çağrı-başına model/effort override'ını besler
   (rol frontmatter'ı TABAN'dır, tavan değil). Ana-ajan raporu ≠ alt-ajan raporu.
3. Kök CLAUDE.md'ye süreç bölümü: hafif/tam mod ayrımı · sahiplik kilitleri · çıkış raporu +
   failure taksonomisi · [toggle: dış-model] danışma adımı (plan SONRASI eleştiri; tarif, kapı
   DEĞİL) · [toggle: beyin-fırtınası] karar ÖNCESİ çoklu-model ayrışma protokolü + `web-kasif`
   (`reference/coklu-model-beyin-firtinasi.md` — insan çağırır, `KARARSIZ` bayrağında SORAR) ·
   [toggle: PM] ürün-karar eskalasyonu.
4. [ORTA+] Dalga dosyası konvansiyonu + (STATE varsa) STATE "Aktif iş" tablosunu
   CANLI BOARD olarak kur (rol · dokunma kümesi · kilit sütunları; iş bitince satır SİLİNİR —
   ikinci board dosyası AÇMA). [BÜYÜK] WAVES ölçüm logu (budama kararlarının verisi).

---

## FAZ 5 — Pilot dalga (zorunlu çıkış sınavı)

Kurulum, küçük GERÇEK bir işle test edilmeden bitmez:
1. Küçük gerçek görev seç (basit bug/iyileştirme). [UI-ağır repo, DESIGN.md kuruluysa (v0.16)]
   görev bir **walking skeleton** olur — sert tavan: 1 akış (docs/flows.md'den) + ≤2 ekran
   (DESIGN.md token'larıyla, GERÇEK render, mock değil) + minimal gerçek altyapı; ajan render
   alıp kabul kriteriyle karşılaştırır (screenshot script'i hedef repoya reçete edilir, bu paket
   tarayıcı ÇALIŞTIRMAZ). Tavanı aşan kapsam = pilotun ürün geliştirmeye kayması, ATLA. Gerekçe:
   `reference/tasarim-dili-ve-akis.md`.
2. Döngüyü koş. **KÜÇÜK seviyede rol yok** → pilot = tek ajan + verify + kapılar + kısa rapor
   (kâşif/hakem döngüsü yalnız ORTA+'ta). Tören küçük projeyi öldürür.
3. Doğrula: verify yeşil mi? Hook'lar GERÇEKTEN tetiklendi mi (commit'te + Claude Code
   PreToolUse'da kanıtla)? [BÜYÜK] Modül CLAUDE.md'si alt dizinde yüklendi mi?
4. **v0.6 context sınavı:** pilot boyunca en pahalı context kaynağı neydi? Uzun keşif olduysa
   focus summary ham geçmişi ikame etti mi? Sıkıştırılamaz taahhütlerden biri kayboldu mu?
   Tekrar eden prosedür görüldüyse skill-card adayı mı? Bunları kapanış raporuna yaz.
4a. **Makbuzu MÜHÜRLE (sınavdan ÖNCE)** · 5. **🔴 K3 ÇIKIŞ SINAVI — `node verify.mjs --install-exam`** (yedi kontrol: anchor çözünürlüğü ·
   kapı negatif kontrolü · CI · registry · doğruluk kapısı · boyut muafiyeti · bilimsel-çalışma
   bölümü). **Ayrıntı + mühürleme/yükseltme akışı: `reference/faz5-muhur-ve-sinav.md`.**
   FAIL varsa kurulum "tamam" DEĞİLDİR. `ÖLÇÜLEMEDİ`/`UYGULANAMAZ` meşrudur ama STATE'e DÜRÜSTÇE yazılır — uydurma yok.
6. Sürtünmeleri not et (→ FRICTION_LOG ilk girdisi olabilir), rehber/rolleri DÜZELT, sonra
   teslim raporu: ne kuruldu, ne ölçüldü, hangi toggle'lar açık, ilk haftada nelere dikkat.

## Derin gerekçe + sık hatalar

Gerekçeler ve "yapma" listesi: `reference/doctrine.md`. Çok-ekip/ürün/test/sürtünme detayı + örnek settings.json: `reference/multi-team.md`. Dış entegrasyon (CI platformu + Fibery adaptörü; opsiyonel Jev karar yardımcısı §8): `reference/external-integrations.md`. Token/context şablonu: `templates/context-budget.template.md`. Kuruluma başlamadan ilgili olanları BİR KEZ oku.

**FAZ ağır detayları (v0.25):** ADIM 0 → `reference/adim0-toggle-ve-mod.md` · FAZ 2 kapı kataloğu → `reference/faz2-kapi-katalogu.md` · FAZ 3 → `reference/faz3-bilgi-katmani.md` · FAZ 5 mühür+sınav → `reference/faz5-muhur-ve-sinav.md`. **Olgunluk katmanı:** `reference/doctrine.md`.
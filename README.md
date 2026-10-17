# agentic-repo-setup

Bir repoyu **çok-ajanlı AI geliştirmeye** (vibe coding) hazırlayan Claude Code skill'i.
Kimlik: **360° repo zekâsı** — kurar · kanıtlar (pilot + install-exam) · güncel tutar
(`--doctor`) · yükseltir (`--upgrade`) · iyileştirir (FRICTION_LOG + bahçıvan turu). Ayrıntı:
`SKILL.md` girişi. Sürüm geçmişi: kökteki en güncel `vX.Y-KARAR-DEFTERI.md` + `archive/` + `git log`.

Bu bir şablon/starter-kit DEĞİLDİR: skill çağrıldığı repoda önce mini-denetim yapar (ölçer,
varsaymaz), sonra o repoya ÖZGÜ rehber, kapı, takip ve rol katmanlarını üretir — ve kurduğu
yapıyı YAŞATIR. Başka reponun kurallarını kopyalamaz; kopyalasaydı ilk günden yalan söyleyen
bir rehber üretirdi — sistemin çözdüğü ana sorun tam olarak bu.

**"Otomatik kurulum" değildir:** bir AI ajanı SKILL.md'yi okuyup adımları yürütür, ölçer,
birkaç yerde sana sorar (toggle/seviye, secret, baseline, silme) ve repoya-özgü ÜRETİR.
Sabit bir installer-scripti bunu yapamaz — repoya-özgü üretim muhakeme gerektirir.

> **Güncel envanter (v0.31):** <!--fact:gate_count-->6<!--/fact--> kapı · <!--fact:test_count-->797<!--/fact--> birim testi · <!--fact:template_count-->30<!--/fact--> şablon. Kapı sözleşmesi: `gates_contract_version: 2`.

## Kurulum ve kullanım

Kurulum yolları (git clone / plugin marketplace / bundle) ve dürüstlük sınırı: `INSTALL.md`.
Kısaca: hazırlamak istediğin repoda Claude Code'da `/agentic-repo-setup` çalıştır (veya "bu
repoyu çok-ajanlı geliştirmeye hazırla" de). Skill üç eksende soru sorar — **boyut**
(küçük/orta/büyük) × **muhatap** (dev-only mu, ürün/QA ekibi de mi var) × **dış-entegrasyon**
(CI platformu + iş-takip; yalnız ortamda kanıtı varsa) — sonra 5 fazı yürütür: mini-denetim →
kapılar → bilgi katmanı → roller/süreç → pilot dalga. Küçük/dev-only projeye rol/dalga/çok-ekip
katmanı kurmaz — kullanmayan ödemez.

## Paket içeriği (dizin haritası)

```
SKILL.md               kurulum sürecinin kendisi (kuran ajanın talimatları) — kimlik burada kanonik
INSTALL.md             kurulum yolları + dürüstlük sınırı
CLAUDE.md               proje kuralları (kanonik kaynak — öncelik sırası CLAUDE.md:3-7)
CONTRACT.md             kapıların kararlı CLI sözleşmesi + kapı kayıt tablosu + gates_contract_version
vX.Y-KARAR-DEFTERI.md  [aktif sürüm] güncel karar defteri (append-only)
archive/                önceki sürüm karar defterleri (append-only hafıza)
verify.mjs · package.json  öz-doğrulama koşucusu + paket tanımı (script'ler: verify/test/check/health/facts/pack:skill/release/hook:install)
gates/                  kapı script'leri — kanonik envanter ve sınıflar: `CONTRACT.md` "Kapı kayıt tablosu"
  lib/                  paylaşılan yardımcı modüller (kapı DEĞİL)
tests/                  kapı birim testleri (npm test)
scripts/                paketin kendi dogfood'u (self-pre-commit, install-hook, pack-skill, install-exam, install-doctor, upgrade, health-check, facts üretici)
templates/              şablon dosyaları — envanter: `templates/` dizinini listele (her dosya kendi amacını üstte açıklar)
reference/              ağır gerekçe/anlatı dosyaları (doctrine, çok-ekip, dış-entegrasyon, sürüm/karar disiplini, pilot dersleri, anlatım disiplini)
examples/               kapı/hook örnekleri (`acceptance.json` AC-3 KASITLI negatif deney)
docs/                   STATE / CONTEXT_BUDGET / FRICTION_LOG / SIDE-BUGS-LOG (ölümlü + append-only takip dosyaları)
.github/workflows/      CI: öz-doğrulama + kapı testleri (her push/PR)
.gitattributes          dağıtım dışlamaları (export-ignore) — pakete GİRMEYENLERİN tek kaynağı
public/                 PAYLAŞIMA HAZIR release bundle'ları (.skill + .zip); bundle'a kendisi girmez
pilot-proje/ · pilot-sim/  [yalnız geliştirme reposunda — bu public sürümde YOK] pilot vaka çalışması
LICENSE · NOTICE        Apache 2.0 lisans metni + telif bildirimi
```

Pakete girenler için tek doğru kaynak `.gitattributes` (export-ignore); kapı envanteri için
`CONTRACT.md`; şablon envanteri için `templates/` dizininin kendisi.

## Tasarımın dayandığı ilkeler (özet — tamamı reference/doctrine.md)

1. Ajanın ana hata kaynağı zekâ değil, okuduğu **yanlış gerçeklik modeli**dir → rehber kısa + ölçülmüş olur.
2. **Mekanizması olmayan kural gürültüdür** → her kuralın bir bekçisi var (script/CI/hook/Hakem).
3. **Kalıcı/geçici ayrımı** çürümeyi önler → anlık-durum sadece ölümlü dosyalara yazılır; tarih append-only.
4. Uygulayan ≠ doğrulayan → Hakem ayrı ajan, salt-okunur araç kısıtıyla.
5. Güvence makineden gelir → LLM doğrulayıcı yüzeysel bakar; kapılar dört halkada (hook/pre-commit/CI/Hakem).
6. **Kullanmayan ödemez** → çok-ekip/ürün/test içeriği toggle'a bağlı, çekirdeği şişirmez (v0.5).
7. **Varlık kapısı ≠ kalite kapısı** → her kapı dürüstçe etiketlenir; varlık kapısı boş-bırakmayı önler, kaliteyi garanti etmez (v0.5).

## Sürüm geçmişi

Elle changelog tutulmaz. Sürüm sürüm gerekçe/kabul-red kararları: kökteki en güncel
`vX.Y-KARAR-DEFTERI.md` + `archive/*-KARAR-DEFTERI.md`. Değişiklik ayrıntısı: `git log`.

## v1.0 yol haritası

v1.0 "kanıtlanmış son hal" için kalanlar (kritik yol; yapılanlar karar defterlerinde):

1. **Tam evrensellik (kısmi):** kapılar çok-stack. Hâlâ açık: hedef
   reponun TEST/BUILD'ini koşan stack-yerli `verify` ÜRETİMİ talimat düzeyinde (SKILL Faz 2 reçetesi) —
   Node'suz repoda kurulum ajanı reçeteyi izler ama otomatik üreteç yok. Go/Ruby secret desenleri henüz yok.
   v0.28: kapılar Node'suz REPOYA da kurulur (Node makinede aranır, D-34); makinede de yoksa
   başlatıcı atlar ve söyler. Kapıların ikinci bir dile (Python) taşınması pilot ölçümüne bağlı.
2. **Dil:** İngilizce varsayılan + `language` parametresi (yayın engelleyici).
3. **Toggle'lı feature-traceability kapısı** (commit-ID + index, chore/deps kaçışlı) — ölçülmüş ihtiyaçla.
4. **Pilot kanıtı:** gerçek-repo pilotu KOŞTU (pilot backend, 2026-08-06 — künye + kapı bulguları:
   v0.18 karar defteri K35 — geliştirme reposunda). Kalan: kurulum yaşam-döngüsü ekseni (`--doctor --seal` → sınav → devir dosyası →
   aylar-sonrası mutabakat) henüz sahada koşmadı; augment modu, BÜYÜK (rol/dalga) hâlâ açık.
5. **Hook payload'ı:** Claude Code PreToolUse örneği staged git'i okur, yazılacak içeriği değil → "ajan yazarken yakala" iddiası pre-commit'te tam, PreToolUse'da kısmi. Düzeltme bekliyor.
6. **v0.7 uygulaması:** model-truth kapısı + rol taslakçısı + Faz 1/4 prose henüz kod olarak yazılmadı (karar defterinde "tasarlandı, uygulama bekliyor").
7. **DEAK platform-üreteçleri (v0.9 ertelenenleri):** Azure DevOps + GitLab CI üreteçleri (şu an reçete elle dökülür);
   Fibery **senkron** toggle'ının "index==kaynak" uzlaştırma kapısı KODU. İkisi de gerçek-repo pilotuna bağlı (kalibre).
8. **Jira/Notion tracker adaptörleri:** Fibery deseni genelleştirilir — ölçülmüş ihtiyaçla (ortamda hangi MCP bağlıysa).

Hâlâ genç: kurulumdan sonra ilk 5-10 dalganı ölç, değer üretmeyen parçayı çekinmeden sil.

## Lisans

Apache 2.0 — telif **Mert Gürlek**, 2026. Ticari kullanım dahil serbestçe kullan, türet, dağıt.
Şartlar: lisans metni ve `NOTICE` kopyalarda korunur; değiştirdiğin dosyalarda değişikliği
belirtirsin; yazarın adı ve proje adı, türev ürünü tanıtmak için izinsiz kullanılamaz. Lisans
ayrıca katkıcılardan patent hakkı verir (tam metin: `LICENSE`).

Katkı: herkes fork'layıp **pull request** açabilir; `main` korumalıdır, doğrudan push kapalıdır
ve her PR sahibinin onayından ve CI'dan geçer. Ayrıntı: `CONTRIBUTING.md` · güvenlik açığı
bildirimi: `SECURITY.md`.

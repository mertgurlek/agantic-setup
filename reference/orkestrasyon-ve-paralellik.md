# Orkestrasyon ve Paralellik — hız ekseninin gerekçesi (v0.21)

> SKILL.md tavanı ~300 satır; bu dosya delegasyon/fan-out kararlarının AĞIR gerekçesidir.
> Bağlayıcı kural metni `templates/CLAUDE.template.md` delegasyon bloğundadır — burası NEDEN'i tutar.
> Kaynak kararlar: v0.7 (tek-ajana düş) · v0.18.1 K34 (delegasyon ekonomisi) · v0.21 K50 (bu tur).

## Neden hız ikinci hedef oldu

Birinci hedef doğruluk, ikinci hız — bu sıra değişmedi. Ama v0.20'ye kadar hız hiç ÖLÇÜLMEDİ:
`scripts/` + `gates/` + `templates/` genelinde tek bir süre ölçüm noktası yoktu [ÖLÇÜLDÜ 2026-08-12].
Ölçülmeyen eksen iyileşmez; bu paketin kendi doktrini. v0.21 FAZ A ölçümü kurdu.

## Üç aşamalı ayrım — kararın çekirdeği

Paralellik tek bir şey değildir. `templates/CLAUDE.template.md`'deki dört çakışma sınıfı
(yazma-yazma metinsel · yazma-yazma semantik · okuma-yazma/bayat bağlam · kaynak yarışması)
**dördü de bir YAZMA gerektirir.** Buradan tek bir ayrım çıkar:

| Aşama | Yazar mı | Çakışma riski | Paralellik |
|---|---|---|---|
| Keşif / tarama / okuma | hayır | **yok** | VARSAYILAN, sınırsız fan-out |
| Denetim / doğrulama | hayır | **yok** | paralel |
| Uygulama / yazma | evet | üç sınıf canlı | ayrık dokunma kümesi ŞARTI |

Salt-okur aşamada paralelliği kısıtlamanın doğruluk gerekçesi YOKTUR — kısıtlama saf maliyettir.
Bu, "her yerde paralel" demek değildir: yazan tarafta v0.7/K34 disiplini AYNEN durur.

## v0.7 RED'i neden kısmen geri açıldı

v0.7 iki alternatifi reddetti:
1. **"Çok-ajanı her repoda varsayılan yapmak"** — RED: *"paralellik KANITI olmadan eklemek
   entropidir"* (dayanak: MAST, ajanlar-arası uyumsuzluk ~%37).
2. **"Ayrı moderatör/orkestratör motoru"** — RED: *"runtime motoru YOKTUR, doktrine aykırı"*.

**② AYNEN DURUYOR.** Bu turda hiçbir daemon/router/süreç kurulmadı; orkestrasyon ana ajanın
davranışıdır, bir yazılım bileşeni değil. SKILL.md kimliği (runtime motoru DEĞİL) korunur.

**① salt-okur aşamayla SINIRLI olarak gevşetildi.** İki gerekçe:
- Red koşullu yazılmıştı ("kanıt olmadan") ve kanıt hiç ölçülmemişti — v0.21 FAZ A onu üretti.
- MAST'ın ölçtüğü uyumsuzluk YAZAN ajanlar arasında doğar (biri diğerinin varsayımını bozar).
  Hiçbir şey değiştirmeyen kâşif bu hata sınıfını üretemez.

## Fan-out'un GERÇEK riski: çakışma değil, sentez kaybı

Salt-okur fan-out çakışma üretmez — ama bilgi kaybeder. Ölçüm (K48, 768 canlı çağrı, $9.35):
**belirleyici olgunun karara taşınma oranı %84.** Yani ~6 raporun 1'i kritik olguyu ana ajana
HİÇ taşımıyor. Fan-out bu kaybı ajan sayısıyla ÇARPAR: 5 kâşif ≈ beklenen 0,8 eksik rapor.

Bu yüzden fan-out'un bedeli **sentez protokolüdür** (`CLAUDE.template.md`):
- ⓐ `[ÖLÇÜLDÜ]` dışındaki iddia karara temel olamaz
- ⓑ İki rapor çelişirse ana ajan KENDİ ölçer — **oylama yok, çoğunluk kanıt değildir**
- ⓒ Kilit/baseline/kabul ölçütü ana ajanın kendi okumasıdır (körlük panzehiri)

## Ölçülen üç başarısızlık (2026-08-12, iki paralel kâşif turu)

Bu turun kendisi bir deneydi; üç hata sınıfı canlı gözlendi [ÖLÇÜLDÜ]:

| # | Ne oldu | Panzehir |
|---|---|---|
| S1 | 2/2 kâşif keşif şemasını (`OLGU\|KANIT_REFERANSI\|SINIR\|AÇIK_SORU`) kullanmadı; biri yasak "ÖNERİLER/hipotez" bölümleri üretti | live/template hizalama (aşağıda) + rol "Çıktın:" bağı |
| S2 | Kâşif `[ÖLÇÜLDÜ]` etiketiyle YANLIŞ sabit verdi ("512 test bayat → 418"); ana ajan koştu, gerçek 512/512 | sentez protokolü ⓐ + sabit verme yasağı |
| S3 | Kâşif, brifteki cümleyi `KANIT_REFERANSI` diye GERİ döndürdü | brif fan-out bloğu: döngüsel referans yasağı |

**S1'in kökü bulundu — live/template SAPMASI (K48 yan bulgusu):** `yokluk körlüğü`, `canlılık
refleksi`, `türetilmiş katman`, `sürüm-gerçeği` ve ZORUNLU ORTAK SATIR (`ölçüm talimatı yener`)
kuralları `templates/roles.template.md`'de VARDI, `.claude/agents/kasif.md`'de YOKTU; ortak satır
ise **beş rolün beşinde de** eksikti [ÖLÇÜLDÜ 2026-08-12]. Paketlediğimiz doktrini kendi
repomuzda koşturmuyorduk. v0.21'de kapatıldı.

🔴 **Sapmanın kendisi bu turda TEKRAR ETTİ — kayda değer:** ilk düzeltme turunda beş kuraldan
DÖRDÜ eklendi, `sürüm-gerçeği` atlandı; bu dosya yine de "beşi de eklendi" yazıyordu. Hakem
ölçtü ve iddia↔kanıt uyumsuzluğu olarak raporladı (madde 3b). Ders: **sapmayı kapattığını
BEYAN etmek, kapattığının kanıtı değildir** — sayarak doğrula. Doğrulama komutu:
`grep -c "Sürüm-gerçeği\|Yokluk körlüğü\|Türetilmiş katman\|Canlılık refleksi\|Ölçüm talimatı yener" .claude/agents/kasif.md`
→ 5 dönmeli. Hedef repolarda aynı sapma beklenir — `verify.mjs --doctor` bu sınıf için vardır.

## Hız ölçümünün ilk iki dersi

1. **Tek ölçüm yanıltır.** İlk `verify.mjs` koşusu 2,6 sn gösterdi (soğuk başlangıç); ısınmış
   ardışık koşular 0,8 sn — CLAUDE.md baseline'ı DOĞRUYDU. "Sabit bayatlamış" yan-bug'ı
   yazılmak üzereyken ikinci ölçüm çürüttü. Karşılaştırma ısınmış koşular arasında yapılır.
2. **Darboğaz tek adımda toplanır.** `utf8` adımı soğuk koşuda toplamın **%71'i** (1856 ms /
   ~2,6 sn); diğer 9 kapı ~790 ms. Kapıları paralelleştirmenin alt sınırı `utf8`in kendisidir —
   yani "paralel koşalım" sezgisi yanlış yeri gösteriyordu. Hız kazancı orkestrasyondadır,
   kapı koşusunda değil. (`node --test` 26,8 sn ile zaten baskın kalem.)

## Sınırlar — bu turda bilinçle YAPILMAYANLAR

- **Yazan ajanlarda agresif paralellik:** bayat-bağlam riski gerçek, süpervizör kararıyla dışarıda.
- **Dokunma-kümesi kesişim KAPISI:** `write_set` alanını `check-process-discipline --rule=spec-receipt`
  v0.23'ten beri okuyor (TEK yön — plan 3+ commit bayatsa no-op); ama iki planın `write_set`'i
  KESİŞİYOR MU diye karşılaştıran bir kapı hâlâ YOK. Strict'e çıkarmadan önce sahada FP ölçümü
  şart (K29-rev emsali) — bulanık invariant E0'a inmez.
- **`uygulayici`ye `tools:` daraltması** (derinlik=1'i mekanikleştirme): yetki zarfı değişikliği,
  AYRI insan onayı ister; SB-14 olarak zaten loglu.
- **verify.mjs paralelleştirme:** ölçüm sonrası önceliği DÜŞTÜ (yukarıdaki 2. ders).

## v0.31 — dosya sahipliği: paralel YAZAN ajanların birbirini tanıması (K87)

Claude Code oturumları artık birbirini listeleyip (`ListAgents`) mesajlaşabiliyor (`SendMessage`).
Bu, yazan tarafta "kim hangi dosyada" sorusunu açtı. Ölçümler (2026-10-06) [ÖLÇÜLDÜ]:

| Ölçüm | Sonuç | Tasarıma etkisi |
|---|---|---|
| İki alt ajan aynı dosyada | birbirini GÖREMEDİ (`ListAgents` alt ajanda yok); ayrı bölümler not ile birleşti, aynı satıra ikinci yazım "modified since read" ile reddedildi | harness koruması yalnız aynı satırı yakalar; semantik/bayat çakışma açık |
| Ana oturum listesi | 36 oturum; isim · tür · meşgul/boşta — **repo/dosya bilgisi YOK** | "kim neyi tutuyor" için ayrı kayıt şart |
| PreToolUse stdin (alt ajan) | `agent_id` + `agent_type` gelir, `session_id` ebeveynle aynı; `prompt_id` `claude -p`'de yok | sahiplik anahtarı = (oturum, alt ajan) |
| Yaşam döngüsü olayları | `SubagentStop`(agent_id) · `SessionEnd`(session_id, reason) var | sahiplik olayla bırakılır; TTL yalnız çöküş yedeği |
| Bash çocuk ortamı | `CLAUDE_CODE_SESSION_ID` var, agent_id yok; `CLAUDE_PID` iç içe oturumda MİRAS | dış-model sarmalayıcıları oturumu bilir; PID ile canlılık YAPILMAZ |
| Mesaj adresi | `session_id`'ye `SendMessage` → "not reachable" | oturum adı açık beyanla kaydedilir (`sahiplik.mjs ad`) |
| Hook uyarı kanalı | exit 0 + düz stdout modele ULAŞMAZ; `hookSpecificOutput.additionalContext` ulaşır | bilgi JSON ile verilir (SB-37: delege-kotasi aynı kusuru taşır) |
| Uçtan uca uyarı vs engel (2026-10-07) | uyarı modunda mesaj modele yazım BİTTİKTEN sonra ulaştı, dosya değişmişti; exit 2 yazımı reddetti, dosya değişmedi | uyarı ÖNLEMEZ → varsayılan ENGEL |

**Tasarım düzeltmesi — sahiplik ömrü = çalışma anı:** ilk tasarımda kayıt oturum kapanana (ya da 30 dk
TTL'e) kadar yaşıyordu; saatlerce boşta bekleyen oturum dosyayı tutuyor görünür, engellemek yanlış alarm,
uyarmak etkisiz olurdu. Düzeltme: ana ajanın kayıtları TUR SONUNDA (Stop) bırakılır, alt ajanınkiler
SubagentStop'ta. Kayıt varsa sahibi ŞU AN çalışıyordur → engel güvenli; bekleyenin `notify_when_idle`
aboneliği tam sahipliğin bırakıldığı anda tetiklenir. TTL 30→10 dk: çöküş yedeği + uzun bir turda
dosyayla işi bitmiş ajanın sahipliğini düşürür (sahip yeniden yazmak isterse engellenir ve yeniden okur).

**Neden tek JSON kayıt değil, dosya başına kayıt:** tek kayıt dosyası paralel yazımda kendisi kayıp
güncelleme odağıdır — ilk testte iki ajan aynı sayacı 0'dan okuyup yazdı. Dosya başına kayıt + `wx`
(yoksa-oluştur) ile 20 eşzamanlı süreçten tam biri kazanır (test).

**v0.7 RED ② ile uyum:** "yönetici" bir ROLDÜR — açık bir ana oturum sırayı yazar. Hiçbir daemon,
router ya da kendiliğinden koşan süreç kurulmadı; hook'lar zaten olan araç çağrısına bağlıdır.

**Dış modeller:** OpenRouter sarmalayıcısında yazım tek noktadan geçer → sahiplik + okuma-sonrası-değişti
kontrolü orada. Codex kara kutudur (tüm çalışma alanına yazar, arada görünmez) → **önce beyan
(`--yaz`), sonra kontrol** (git durumu farkı ↔ beyan ↔ kayıt); çalışırken durdurma YOK (kullanıcı kararı).

**Dürüst sınırlar:** Bash/`sed` yazımı hook'a görünmez · TTL devralmasında milisaniyelik yarış penceresi
· varsayılan ENGEL (K29-rev'den sapma bilinçli: uyarı burada önleyici değil, yalnız bildirim — ölçüldü) · iki AYRI planın
`write_set` kesişimini plan anında karşılaştıran kapı hâlâ yok (sahiplik yazım ANINDA yakalar).

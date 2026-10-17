# Sürüm ve Karar Disiplini — D-A + D-B (v0.11)

> Kuran ajanın el kitabı (E1-lazy: her skill değişiminden önce/sonra okunur, ya da bir sürüm bump'ı
> ya da karar-defteri girdisi yazarken). **Taşıyıcı olay:** bu repo bir kez kaynak `0.10.0-alpha`
> iken bundle `public/`'ta `v0.9.0`'da DONMUŞTU — kaynak değişti, çıktı üretilmedi, kimse fark etmedi.
> Ayrı bir turda README "9 kapı" derken `gates/` altında 16 kapı vardı. İkisi de aynı hastalığın
> belirtisi: **gerçek TEK yerde değişti, diğer yerler eskide kaldı.** D-A ve D-B bunun kalıcı
> panzehridir — SemVer'i tek gerçeğe bağlar (D-A) ve her sürümün "neden"ini kalıcı bir deftere
> yazdırır (D-B). Mekanizma: `scripts/health-check.mjs` (`npm run health`).

---

## D-A — SemVer: tek gerçek, üç yer

**Tek SemVer gerçeği** üç yerde SENKRON olmalı — biri değişince üçü de değişir:

1. `package.json` → `"version"`
2. `SKILL.md` → başlık satırı (`# Agentic Repo Setup — Kurulum Süreci (vX.Y.Z)`)
3. `public/` → bundle adı (`agentic-repo-setup-vX.Y.Z.skill` / `.zip`, `npm run pack:skill` üretir)

Üçü aynı sayıyı taşımıyorsa paket kendiyle çelişir: bir ajan `package.json`'a bakıp bir sürüm
sanır, indirdiği bundle başka bir sürümdür. Bu SIRADAN bir yazım hatası değil — sürümü **tek bir
commit'te** üç yerde birden değiştirmeyi unutmak kadar kolay, ve fark edilmesi kadar zor.

### Değişiklik-sınıfı → bump kuralı

| Değişiklik sınıfı | Bump | Örnek |
|---|---|---|
| Yeni kapı/şablon/davranış EKLEME (geriye-uyumlu) | **MINOR** | `check-brief-provenance.mjs` eklendi (v0.11; bugün `check-provenance --rule=brief-provenance`) |
| Kırıcı sözleşme değişikliği (argüman/çıkış-kodu/JSON şeması değişti) | **MAJOR** | henüz yaşanmadı — `CONTRACT.md`'nin "geriye-uyumsuz" tanımı |
| Yalnız drift düzeltme / dokümantasyon hatası (kod davranışı AYNI) | **PATCH** | "README 9 kapı diyordu, 16'ydı" düzeltmesi |

Bu tablo `CONTRACT.md`'nin kendi sürümleme kuralıyla (satır ~9-10: "geriye-uyumsuz değişiklik
`gates_contract_version`'ı artırır") AYNI mantığın paket-sürümüne genellenmiş hali — orada kapı
CLI'ının sözleşmesi konuşulur, burada paketin SemVer'i.

### "Update → version → output" boru hattı

Her skill değişimi bu SIRAYLA ilerler — bir adımı atlamak D-A'nın çözdüğü hastalığı üretir:

1. **① Değiştir** — kapı/şablon/rehber/reference içeriğini güncelle.
2. **② Üç yerde bump + karar-defteri girdisi** — yukarıdaki üç yeri değişiklik-sınıfına göre bump
   et; AYNI commit'te aktif `v<x>-KARAR-DEFTERI.md`'ye bir girdi ekle (D-B, aşağıda).
3. **③ `npm run pack:skill`** — kaynaktan sürümlü `.skill` + `.zip` üret (`public/` altına).
4. **④ Verify + health-check** — `node verify.mjs` (7 statik kapı) + `node --test` +
   `node scripts/health-check.mjs` (entropi taraması) çalıştır; hepsi yeşil olmadan release yok.

Boru hattının HER adımı bir öncekinin çıktısını doğrular; ④ atlanırsa ②'nin unutulduğu (drift)
ancak bir sonraki turda insan gözüyle fark edilir — ki bu tam bu repoda olan şeydi.

### `gates_contract_version` AYRI eksen

Paket SemVer'i (`package.json`/`SKILL.md`/bundle) ile `gates_contract_version` (bkz.
`CONTRACT.md`) **iki farklı ekseni** ölçer, karıştırılmamalı:

- **Paket SemVer'i:** "bu paket ne kadar değişti" — her MINOR/PATCH ilerler.
- **`gates_contract_version`:** "kapı CLI'ının (argüman/çıkış-kodu/JSON şeması) sözleşmesi kırıldı
  mı" — yalnız GERİYE-UYUMSUZ bir değişiklikte artar.

`CONTRACT.md` bunu tekrar tekrar kaydeder: yeni **opt-in, geriye-uyumlu** bir kapı eklemek
(`gates_contract_version`'ı ARTIRMAZ) bile paketin kendisini MINOR bump'a zorlar (yeni davranış
eklendi). v0.8.1'den v0.11'e kadar her ara-sürüm bu ayrımı örnekler: paket 0.8→0.11 defalarca
ilerledi, `gates_contract_version` hâlâ `1`. İkisini AYNI sayı sanmak, "kapı sözleşmesi hâlâ 1,
o zaman hiçbir şey değişmedi" gibi yanlış bir güvene yol açar.

### Mekanizma

`scripts/health-check.mjs`'nin sürüm-tutarlılığı bloğu (`checkVersion`) üç yeri karşılaştırır:
`package.json` sürümünü okur, `SKILL.md` başlığından SemVer'i regex'le çeker, `public/` altındaki
bundle dosya adlarından sürümü ayıklar. Üçü uyuşmuyorsa `surum-uyumsuz` / `bundle-bayat` uyarısı
üretir. Bu, ②-③ adımlarının unutulduğunu SONRADAN yakalayan bir güvenlik ağıdır — boru hattının
kendisini ZORLAMAZ (o insan disiplinidir), yalnız kaçırıldığında sessiz kalmasını engeller.

---

## D-B — Karar = Doküman

Her karar (küçük ya da büyük) **append-only** bir deftere, **sabit bir şablonla** yazılır. Bu,
sistemin genel "kalıcı/geçici ayrımı çürümeyi önler" yasasının (bkz. `reference/doctrine.md`)
karar katmanına uygulanmış hali — bir kararın "neden"i bir commit mesajında kaybolursa, bir
sonraki ajan/insan aynı tartışmayı sıfırdan yapar.

### Karar girdisi şablonu

```
### K<n>. <kararın tek cümlelik adı>
- **Karar:** ne değişti / ne yapılmayacak (net, geri dönüp okunduğunda tek anlamlı).
- **Neden:** hangi ölçülmüş sorun/bulgu bu kararı doğurdu (varsayım değil, ölçüm — doctrine'in
  "içerik kopyalanmaz üretilir" ilkesiyle aynı ruh: emin değilsen yazma, ölç ya da atla).
- **Alternatifler:** elenen seçenek(ler) + neden elendi (tek satır yeter, uzun tartışma gerekmez).
- **Sonuç/etki:** sürüm bump sınıfı (MAJOR/MINOR/PATCH) + `gates_contract_version` etkisi (ARTTI/
  ARTMADI + gerekçe) + hangi dosyalar değişti.
- **Geri alınabilir mi:** EVET (nasıl) / HAYIR (neden — örn. bir dosya silindi, git geçmişi hariç
  geri dönüşü yok) / KISMEN.
- **Tarih:** YYYY-MM-DD.
```

Rutin kararlar (bir kapıya desen eklemek, bir README satırını düzeltmek) bu şablonun TEK bir
girdisiyle kapanır. `CONTRACT.md`'deki "sürümleme kuralı" paragrafları (satır 21 vd.) bu şablonun
minyatür/gömülü halidir — burada AYRI, kronolojik bir deftere taşınması istenir ki dağınık
paragraflar yerine tek bir "neden tarihi" olsun.

### Yerleşim

- **Aktif defter kökte:** `v<major>.<minor>-KARAR-DEFTERI.md` (örn. şu an `v0.10-KARAR-DEFTERI.md`)
  — yalnız BİR tane, o an geliştirilmekte olan minor hattın hafızası.
- **Öncekiler `archive/`'a devredilir:** minor hat kapanınca (bir sonraki minor açılınca) defter
  `archive/v<x>.<y>-KARAR-DEFTERI.md` olarak taşınır — silinmez, KONUM değişir. `archive/` zaten
  `v0.5`'ten `v0.9`'a kadar bu deseni taşıyor.
- **PATCH sürümler YENİ defter açmaz:** aynı minor hat içindeki `v0.8.1`→`v0.8.5` gibi patch'ler
  hâlâ tek `v0.8-KARAR-DEFTERI.md`'ye girdi olarak eklenir (README'nin "Sürüm notu" bölümündeki
  `v0.8.1`…`v0.8.5` alt-başlıkları bu desenin nesir-özeti).

### Büyük karar / rutin karar ayrımı

- **Büyük karar** (mimari yön, yeni bir dik eksen, bir katmanın TASARIM olarak ertelenmesi) **kendi
  dokümanını alır** — `v0.10-KARAR-DEFTERI.md`'nin tamamı buna örnek (K1-K8, her biri Neden/Ne
  ile genişletilmiş; "0. Tek cümlelik karar" özeti tepede).
- **Rutin karar** (bir desen eklemek, bir sayıyı düzeltmek, opt-in bir kapı eklemek) yukarıdaki
  şablonun **tek bir girdisiyle** kapanır — kendi dokümanını hak etmez, aktif deftere satır olarak
  düşer.

Ayrımın testi: karar ileride "neden böyle yaptık" diye sorulduğunda bir paragraf mı bir sayfa mı
gerektiriyor? Cevap sayfa ise büyük karardır.

### Mekanizma — sürüm↔karar bağı

`scripts/health-check.mjs`'nin `checkVersion` fonksiyonu aktif `package.json` sürümünün
major.minor'ına karşılık gelen `v<x>.<y>-KARAR-DEFTERI.md`'nin kökte VAR olup olmadığını denetler.
Yoksa `karar-defteri-yok` uyarısı üretir — "sürüm ilerledi ama nedeni hiçbir yere yazılmadı"
durumunun makine bekçisi. Bu bir VARLIK denetimidir (dosyanın orada olması), kararın İÇERİĞİNİN
yeterliliğini denetlemez — o insan/Hakem işi (bkz. "varlık≠kalite" ayrımı, aşağıda).

---

## Budama / Bahçıvan Ritüeli

`scripts/health-check.mjs` yukarıdaki iki disiplinin YANINDA, `reference/doctrine.md`'nin
"Yaşayan sistem yasaları" bölümündeki **dalga sürüklenmesi** panzehirini ("periyodik bahçıvan
turu") mekanize eder — boş dizin, yetim "konsolide edildi" dosyası, aşırı-untracked iş, kapı/dok
sayısı driftı, export-ignore boşluğu.

- **Ne zaman koşulur:** her **release öncesi** (boru hattının ④ adımı) VE **periyodik** olarak
  (büyük bir dalga/fazın sonunda, "bahçıvan turu" ölümlü bir görev DEĞİL, tekrar eden bir alışkanlık
  — doctrine'in dalga-sürüklenmesi panzehri her seferinde bir defalık temizlik değil, DÜZENLİ tur ister).
- **Kim koşar:** kuran/geliştiren ajan kendisi (`npm run health`), release'te insan onayından önceki
  son otomatik adım olarak.
- **Bulgulara nasıl tepki verilir:** her UYARI bir insan kararı bekler — **arşivle** (yetim/konsolide
  dosya → `archive/`), **sil** (gerçekten ölü, git geçmişi zaten güvenlik ağı), ya da **güncelle**
  (drift'i düzelt — README sayısını gerçeğe eşitle, bundle'ı yeniden paketle). Script HİÇBİRİNİ
  otomatik yapmaz; yalnız "şuraya BAK" der.
- **"Temizlik için untrack" YASAK:** bir dosyayı `.gitignore`'a alıp `git rm --cached` ile izlemeden
  çıkarmak "temizlik" gibi görünür ama **çok-cihaz git senkronunu kırar** — o dosya artık bu cihazda
  yaşar, diğer cihaz/ajan onu hiç görmez, "yapıldı" sanılan iş aslında paylaşılmamış demektir.
  Güvenlik ağı git GEÇMİŞİDİR, untrack değil: gerçekten gereksizse commit'le SİL (`git rm`), gerekiyorsa
  `archive/`'a TAŞI — ikisi de git geçmişinde iz bırakır, untrack bırakmaz.
- **Kapı DEĞİL, ritüel:** varsayılan davranış **UYARIR, BLOKE ETMEZ** (exit 0, bulgu varsa da).
  Gerekçe doktrinden: "öznel tetiği makineye gömme" — bir dosyanın arşivlenmeye mi silinmeye mi
  değer olduğu bir İNSAN kararıdır, makine yalnız adayı işaretler. `--strict` bayrağı (CI/release
  öncesi) bunu tersine çevirir: herhangi bir UYARI varsa exit 1 — release'i BLOKE eden tek mod budur.

---

## Doktrin bağı

Bu iki disiplin (D-A, D-B) ve bahçıvan ritüeli üç doktrin yasasının somut uygulamasıdır:

- **"Mekanizması olmayan kural gürültüdür"** (SKILL.md ALTIN KURAL ②) — D-A ve D-B'nin ikisi de
  bir script'e (`health-check.mjs`) bağlıdır; bağlı olmasaydı bu dosya bir NİYET beyanından ibaret
  kalırdı, tıpkı skill'in kendisinin bir kez "9 kapı" yazıp gerçeğin 16 olduğunu fark etmemesi gibi.
- **"Öznel tetiği makineye gömme"** — hangi dosyanın arşivleneceği/silineceği bir zevk/bağlam
  kararıdır (E3 insan); makine yalnız ADAYI çıkarır (E0). Bahçıvan ritüelinin varsayılan UYARI
  (blok değil) davranışı bu ayrımın doğrudan sonucu.
- **"Varlık ≠ kalite"** — `karar-defteri-yok` kontrolü defterin VAR olduğunu denetler, İÇİNDEKİ
  kararın doğru/yeterli olduğunu denetleyemez; `envanter-isareti-yok`/`kapı-drifti` de aynı
  şekilde SAYININ tutarlılığını denetler, kapının İŞLEVİNİ değil. İkisi de dürüstçe VARLIK
  sınıfındadır — health-check'in kendisi de bu sınırı aşmaz.

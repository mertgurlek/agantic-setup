# Pilot Dersleri — Gerçek Ölçüm Ne Öğretti

> Kuran ajanın el kitabı (E1-lazy: yalnız FAZ 5 pilot dalgasını planlarken veya bir kapının
> "neden var" gerekçesini yazarken okunur). **Taşıyıcı fikir:** bu dersler masa başı tahmin
> değil — gerçek bir hedef repoda koşulan bir pilottan **ölçülmüş** bulgular. Sayılar
> repo-özgüdür (tekrarlanmaları garanti değil — bkz. doctrine.md araştırma dürüstlük notu),
> ama **desen** (yapısal ders) genellenebilir ve bu skill'in kendi kurulum sürecine dönük.

---

## 1. 🔴 "Kurulu" ≠ "çalışıyor"

**Bulgu:** Bir pilot repoda kapılar **bir aydır kuruluydu** ve bir tazelik-kapısı **hiçbir şey
yapmıyordu** — çünkü kapının denetlediği alan (bir doc-anchor sayacı) **SIFIR**dı. Kapı vardı,
**yakıtı yoktu**, sessizce **no-op** koşuyordu.

**Neden ölümcül:** Kurulum çıktısını *"N kapı kuruldu → Faz 2 tamam"* diye ölçmek, aynı yanılsamayı
her hedef repoya çoğaltır. **Kapı sayısı bir başarı metriği DEĞİL.**

**Panzehir (bu skill'e işlenmiş):**
- **Kapı ETKİ oranı:** kapı kaç kez **ateşledi** / kaç commit'te koştu. `0 ateşleme = no-op = KURULU
  DEĞİL` — varlığı ile etkisini ayrı say.
- **Yakıt kapsamı metriği:** bir kapının denetlediği yüzeyin (anchor, alan, sözleşme…) kaçı gerçekten
  dolu? Boş yüzey = kapı hiç ateşleyemez, kurulum bunu görünmez bırakmamalı.
- **Kabul ölçütü değişir:** ❌ eski *"kapı kuruldu"* → ✅ yeni *"kapı **N kez ateşledi**, M'i **gerçek
  yakalama**"*.

> **Bu, doktrinin budama yasasının ikizi.** Her artefakt iki etiket taşır: *neyle savaşıyor* +
> *son GERÇEK yakalama*. Kurulum sınavı da aynı soruyu sormalı — bkz. FAZ 5.

---

## 2. 🔴 Ölçünün kendisi de oyunlanabilir — tek panzehir NEGATİF KONTROL

**Bulgu:** İlk tasarlanan kurulum çıkış sınavı beş kontrolden oluşuyordu: anchor sayısı > 0,
ateşleme ≥ 1, CI var, takip-yapısı dolu, model erişimi ping'lendi. **Hepsi VARLIK ölçüyordu,
hiçbiri ETKİ ölçmüyordu.** Tek bir sahte/anlamsız anchor yazarsan birinci kontrolü geçersin;
kapı hâlâ hiçbir gerçek ihlali yakalamıyor olabilir.

**Neden ölümcül:** "0 ateşleme = fail" kuralının kendisi bile sadece VARLIK ölçer — kapı bir kez
ateşlemiş olabilir ama o ateşleme anlamsız/yanlış-pozitif olabilir. Bir ölçüm sistemi kurarken
"ölçünün kendisi doğru mu" sorusunu sormazsan, ölçü de kapı gibi sessizce no-op'a düşer.

**Panzehir — TEK gerçek çözüm negatif kontroldür:** bilerek bozulmuş bir denek (sentetik ihlal —
örn. yasaklı bir desen içeren geçici bir commit) hazırla, kapıya koştur. Kapı bunu **yakalıyor mu**
(beklenen exit ≠ 0)? Yakalamıyorsa kapı ateşlese bile çalışmıyordur. Bu, "kurulu ≠ çalışıyor"
dersinin (§1) tek gerçek panzehiridir — pozitif ateşleme sayısı asla yeterli kanıt değildir.

> **Pratik uygulama:** kurulum çıkış sınavına (FAZ 5) en az bir negatif-kontrol kalemi ekle: geçici
> bir branch'te sentetik ihlal commit'i → kapı reddediyor mu → sil. Denek kalıcı repoya karışmaz.

🔴 **v0.20 GENİŞLETMESİ — bu ders TEK YÖNLÜYDÜ, ikinci yön eklendi.** Yukarıdaki tarif yalnız
"bozuğu YAKALIYOR mu"yu ölçer. Sahada ölçülen ikinci başarısızlık sınıfı bunun AYNASIDIR: kapı
**meşru girdiyi de reddediyorsa** kalıcı sahte alarm üretir, ekip onu kapatır — sonuç kapıyı hiç
yazmamakla aynıdır (pilot: 17 yanlış-pozitif, 9 "kapı yanlış şeyi ölçüyordu" vakası; bir kapının
ilk sürümü türev repoların KODUNU ihlal sayıyordu ve geri çekildi). Kanonik adlandırma
(`reference/doctrine.md`): **yakalama kontrolü** + **geçirme kontrolü**. ⚠️ Sahada bu iki yön için
"pozitif/negatif" adlandırması ekipten ekibe TERS kullanılıyor — bu pakette terim ikilisi yukarıdakidir.

🔴 **Ve bu dersin KENDİSİ bir kez ihlal edildi (v0.20'de yakalandı, dürüstlük kaydı):** çıkış
sınavının ② kontrolü v0.16 kapı konsolidasyonundan (20→6) beri var-olmayan kapı dosyalarını
çağırıyordu; `node <olmayan-dosya>` MODULE_NOT_FOUND ile exit 1 döndürüyor, sınav bunu "kapı
YAKALADI" okuyup **PASS** veriyordu. Yani "kurulu ≠ çalışıyor" dersini zorlayan kontrolün kendisi
o hataya düşmüştü ve iki birim testi hatayı DOĞRU sanıp sabitlemişti. Ders: **çöküş, yakalama
değildir** — bir kontrol "beklenen exit ≠ 0" derken çıkış kodunun NEDEN sıfır-dışı olduğunu da
ayırt etmelidir. Regresyon nöbetçisi: `tests/install-exam.test.mjs` "sahte-PASS regresyonu".

---

## 3. `mock_depth` deliği — doğrulama zincirinin sessiz yalanı

**Bulgu (AI/prompt kod sınıfında):** Bir mock guard erken-return yapıyor → test **yeşil**, kod-anchor
**gerçek**, ama asıl davranış **hiç koşmuyor**. Sistem "davranış-anchor'ı doluysa doğrulanmış say"
kuralını kullanıyordu; bu kural bu sınıfta **sistematik olarak yalan söylüyordu.** Test dosyası
gerçekten var, anchor gerçek bir sembole işaret ediyor, ama test o davranışa hiç ulaşmıyor.

**Neden bu skill'in çözemeyeceği bir sınıf:** Bu E2 (yorum/insan-disiplin) problemidir, kapı (E0)
değil. Bir kapı bir alanın *dolu* olduğunu görebilir, *doğru* olduğunu **göremez** — geliştirici
"gerçek" yazar, kapı memnun geçer, delik durur. Deliği kod katmanından şablon/iddia katmanına
taşımak deliği kapatmaz, sadece "kontrol ediliyor" görüntüsü ekler. **Yanlış güven, deliğin
kendisinden daha tehlikelidir.**

**Dürüst iki katmanlı savunma (kurulacaksa):**
- **E0 heuristik (ucuz, kanıt DEĞİL):** iddia edilen davranış-anchor'ının işaret ettiği test
  dosyasında Mock/Substitute/Fake/Stub deseni var mı? Varsa + "gerçek davranış" iddiası varsa →
  🟠 çelişki UYARISI (bloklamaz, sadece işaretler).
- **E2 hakem (kanonik):** derinlik iddiasını yalnız hakem (ayrı, salt-okur ajan) doğrulayabilir.
  Kapı doğrulayamaz — bu açıkça `[E2 — hakem doğrular, kapı doğrulayamaz]` diye etiketlenmeli,
  otomatik zorlandığı izlenimi verilmemeli.

> Bu, `test-gaming`'in yakalanmayan akrabasıdır: kimse testi bozmadı — test zaten baştan boşluğa
> koşuyordu. Kanıt-zorunlu doğrulamanın bilinen ilk zayıflığı.

---

## 3b. Yanlış-kanıt deliği — "anchor VAR" ile "anchor DOĞRU" (pilot-web, 2026-08-04)

**Bulgu (v0.17 skill'i pilot-web'e kurulduktan sonra, hedef-repo geri bildirimi):** Bir `[T]`
`ai-analytics` davranışını iddia ediyordu; `test_anchors` DOLU, anchor GERÇEK bir sembole çözülüyor,
test YEŞİL — ama anchor'lanan test **generic bir guard testiydi**, o spesifik gate'in kanıtı değil.
Kapıların hepsini geçti. `mock_depth` deliğinin kardeşi: orada test davranışa ULAŞMIYORDU, burada
test **BAŞKA BİR DAVRANIŞI** kanıtlıyor. İkisinde de alan dolu, sinyal yeşil, kanıt YOK.

**Neden doluluk kapısı göremedi:** `hasTestAnchors()` (gates/lib/mini-yaml.mjs) alanın DOLU olduğunu
sorar; `behavior` metni ile `anchor` sembolünün birbirini tutup tutmadığını sormaz. Doluluk ile
uyum ayrı sorulardır — ilki E0, ikincisi E2.

**Savunma — E0 DENENDİ ve ÖLÇÜMLE ÇÜRÜTÜLDÜ, tek katman kaldı (v0.17.1):**
- **E0 karşı-sinyal — GERİ ÇEKİLDİ.** `--rule=behavior-anchor-fit` yazıldı: `behavior` token'ları
  ile `anchor` sembol/dosya token'ları hiç kesişmiyorsa uyarı. Fikir SELF-REPORT ENFORCEMENT
  YASASI'na uyuyordu, ama **ölçüm çürüttü: 12 gerçekçi + DOĞRU anchor'lanmış çiftte 11 yanlış-pozitif
  (%92).** Kapı semantik uyumu değil **TR/EN dil özdeşliğini** ölçüyordu — `"Şifre en az 8 karakter
  olmalıdır"` ↔ `api:src/auth/password.spec.ts#requiresMinLength` anchor'ı DOĞRUDUR, kapı yine de
  bağırıyordu. Aynı-dil çiftleri hep temiz geçiyordu; yakaladığı "kusur" dil farkıydı.
  → SB-8-rev emsali uygulandı ("yanlış-alarm kapıyı öldürür — ALTIN KURAL"), alt-kural SİLİNDİ.
- **E2 hakem (TEK ve KANONİK savunma):** uyumu yalnız hakem doğrular (`.claude/agents/hakem.md`
  md.3b) — anchor'ı açar, iddiayı okur, generic mi spesifik mi karar verir. **Bu sınıfın kapısı
  YOKTUR; hakem atlarsa savunma da yoktur.** Dürüstlük gereği böyle yazıldı, "kontrol ediliyor"
  görüntüsü verilmedi.

> 🔴 **İKİNCİ DERS — ölçmeden kapı yazma yasağı ikinci kez ihlal edildi.** SB-8-rev (2026-07-27)
> tam bu gerekçeyle bir kapıyı YAZMAMIŞTI; K29 aynı emsali 8 gün sonra ölçmeden aştı. Birim testler
> yeşildi (6/6) çünkü FP'yi tetikleyen tek koşulu — dil ayrımını — hiç denemiyorlardı. Mutlu-yol +
> tek negatif vaka "yanlış-pozitif yok" KANITI DEĞİLDİR. Yeni kapı/alt-kural için gerçekçi bir
> DOĞRU-vaka korpusunda FP ölçümü zorunlu adımdır (bkz. `docs/FRICTION_LOG.md`).

> ⚠️ **Bu vakanın asıl dersi teşhiste:** hedef repo bunu "skill'in jenerik kör noktası" diye
> raporladı; oysa sınır §3'te ZATEN belgeliydi ve `[E2 — hakem doğrular, kapı doğrulayamaz]` diye
> etiketlenmişti. Kör nokta DEĞİL, **etiketlenmiş sınırdı.** Fark kritik: kör nokta kapatılır,
> sınır kapatıldığı SANILIRSA yanlış güven üretir. Yeni olan tek şey mekanize edilebilir dilimdi
> (token kesişimi) — o alındı, gerisi E2'de bırakıldı.

---

## 4. Şablon kod-sınıfına kördü — profil gerekiyor

**Bulgu:** Tek bir genel doküman/kapı şablonu yetmiyor. **Her kod sınıfı, şablonun hiç sormadığı bir
soru doğurdu:**

| Kod sınıfı | Şablonun sormadığı soru |
|---|---|
| **UI ekranı** | Çıktı bir yanıt değil, bir **navigasyon** — ve o navigasyon genelde tekrar bir
  middleware'den geçer. Navigasyon hedefi çoğu zaman derleyiciden/tip-sisteminden **kaçar** (serbest
  string), yani kırık bir hedef sessizce prod'a çıkabilir. |
| **Webhook/async** | Bir ack/200 döndükten **sonraki** çökme çağıran taraftan **gizlidir**;
  kurtarma zincirinin her halkasının kendi filtresi vardır → hiçbirine uymayan bir **"yetim durum"**
  doğar. |
| **AI/prompt** | Mock guard erken-return → test yeşil, davranış koşmuyor (§3). |

**Genel ders:** bir doküman/kapı şablonu tasarlarken "API/komut" varsayılan profili yeterli sanmak
yaygın bir kördür. Kod tabanında UI-ağırlıklı, webhook-ağırlıklı veya AI/prompt-ağırlıklı yüzeyler
varsa, şablona **profil-bazlı ek alan bloğu** (ortak çekirdek + sınıfa özel ek, opsiyonel/silinebilir)
eklemek gerekir — sabit tek şema değil.

---

## 5. ⭐ Sürpriz getiri — doküman altyapısı bir bug avcısıdır

**Bulgu (planın hiç öngörmediği):** Doküman ↔ kod karşılaştırması, testlerin ve tip sisteminin
yakalayamadığı ciddi hataları da ortaya çıkarabilir.

**Ortak desen:** hiçbiri bir hata/yanıt üretmiyordu. Bir değer sessizce kayboluyor, bir buton
sessizce görünmüyor, bir işlem sessizce düşürülüyor — test yeşil, tip temiz, monitoring sakin.

**Neden adversarial doküman denetimi bunu buldu, test etmedi:** Test "beklediğim çıktı geldi mi?"
sorar (kendi varsayımını doğrular). Doküman-üretici ajan "bu kod ne YAPAR?" sorar (kodu anlamaya
çalışır, ondan bağımsız bir zihinsel model kurar) — ikincisi sessiz başarısızlığı görür, çünkü
beklenti kod ile aynı kaynaktan gelmiyor.

**Ne demeye getirir:** teknik doküman backfill'i (mevcut kodu geriye dönük dokümante etmek) yalnız
doküman üretmez — **kod tabanını denetler**. Bu bir yan ürün ama ölçülüp raporlanmazsa
görünmez kalır. **Ölçülmeyen fayda satılamayan faydadır.**

**Kurulum çıktısına pratik yansıması:** kâşif/backfill taraması sırasında bulunan yan-bulgular
sayılsın ve sınıflansın (para-kaybı / veri-kaybı / güvenlik / kozmetik) → takip dosyasına (STATE
veya eşdeğeri) tek satırlık bir "bug-avcısı" özeti yazılsın. Karar kapısında "bu ne kazandırdı"
sorusuna somut bir sayı gerekir, sezgi yetmez.

---

## 6. Eval dersi — "çöp girdi, çöp çıktı" bir defekt değil, sadakat kanıtıdır

**Bulgu:** Bir son-kullanıcı-dokümanı üreteci değerlendirildiğinde (gerçek sorularla eval), ortaya
çıkan boşlukların **hepsi** beslendiği kaynak dokümanın (teknik doküman) eksiklerine geri izlendi.
Üreteç boşluğu **halüsinasyonla doldurmadı** — kaynağın yoksulluğunu **dürüstçe** çıktıya taşıdı.

**Neden bu bir defekt değil kanıt:** Eğer üreteç kaynakta olmayan bir bilgiyi (bir sabit, bir
yokluk iddiası, bir kapsam sınırı) kendiliğinden icat etmiş olsaydı, bu ciddi bir halüsinasyon
riski olurdu. Bunun yerine üreteç, kaynağın eksikliğini görünür bıraktı; kaynak zenginleştirilince
çıktı **otomatik** düzelir. Mimari sağlam çalışıyor demektir — eksik olan besleme.

**Genel ders:** bir üretim zincirinin (kaynak → dönüştürücü → çıktı) kalitesini değerlendirirken
"çıktı zayıf" bulgusu tek başına üreteci suçlamaz. Önce sor: bu zayıflık kaynağa mı, dönüştürücüye
mi ait? Sadık bir üreteç kaynağın yoksulluğunu **taşır**, örtmez. Bu ayrımı yapmadan üreteci "düzeltmeye"
çalışmak, gerçek kök nedeni (kaynak boşluğu) hiç görmeden semptomu kovalamaktır.

**Ek panzehir — abstain mekanizması:** aynı eval'de, üreteç kapsam dışı iki soruda **uydurmadı,
sustu** ("bu konuda emin değilim" + yönlendirme). Bu, bir üretim zincirinin halüsinasyon korumasının
gerçek kanıtıdır — tasarım iddiası değil, ölçüm. Bir kurulumda üreteç/hakem zinciri kurarken abstain
yolunun gerçekten çalıştığını (kapsam-dışı sorguda susuyor mu) ayrı bir eval kalemi olarak doğrulamak
gerekir; "susma" davranışını varsaymak yetmez.

---

## 7. Özet — bu derslerin bu skill'e ne öğrettiği

| Ders | Bu skill'de karşılığı |
|---|---|
| Kurulu ≠ çalışıyor | Kapı ETKİ oranı + yakıt kapsamı metriği — FAZ 5 çıkış sınavı VARLIK değil ETKİ ölçer |
| Ölçü de oyunlanabilir | Çıkış sınavına en az bir negatif-kontrol kalemi (sentetik ihlal → kapı yakalıyor mu) |
| `mock_depth` deliği | Derinlik/gerçeklik iddiaları E0 heuristik (uyarı) + E2 hakem (kanonik) diye dürüstçe ayrılır |
| Yanlış-kanıt deliği (§3b) | "anchor VAR ≠ anchor DOĞRU" — E0 kapısı DENENDİ, %92 FP ile geri çekildi; tek savunma hakem md.3b (E2) |
| Ölçmeden kapı yazma (§3b) | FP ölçümü olmadan kapı yazılmaz — birim test yeşilliği FP kanıtı değildir (SB-8-rev + K29, 2 tekrar) |
| Uygulayan ≠ doğrulayan | Mekanik zorlama (ayrı ajan, Edit/Write yetkisi yok) — disiplin değil, araç kısıtı |
| Şablona kördü | Doküman/kapı şablonları kod-sınıfına göre opsiyonel profil bloklarıyla genişler |
| Bug-avcısı sürprizi | Backfill taramasının yan-bulguları sayılır, sınıflanır, takip dosyasına M9-türü bir satır olarak yazılır |
| Eval dersi | Zayıf çıktı önce kaynağa mı dönüştürücüye mi ait diye ayrıştırılır; abstain yolu ayrı doğrulanır |

---

## 8. Hata sınıflandırması — yaşayan tablo (v0.18.2, pilot)

> Bu tablo YAŞAYANdır: yeni bir hata sınıfı gerçekten ÖLÇÜLDÜĞÜNDE eklenir, bir sınıfın kapısı/testi
> artık hiç ateşlemiyorsa (ölü invariant) budanır. Budama kuralı deseni `templates/trackers.template.md`
> (GUARDS.md bölümü, "budama yasası" — FP oranı yüksek VEYA invariant öldü) buradan ödünç alınmıştır.
> 🔴 **Yalnızca gerçekten ölçülmüş sınıflar yazılır.** pilotnda H1-H8 diye bir çalışma
> tablosu tutuldu ve tur içinde büyüdü (H8 turun ortasında eklendi); bu oturumda ana ajana YALNIZ H8
> aktarıldı. H1-H7 uydurulmadı, hiç ANA AJANA taşınmadı — bu yüzden burada yoklar.

| Sınıf | Ne | Nasıl yakalanır | Pilot kanıtı |
|---|---|---|---|
| H8 | Ajanın bir API imzasını/lambda'yı **kodu okumadan hafızadan yazması** (varsayılan/eski imza uydurma) | Uygulayıcı çıktısındaki dış-çağrı/imza satırını ilgili tanım dosyasıyla karşılaştır; eşleşmiyorsa H8. Hakem'in "iddiayı koda karşı doğrula" adımı bu sınıfı yakalar. | pilot, tur ortası (2026-08-06): ajan bir lambda'nın imzasını hafızadan yazdı, gerçek tanımla uyuşmuyordu. |

🔴 **Etiket (dogfood dürüstlüğü):** bu tablo ve RED'i reddetme kuralı **TARİF'tir, kapı KODU
DEĞİL** — hiçbir kapı H-sınıflarını zorlamaz. Gerekçe: "bir bulgu H8 mi" yargısı bulanık
invariant'tır (E0'a inmez, doctrine "tarif/kapı sınırı"). Zorlayıcısı Hakem'dir (E2): hakem
uygulayıcının imza/çağrı iddialarını koda karşı doğrular. Tablonun işlevi kapı değil ORTAK DİL —
tekrar eden hatayı adlandırır ki ikinci kez tartışılmasın.

**RED'i reddetme kuralı** bu tabloyla aynı pilottan çıktı — tekrar yazılmaz, bkz.
`reference/faz4-roller-surec.md` "[toggle: dış-model]" bölümü ve `templates/roles.template.md`
hakem md.10.

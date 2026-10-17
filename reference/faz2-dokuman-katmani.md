# Faz 2 Doküman Katmanı — [T]/[L0] Şeması

> Kuran ajanın el kitabı (E1-lazy: yalnız "müşteriye doküman/chatbot sunan biri var mı?" muhatap
> toggle'ı (SKILL.md ADIM 0) AÇIKKEN okunur — kapalıysa bu katmanın tek satırı bile kurulmaz).
> **Taşıyıcı fikir:** bu iki dosya sınıfı ([T] teknik doküman, [L0] son-kullanıcı dokümanı) iki
> farklı SAAT'te yaşar ve bu ayrım tesadüfi değil — kod-yanında-senkron olanla müşteriye-görünür-
> asenkron olan aynı zorlama halkasına bağlanırsa ya kod çok yavaşlar ya doküman çok riskli hızlanır.

---

## 1. İki dosya sınıfı, iki saat

| Sınıf | Yer | Saat | Kim yazar | Kim zorlar |
|---|---|---|---|---|
| **[T] teknik doküman** | kodun yanında (`docs/tech/…`), dağıtık | **SENKRON** — kodla AYNI commit'te | kodu değiştiren geliştirici / geriye-dönük backfill ajanı | co-commit kapısı (FAZ 2, ④ halkalardan ②-③) BLOKE EDER |
| **[L0] son-kullanıcı dokümanı** | kontrol düzlemi (merkezî docs deposu) | **ASENKRON** — sinyal → öner → İNSAN onaylar → yayın | üretici ajan [T]'den TASLAK üretir, asla doğrudan değiştirmez | öneri kuyruğu, insan onay kapısı |

**Neden bu ayrım taşıyıcı:** [T] kodun doğruluğunu garanti etmesi gereken bir sözleşmedir — kod
değişip [T] değişmezse commit'i bloke etmek ucuzdur ve doğrudur (co-commit halkası zaten var,
bkz. SKILL.md FAZ 2 aşama A). [L0] ise müşterinin gördüğü metindir — burada YANLIŞ hızlı yayın,
DOĞRU yavaş yayından daha pahalıdır (destek bileti, güven kaybı). Aynı zorlama halkasına
bağlamak ikisinden birini yanlış hizaya sokar: [T]'yi asenkron yaparsan kod driftini yakalayamazsın,
[L0]'ı senkron/otomatik-yayın yaparsan doğrulanmamış içerik doğrudan müşteriye gider.

---

## 2. Anchor = `repo:symbol` — çıplak sembol JOIN'i YASAK

Bir [T]/[L0]'ın koda bağı **çıplak sembol adıyla değil**, `repo:symbol` biçiminde bir anchor'la
kurulur (örn. `pilot-backend:LoginCommandHandler`, genelde `<repo>:<Symbol>` kalıbı).

**Neden:** aynı isimli bir sınıf/fonksiyon birden çok repoda farklı bir implementasyona
karşılık gelebilir (çok-repo/çok-servis bir ortamda `NotificationService` adında kaç tane
bağımsız sınıf olduğunu düşün). Yalnız sembol adıyla JOIN yapan bir doküman/kapı, yanlış
repodaki yanlış sembole demirlenmiş olur — sessizce, çünkü isim eşleşmesi yanlış-pozitif bir
"başarı" görüntüsü verir. `repo:symbol` bu belirsizliği kökten keser: anchor'ın işaret ettiği
şey deterministik olarak tek bir yere çözülür.

Bu kural yalnız kod-anchor'ları için değil, davranış-doğrulayan test-anchor'ları ve
koddan-çıkarılan-sabit anchor'ları için de geçerlidir — her biri aynı `repo:symbol` disiplinine
tabidir.

---

## 3. Kimlik ayrımı — KOD kimliği ≠ GÖREV kimliği ≠ REGISTRY

Bu şemanın en derin (ve en kolay yanlış kurulan) ayrımı şudur:

```
KOD kimliği   = anchor (repo:symbol)   ← CI/derleme TÜRETİR, DETERMİNİSTİK
GÖREV kimliği = feature_id             ← İNSAN kararı, KULLANICININ DİLİYLE mint edilir
REGISTRY      = ikisi arasındaki JOIN  ← gruplamanın SAHİBİ, kanonik kaynak
```

**Neden bu ayrım gerekli — kök hata:** Bir [T] doğal olarak kod terimleriyle isimlenmeye eğilimlidir
(geliştirici bir ekran için [T] yazarken `giris-ekrani` gibi bir isim düşünür — kodun yanında,
kod diliyle). Ama kullanıcının gerçek görevi (`sifre-sifirlama`) genelde birden çok koda YAYILIR:
bir ekran + bir rota + bir e-posta servisi + bir token doğrulama. İki [T] aynı işin iki yüzü olabilir
ama farklı isimler taşırsa, "bu görevi hangi [T]'ler besliyor" sorusu **cevaplanamaz** hale gelir —
[L0] üreteci hangi teknik dokümanları okuyacağını bilemez.

**Sonuç kural:** `feature_id` bir [T]'ye SAHİPLENDİRİLMEZ (birincil anahtar değildir). [T]'nin
kimliği anchor'dır (deterministik, CI türetir). `feature_id` bir görev kimliğidir — insan tarafından,
kullanıcının arama diliyle mint edilir. Registry ikisi arasındaki JOIN'i tutar ve bu JOIN'in
kanonik kaynağıdır (bir [T]'nin `feature_ids` alanı ÇOĞUL ve bir İDDİA'dır; kanonik liste
registry'dedir — kapı çift-yönlü tutarlılığı denetler).

**Test:** *"Kullanıcı bunu arar mı?"* Cevap evetse `feature_id` görev-şeklindedir (✅
`sifre-sifirlama`); cevap hayırsa kod-şeklindedir (❌ `giris-ekrani`, `LoginCommandHandler`) ve
yanlış katmandadır.

**Merkezi atama kuralı — paralel üretimde `feature_id` ajana BIRAKILMAZ:** `feature_id` gibi
global-benzersiz kimlikler, aynı anda çalışan paralel seed-kasif/dokuman-uretici ajanlarına
kendi kendine ürettirilmez — orkestratör dalgayı başlatırken bu kimlikleri BAŞTAN dağıtır ve her
ajanın brifine yazar. **Neden:** paralel ajanlar birbirlerini GÖRMEZ; her biri kendi id'sini
üretmeye bırakılırsa (örn. sıra numarası vermeye çalışırsa) aynı varsayılan değere ("ilk kayıt
benim") çakışarak düşerler. Somut kanıt: bir pilot turunda 18 ayrı [T] üretici ajanının hepsi
kendi kaydını "ilk-001" varsaydı, çünkü hiçbiri diğerinin ne ürettiğini bilmiyordu — merkezi
atama olmadan bu körlük kaçınılmazdı. Registry §JOIN kuralı (yukarıda) kimin id'yi MINT ettiğini
tanımlar (insan); bu kural NE ZAMAN dağıtıldığını tanımlar (paralel dalga başlamadan önce, ajanlar
çalışmaya başlamadan).

---

## 4. ⭐ 1 feature_id = 1 CEVAP KÜMESİ — alias'lar cevap-sınırlı, konu-komşu DEĞİL

Bir retrieval/arama katmanı (chatbot, arama kutusu, destek-intake sınıflandırması) bir
`feature_id`'yi arama sorgularıyla (alias'lar) eşleştirir. Burada sık yapılan hata: alias'ları
**konu yakınlığına** göre eklemek.

**Somut örnek nereden yanlış gider:** "giriş yapamıyorum" sorgusu bir `sifre-sifirlama`
makalesine alias olarak eklenirse, retrieval bu sorguyu o makaleye çeker. Ama "giremiyorum"
onlarca farklı kök nedene işaret edebilir (yanlış şifre, SSO sorunu, hesap askıda, oturum
hatası…) — şifre sıfırlama makalesi bunların hiçbirini kapsamaz. Sonuç: retrieval doğru
sorguyu **yanlış cevap kümesine** çeker, üretici ajan boşluğu doldurmaya (halüsinasyona) itilir.

**Kural:** bir `feature_id`, tam olarak bir cevap kümesini temsil eder. İki sorgu farklı cevap
gerektiriyorsa, farklı `feature_id`'lerdir — konu komşuluğu yeterli sebep değildir:

```
"nasıl sıfırlarım"   → sifre-sifirlama
"neden giremiyorum"  → giris-sorunlari     ← AYRI feature (farklı cevap kümesi)
```

**Test:** *"Bu sorgu bu makaleyle CEVAPLANIR mı?"* Hayırsa bu sorgu alias DEĞİLDİR — negatif
sorgu listesine (bu makalenin KAPSAMADIĞI sorgular) yazılmalıdır. Negatif sorgu listesi retrieval
halüsinasyonunun ana panzehirlerinden biridir: makale konuya yakın ama cevap vermiyorsa,
sistem "insana yükselt/başka makaleye yönlendir" der, uydurmaz.

---

## 5. coverage kapısı — besleyen [T] eksikse [L0] ÜRETİLMEZ

Bir görevi besleyen teknik dokümanlardan (registry'de o `feature_id` altında listelenen [T]'ler)
biri eksikse veya doğrulanmamışsa, o görevin son-kullanıcı dokümanı **üretilmemelidir.**

**Neden:** [L0] üreteci [T]'lerden taslak çıkarır. Besleyen [T] hiç yoksa, üreteç ya boş bırakır
ya da (daha tehlikelisi) makul görünen ama kanıtsız bir metin üretir — bu, retrieval-zamanı değil
**üretim-zamanı** bir halüsinasyon riskidir (aynı ilkenin generation tarafına uygulanması: bir
retrieval sisteminin "kapsam-dışı sorguda abstain et" davranışının üretim-zamanı ikizi).

**Mekanizma (deterministik, E0):** bir [L0] ancak registry'deki `feature_id → tech_docs` eşlemesinin
TAMAMI (a) mevcut VE (b) doğrulanmış durumdaysa üretilebilir. Eksik varsa: üretme, eksikliği bir
"coverage gap" olarak kaydet, önce eksik [T]'yi tamamlamayı kuyruğa yaz. Registry'de "bu rota henüz
yok" türü bir not, aslında "[L0] henüz YAZILAMAZ" demenin bir yoludur — kurulum bunu bir sinyal
olarak okumalı, göz ardı edilecek bir eksiklik notu olarak değil.

---

## 6. abstain — bilmediğinde SUS + "şuraya bak"

Bir üretici/retrieval zinciri bir soruyu cevaplayamıyorsa (kapsam dışı, veya kaynak yetersiz),
doğru davranış **sessizce durmak** değil, **açıkça abstain etmek**tir: "bu konuda emin değilim" +
mümkünse bir yönlendirme (ilgili başka bir `feature_id`'ye, veya bir insan/destek kanalına).

**İki alt-kural:**

1. **Yokluk iddiası kanıt ister kadar iddia gerektirir.** Bir [L0] hiçbir zaman bir özelliğin
   YOK olduğunu ima edemez, [T] tarafında o yokluk açıkça doğrulanmadıkça (negatif kanıt — "bu
   endpoint kodda yok" gibi somut, anchor'lı bir kayıt). "X yapamazsınız" demek, "X yapabilirsiniz"
   demek kadar kanıt ister. Doğrulanmamış durumda [L0] `bilinmiyor` der, kesinlik üretmez.
   Bir üreteç kaynakta olmayan bir yokluğu **çıkarımla** doldurursa (kod susuyor diye "yok"
   sonucuna varırsa), bu yanlış kesinlik üretir — kaynağın susması "yok" anlamına gelmez.
2. **Abstain'in bir çıkışı olmalı.** Sadece "bilmiyorum" demek kullanıcıyı boşta bırakır. Negatif
   sorgu listesindeki (§4) her sorgu, mümkünse ilgili bir `feature_id`'ye yönlendirilmelidir
   ("bu soruyu ben cevaplayamam ama şuraya bak"). Abstain mekanizmasının kendisinin çalışıp
   çalışmadığı (gerçekten susuyor mu, gerçekten yönlendiriyor mu) ayrı bir eval kalemi olarak
   doğrulanmalıdır — davranışı varsaymak yetmez (bkz. `reference/pilot-dersleri.md` §6).

---

## 7. Bu katmanın diğer skill kavramlarıyla ilişkisi

- **Kapı taksonomisi (doctrine §"VARLIK ≠ KALİTE"):** coverage kapısı ve registry-join kapısı
  VARLIK/tripwire sınıfındadır — bir alanın dolu/tutarlı olduğunu doğrular, İÇERİĞİN doğru
  olduğunu doğrulamaz. Granülerlik/isimlendirme kalitesi (bir `feature_id` gerçekten görev-şeklinde
  mi, cevap kümesi doğru mu bölünmüş) E2'dir — hakem/insan işi, kapıya sızdırılmamalıdır. Yeşil
  bir registry-join kapısı "registry TUTARLI" demektir, "registry DOĞRU" demek değildir.
- **Registry yaşam döngüsü — kim doldurur:** bir gruplama önerisi (hangi semboller hangi göreve
  hizmet ediyor) bir ajan tarafından ÖNERİLEBİLİR ve başka bir ajan tarafından ÇÜRÜTÜLEBİLİR
  (uygulayan ≠ doğrulayan ilkesi burada da geçerli), ama `feature_id` MINT ETMEK (isim + sınır
  koymak) editoryal/ürün kararıdır — makine bunu veremez, İNSAN onayı şarttır.
- **Bayatlama sınıfları (doctrine §"Doküman bayatlamasının 3 sınıfı"):** [T]'nin anchor'ları A/B
  sınıfı bayatlamaya (ölü referans / sahipsiz güncelleme) doc-truth + doc-recency ile karşı
  konur. [L0]'ın "içerik hâlâ doğru mu" sorusu C sınıfıdır (bulanık, E0'a inmez) — insan/hakem
  gözden geçirme tarihiyle (last-reviewed türü bir alan) takip edilir, makineyle garanti edilmez.

## 8. Test-köprüsü — [T] → test-case (dış test/QA sistemine teslim)

> [toggle: test-köprüsü] Bir dış test/QA ekosistemi (Fibery/Jira/TestRail + test-case-writer skill'i)
> VARSA ve [T] katmanı kuruluysa açılır; yoksa HİÇ kurulmaz (kullanmayan ödemez). Tasarım 4 bağımsız
> dış-model danışmasının sentezidir (Codex/GPT-5.6/GLM-5.2/Kimi, 2026-07-21).

**Sorun:** Kod-geliştirme tarafı [T] teknik doküman üretir (akış + hata-sözlüğü + behavior + risk_sinifi).
Test ekibi ayrı bir sistemde test-case ister (yüzey/modül/adım/beklenen-sonuç + edge + regresyon).
İki uç hazır, arada köprü yok → her iş sonunda test-case elle yazılır (unutulur ya da eksik olur).

**Çözüm — ara-artefakt + öner-onayla (asla doğrudan dış-sisteme yazma):**
```
KOD + unit test → [T] (senkron) → ★ kod-onayı → KÖPRÜ → test-brief.yaml → onay → outbox → dış test-sistemi
```
Köprünün çıktısı `templates/test-brief.template.yaml` şemasıdır. Kanonik kurallar:

- **Deterministik KAPI + üretken TARİF karışımı (4/4):** kapı *kapsamın kapandığını* zorlar (7-alan
  çözüldü mü, edge 3-ekseni dolduruldu mu, her satır bir [T]-anchor'a demirli mi); *içeriği* (adım
  metni, beklenen-sonuç ifadesi) üretken ajan yazar. İçeriği kapıya zorlamak yanlış — kapsamı zorla.
- **Tetikleme (4/4): kod-onayından SONRA taslak, dış-sisteme yayın DAHA SONRA.** Ayrım kritik —
  test-brief PR'da erken üretilir ki QA kod-onayını beklemeden inceleyebilsin; ama dış test-sistemine
  YAYIN kod-onayı + QA onayı sonrası (`status: approved`). "Kod-onayından önce ÜRETME" değil, "önce
  ÜRET, geç YAYINLA". Ön-koşul: [T].verification `dogrulandi` olmadan brief yayınlanmaz.
- **Mekanik vs hakem (edge-case, 4/4):** [T]'den MEKANİK türer → sıfır-veri (required alanların
  boşluğu), akış-kesintisi (hata-sözlüğündeki timeout/5xx), yetkisiz (risk_sinifi=güvenlik ise 401/403).
  HAKEME kalır → yetkisizin *dolaylı* yolları, sıfır-verinin *anlamlılığı*, V1/V2 nesil-eşli seçimi,
  UI/API kapsam yeterliliği. 3 eksen TEMPLATE olarak zorunlu; içeriği ajan+QA doldurur.
- **🔴 Fail-closed (4/4):** Kaynağı ([T]-anchor) olmayan alan ASLA doldurulmaz. Registry'den çözülemeyen
  7-alan (özellikle dış-sistemde schema-required olanlar) → `UNKNOWN`, `unresolved`'a eklenir, yayın BLOKE.
  "Eksik ama güven verici" test-case bu ekosistemin EN BÜYÜK riskidir (4/4 aynı teşhis).
- **🔴 Semantik-drift kontrolü (GLM-5.2):** [T] kodla senkron olsa bile YANLIŞ belgelenmiş olabilir
  (kod 400 döner, [T] "404" yazar — ikisi de aynı commit'te dokunulduğu için kapıları geçer). Köprü
  bunu yakalamak için [T].expected'ı unit-test assertion'larıyla ÇAPRAZ denetler; uyuşmazsa o beklenen-
  sonuç `confidence: low` + `needs_review` alır, sessizce test-case'e geçmez. Bu, `check-provenance
  --rule=brief-provenance` kapısının işidir (VARLIK sınıfı — *çapraz-kaynağın varlığını* zorlar, doğruluğu hakeme bırakır).
- **Client ↔ surface JOIN (GPT-5.6):** dış test-case'in "yüzey/panel" alanı (hangi client) [L0].applies.panel
  ile registry üzerinden eşlenir. Bu eşleme yanlışsa mobil için web senaryosu üretilir → registry
  surface eşlemesi köprünün join anahtarıdır, yanlışsa `UNKNOWN`.
- **Öner-onayla katmanı:** brief PR artefaktıdır, insan/reviewer onaylar (`status: approved`). Onaydan
  SONRA ayrı bir outbox job'u dış-sisteme idempotent yazar (SHA + [T]-anchor + feature_id damgalı;
  yazım başarısız olursa brief KAYBOLMAZ — retry/audit). Para/veri/güvenlik riskinde insan onayı zorunlu.
- **Metrik (Kimi):** `cases_needs_review / cases_generated` oranı köprünün sağlığıdır — yüksekse [T]
  eksik ya da köprü zayıf. Üretilen case'lerin gerçekte bulduğu bug oranı da izlenir (köprü işe yarıyor mu).

**Kritik sınır (4/4 uyarısı):** Köprü [T]'nin *varlığını/senkronunu* garanti eder, *iş-doğruluğunu* DEĞİL.
[T] doğrulandı diye test-case iş açısından doğrudur denemez — dış-sisteme gidişten önce yüzey-eşleşmesi
ve kapsam-yeterliliği için ayrı bir HAKEM (dokuman-hakem ya da QA-reviewer) gerekir.

---

## 9. Toggle açıksa kurulumda `--cascade` bağlanır (v0.30)

`son_kullanici_dokumani` toggle'ı AÇIKSA kurulum ajanı doc-recency'yi **kademeli** (`--cascade`: kod → [T] → [L0]) bağlar:
- pre-commit hook'una `check-doc-integrity --rule=doc-recency --cascade` satırı eklenir (`GATES_RING=pre-commit` zaten hook şablonunda export edilir);
- CI şablonunda `{{CASCADE_BAYRAGI}}` = `--cascade` doldurulur (kapalıysa boş).
Bayraksız doc-recency yalnız `doc-anchor:` yorumlarını izler; [T]/[L0] zinciri bayatlasa da sessiz kalır. Toggle kapalıysa ikisine de TEK satır eklenmez.

<!--
ÜRETİM TALİMATI (bu blok kopyalanmaz):
- Ne zaman kurulur: FAZ 3'te, DESIGN.md ile BİRLİKTE, UI-ağır repo tespit edildiğinde ([ORTA+]
  toggle veya kullanıcı beyanı). Amaç: "önce ekran, sonra altyapı" gerilimini FAZ SIRASIYLA değil
  SÖZLEŞMEYLE çözmek — dış araştırma (6 model + spec-driven development endüstri pratiği,
  2026-07-28): UI ayrı bir FAZ değil, akış+kabul-kriteri sözleşmesinin İÇİNDE yaşar.
- Nereye yazılır: docs/flows/<akis-adi>.md (her kritik akış ayrı dosya) VEYA tek dosyada
  docs/flows.md (KÜÇÜK/ORTA repo, 3-7 akış). Büyüklüğe göre seç, ikisini birden kurma.
- SIRALAMA: bu dosya docs/screens.md'DEN ÖNCE doldurulur — ekran envanteri akıştan TÜRETİLİR,
  tersi değil (dış araştırma, user-flow-first bulgusu).
- Pixel-perfect wireframe ZORUNLU DEĞİL — akış metinle (adım+ekran adı+durum) tarif edilir.
  Ajan için değerli olan görsel değil YAPISAL: adım sırası, durum geçişleri, kabul kriteri.
- {{...}} alanları kullanıcıyla birlikte doldurulur (ajan icat etmez — kimlik ihlali riski,
  dış araştırma: "her projenin UI ihtiyacı farklıdır, paket bunu bilemez").
-->
# Kritik kullanıcı akışları — {{REPO_ADI}}

**Kaynak:** {{PRD | kullanıcı görüşmesi | mevcut ekranlardan çıkarım}}

## Akış: {{AKIS_ADI}}

**Kim:** {{KULLANICI_ROLU}}
**Ne için:** {{TEK_CUMLE_AMAC}}

**Adımlar:**
1. {{EKRAN_ADI}} — {{KULLANICI_EYLEMI}} → {{SONUC_DURUMU}}
2. {{EKRAN_ADI}} — {{KULLANICI_EYLEMI}} → {{SONUC_DURUMU}}

**Kabul kriteri (Gherkin, davranış odaklı):**
```
Given {{BASLANGIC_DURUMU}}
When {{EYLEM}}
Then {{BEKLENEN_SONUC}}
```

**Bu akışta hangi ekranlar geçiyor:** {{EKRAN_LISTESI}} — bkz. docs/screens.md

---

<!-- Yeni akış eklerken yukarıdaki bloğu kopyala. 3-7 KRİTİK akış yeterli — her ekran/aksiyonu
     buraya dökmek envanterleşir ve en hızlı çürüyen doküman haline gelir (bilinçli YAPILMAYACAK). -->

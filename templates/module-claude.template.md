<!--
ÜRETİM TALİMATI: [BÜYÜK] seviye. ÖNCE TEK modüle kur (en ağır/en çok dokunulan);
format kendini kanıtlamadan ikincisini açma. Konum: <modül-dizini>/CLAUDE.md
(ajan o dizinde çalışınca otomatik yüklenir). Tavan: 50 satır.
YASAK: kod haritası, dosya envanteri, global kural tekrarı, kod parçacığı.
İçerik = SADECE koddan okunamayan şeyler: tuzaklar, invariantlar, ikizler, tarihçe-nedenleri.
Oluşturma/silme yetkisi: süpervizör. Modül sadeleşirse dosya SİLİNİR.
Tazelik: invariant değiştiren commit bu dosyayı da günceller (Hakem kontrol eder).
ÜRETİM SONRASI: yazdığın her yol/komutu çalıştırarak doğrula (`check-doc-integrity --rule=doc-truth` backtick içindeki yol/komutları assert eder).
-->
<!-- doc-anchor: {{MODUL_KOD_DIZINI}} -->
<!-- ↑ [v0.8.4 opt-in] bu modülün kod dizini; değişip bu dosya dokunulmazsa `check-doc-integrity --rule=doc-recency` uyarır.
     İstemiyorsan bu satırı SİL (anchor yoksa kapı no-op). Birden çok yol: virgülle ayır. -->
# {{MODUL_ADI}} modülü

**Amaç:** {{TEK_CUMLE}}

**Giriş noktaları:** {{2_4_DOSYA_YOLU_VE_NEDEN}}
<!-- ör (BU REPODAN DEĞİL): core/orderState.ts — durum makinesinin tek kapısı -->

**İnvariantlar (bozarsan sistem bozulur):**
- {{INVARIANT_1}}
<!-- ör (BU REPODAN DEĞİL): durum geçişleri SADECE applyTransition üzerinden; iki mod aynı motoru paylaşır -->

**Tuzaklar (ajanların düştüğü yerler):**
- {{TUZAK_1}}
<!-- ör (BU REPODAN DEĞİL): sabiti config/'ten al — şemadaki AYNI İSİMLİ export farklı olabilir -->

**İkiz/komşu uyarıları:**
- {{VARSA: şu dosya/modül paraleldir — birinde fix yapınca diğerini kontrol et}}

**Bu modülün doğrulaması:** `{{MODUL_VERIFY_KOMUTU}}`

**Bilinçli garip görünenler (DÜZELTME, önce DECISIONS.md'ye bak):**
- {{VARSA_KARAR_REFERANSI}}

// Tazelenebilir kaynak kümesinin TEK tanımı (v0.30.2): upgrade.mjs (kaynak çözümü) ve install-doctor.mjs (⑪ sahiplik)
// buradan okur. Küme = paketin `gates/**` ağacı + aşağıdaki AÇIK liste (hedefe birebir kopyalanan yaşam döngüsü araçları).
// Listeye yeni dosya eklemek bilinçli karardır; verify.mjs/docs/**/.github/**/diğer scripts/* ASLA girmez.
export const YASAM_DONGUSU_ARACLARI = ['scripts/install-exam.mjs', 'scripts/install-doctor.mjs', 'scripts/upgrade.mjs', 'scripts/sahiplik.mjs'];

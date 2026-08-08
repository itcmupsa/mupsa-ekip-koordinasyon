# Kararlar — doğrulama senaryoları

Bu senaryolar, `20260808100000_add_event_decisions.sql` migration'ı uygulandıktan
sonra gerçek Supabase projesinde çalıştırılacaktır.

## 1. Karar oluşturma

- Aktif dönem üyesi ve etkinlik sahibi giriş yapar.
- Etkinliğe başlık, karar metni ve tarih girerek karar ekler.
- Beklenen: satır `event_decisions` tablosuna eklenir; karar etkinlik detayında görünür.

## 2. Şeffaf okuma

- Aynı aktif dönemdeki başka bir koordinatör giriş yapar.
- Beklenen: kararı okuyabilir, değiştiremez ve silemez.

## 3. Yetkili düzenleme ve geri alınabilir silme

- Etkinlik sahibi veya `super_admin` karar metnini günceller.
- Ardından kararı silme/pasifleştirme işlemi yapılır.
- Beklenen: değişiklik audit log'a `event_decision` olarak yazılır; karar normal listede görünmez.

## 4. Pasif kararı yeniden aktifleştirme

- Yetkili kullanıcı etkinlik detayında `Pasif kararları göster` seçeneğini açar.
- Pasif kararı bulup `Yeniden aktifleştir` düğmesine basar.
- Beklenen: `deleted_at`, `deleted_by` ve `deletion_note` alanları temizlenir; karar normal listede yeniden görünür ve audit log'a güncelleme olarak yazılır.

## 5. Eski dönem kilidi

- Kararın bağlı olduğu dönem kilitlenir.
- Beklenen: karar ekleme, güncelleme ve silme veritabanı tarafından reddedilir.

## 6. Denetim kaydı

- Oluşturma, güncelleme ve silme işlemleri sonrası `audit_logs` kontrol edilir.
- Beklenen: `entity_type = 'event_decision'`, doğru `entity_id`, aktör ve işlem türü bulunur.

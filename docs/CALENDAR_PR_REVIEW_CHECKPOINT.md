# Takvimler ve PR sürümü — 11 Eylül 2026

Kullanıcı, Terra ajanlarının kullanım sınırına ulaşmasından sonra ana asistana geliştirmeyi tamamlama yetkisi verdi. Ajanların değişiklikleri tamamlandı ve gözden geçirildi.

- Geliştirme dalı: `feature/calendar-hub-pr-weekly-20260911`
- Geri dönüş dalı: `backup/before-calendar-hub-20260911`
- Başlangıç: `dd84f09`

## Kapsam

Takvimler girişinde Etkinlik, Farkındalık ve PR kartları bulunur. Etkinlik ve farkındalık aylık görünümleri ayrıdır. PR varsayılan haftalık pano, aylık görünüm, yoğun günlerden haftaya geçiş, mobil gün özeti, detay/düzenleme paneli, kullanıcı rengi ve isteğe bağlı saat içerir. Manuel kayıt tek satırda seçilen üç takvimde gösterilebilir. Mevcut görev ve kaynak bağlantıları korunur; eski tarih bağlantıları etkinlik takvimine yönlenir. Onay mekanizması kapsam dışındadır.

## Doğrulama

- TypeScript ve üretim build başarılı. Yerelde gerçek servis anahtarları bulunmadığından tam bundle ayrıca yalnız build için sahte public ortam değerleriyle doğrulandı. Vercel mevcut ortam ayarlarını kullanır.
- Lint: hata ve uyarı yok.
- Tarih/bağlantı/renk testleri: 3/3. Push regresyon testleri: 5/5.
- Migration + SQL davranış testleri bağlı Supabase üzerinde BEGIN/ROLLBACK içinde başarılı; test kayıtları kalıcı değildir.
- SQL: aktif hedef dönem yetkisi, normal üye yazma engeli, eski dönem yöneticisinin yetkisizliği, destek görevlerinin görünmesi, eski pasif kaynağa bağlı PR düzenlemesi, pasifleştirme, kimlik değişmezliği, hatalı kapsam/renk, kilitli dönem, anonim erişim ve kalıcı silme engeli doğrulandı.
- Migration dry-run: yalnız `20260911110000_add_calendar_hub_pr_entries.sql` bekliyor.

## Yayın ve geri dönüş

Önce additive veritabanı migration'ı, ardından geliştirme dalının Git kaydı ve main'e entegrasyon yapılır. Vercel main yayınını izler. Eski tablo ve RPC kaldırılmadığından önceki frontend yeni şemayla çalışır.

Geri dönüş gerekirse main üzerindeki takvim birleştirme commit'i `git revert -m 1 <merge-commit>` ile geri alınır ve main yeniden yayımlanır. Yedek dal başlangıç sürümünü işaretler. PR verisi kaybolmaması için migration geri alınmaz ve tablo silinmez.

## Sınırlar

Onay iş akışı daha sonra netleştirilecek. Mevcut uygulamanın büyük bundle uyarısı devam ediyor. Önceki incelemede bildirilen eski audit bütçe görünürlüğü bu çalışmada düzeltilmiş sayılmamalıdır.

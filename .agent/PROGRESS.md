# MUPSA hazırlık başlangıcı / Takvim uçtan uca doğrulama

- Hedef: `preparation_start_date` manuel seçiminin oluşturma, etkinlik detay güncelleme, Supabase ve Takvim akışında doğru bağlı olduğunu doğrulamak.
- Doğrulandı: `EventsList.tsx` seçilen tarihi `create_event_with_coordinators.p_preparation_start_date` ile gönderiyor; RPC migration değeri `events.preparation_start_date` alanına aynen insert ediyor.
- Doğrulandı: EventDetail tarih editörü `preparation_start_date` alanını doğrudan update ediyor ve DB dönüşünü local event state'e yazıyor.
- Doğrulandı: `Calendar.tsx` route açılışında `events.preparation_start_date` alanını yeniden sorguluyor ve yalnız güncel değeri takvim gününe ekliyor; eski tarihe ait ayrı/cache kayıt tutulmuyor.
- Doğrulandı: `20260828202000_allow_manual_preparation_dates` linked Supabase'ta uygulanmış; otomatik hesaplama trigger fonksiyonları no-op. Sonraki `20260828220000_add_event_coordinators` RPC'si manuel tarihi kabul ediyor.
- Kontroller: `supabase migration list --linked` eşleşti; `supabase db lint --linked` temiz; `npm run lint` 0 hata/0 uyarı; `npm run build` başarılı; `git diff --check` başarılı.
- Sınırlama: `supabase db diff --linked` Docker daemon kapalı olduğu için shadow DB oluşturamadı. Canlı URL 200 döndü; isolated browser DOM ikinci adımda context kapandığı için authenticated UI tıklama senaryosu tamamlanamadı. Canlı veri değiştirilmedi.
- Karar: Uygulama bağlantısında eksik/hatalı nokta bulunmadı; ürün kodu veya migration değişikliği gerekmiyor.
- Sonraki adım: Yok; yalnız görev kaydı güncellenecek ve Git durumu temizlenerek sonuç raporlanacak.

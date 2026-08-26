# MUPİ Günlük Özet v2 — Uygulama Durumu

**Tarih:** 26 Ağustos 2026
**Durum:** Kodlandı ve doğrulandı; Edge Function'lar ile migration'lar canlı Supabase projesine uygulandı. Frontend dağıtımı GitHub/Vercel üzerinden başlatıldı.

## Hedef mimari

```text
Yetki filtreli Supabase context
        ↓
Europe/Istanbul tarih normalizasyonu
        ↓
Deterministik MUPİ öncelik motoru
        ↓
Bugün / Yakında / Gösterme
        ↓
Urgency kategorisi + puan sıralaması
        ↓
En fazla 3 Bugün + 3 Yakında
        ↓
Sanitizer
        ↓
Gemini yalnızca Türkçe ifade katmanı
        ↓
Structured-output doğrulaması
        ↓
Deterministik fallback
        ↓
Kullanıcı + gün bazlı idempotent ai_outputs
```

## Uygulananlar

- Görevlerde deterministik deadline öncelikleri: gecikmiş, bugün, yarın, 2–3, 4–7, 8–14 gün.
- Görev priority bonusları: urgent +10, high +5, normal 0, low -5.
- Sıralamada önce urgency kategorisi, sonra skor.
- Etkinliklerde 40 günlük hazırlık penceresi.
- 31–40 gün aralığı sessiz izleme havuzu; gereksiz günlük tekrar yok.
- 30–22, 21–15, 14–8, 7–3, 2–1 ve etkinlik günü fazları.
- Tasarım/duyuru süreç durumuna göre eksik hazırlığın yükseltilmesi.
- `not_required` tasarım durumunun eksik sayılmaması.
- Etkinlik sonrası `report_due` desteği; rapor tamamlanınca eski hazırlık uyarılarının kapanması.
- Farkındalık paylaşım tarihleri için Bugün/Yakında mantığı.
- `sharing_status=shared` kayıtlarının günlük adaylardan çıkarılması.
- Yakın takvim kayıtları için deterministik kurallar.
- Gün ve rapor fazında açık `Europe/Istanbul` hesabı.
- `mupi-daily-summary-v2` payload: `today`, `upcoming`, geçiş uyumluluğu için `items`.
- Gemini'nin seçim, sıralama, bucket, reason code ve action değiştirmesinin engellenmesi.
- Gemini'ye yalnızca önceden seçilmiş, düşük riskli ve sanitize edilmiş verinin gönderilmesi.
- E-posta, URL ve telefon temizliği.
- Gemini hatası/kota yokluğu durumunda deterministik fallback.
- İki Gemini anahtarında kullanıcı + tarih hash'iyle dengeli ilk anahtar seçimi; hata halinde diğer anahtara fallback.
- Aynı dönem + kullanıcı + gün için unique output idempotency.
- Eşzamanlı üretimler için `ai_jobs.dedupe_key` tabanlı generation guard.
- `force=true` cache'i aşabilir fakat devam eden generation lock'u aşamaz.
- Normal `force` yalnızca Super Admin.
- 09:00 Türkiye cron'u tüm aktif üyelere ayrı HTTP işi oluşturacak şekilde değiştirildi.
- Deploy günü ilk üretim, tüm bağımlılıklar oluştuktan sonra tekrar seed ediliyor.
- Legacy günlük özetin aynı gün v2 kaydını ezmesine karşı geçiş koruması.
- Ana sayfa günlük özet çağrısı doğrudan `mupi-daily-summary` endpoint'ine taşındı.
- Normal koordinatör yeniden paketlemesinde `today/upcoming` alanları korunuyor.
- Kartta ayrı `BUGÜN` ve `YAKINDA` bölümleri ve 3+3 sınırı.
- Safe observability view: model, fallback, source/today/upcoming sayıları.

## Eklenen/değiştirilen ana dosyalar

- `supabase/functions/_shared/aiCore.ts`
- `supabase/functions/_shared/mupiPriority.ts`
- `supabase/functions/_shared/mupiSanitize.ts`
- `supabase/functions/mupi-daily-summary/index.ts`
- `src/pages/AppHome.tsx`
- `src/components/dashboard/AiHomeSummaryCard.tsx`
- `supabase/migrations/20260826160000_mupi_daily_summary_v2.sql`
- `supabase/migrations/20260826161000_route_daily_summary_to_v2_function.sql`
- `supabase/migrations/20260826162000_tighten_mupi_daily_context.sql`
- `supabase/migrations/20260826163000_protect_and_seed_mupi_daily_v2.sql`
- `supabase/migrations/20260826164000_use_istanbul_day_for_mupi_report_phase.sql`
- `supabase/migrations/20260826165000_add_mupi_daily_observability_view.sql`
- `supabase/migrations/20260826166000_add_mupi_daily_generation_guard.sql`
- `supabase/migrations/20260826167000_seed_mupi_daily_after_all_dependencies.sql`
- `supabase/tests/mupi_daily_summary_priority_test.ts`
- `supabase/tests/mupi_daily_summary_report_test.ts`

## Eklenen otomatik test senaryoları

- Görev: -1, 0, 1, 2, 3, 4, 7, 8, 14, 15 gün.
- Etkinlik: 40, 31, 30, 22, 21, 15, 14, 8, 7, 3, 2, 1, 0 gün.
- Tamamlanan ve iptal edilen görevlerin bastırılması.
- 3+3 limit.
- Urgency kategorisinin ham skordan önce gelmesi.
- Farkındalık tarih sınırları.
- Etkinlik sonrası rapor zamanı ve tamamlanmış rapor davranışı.

## Deploy sonrası zorunlu doğrulamalar

1. `npm run build`.
2. Deno testlerinin çalıştırılması.
3. Migration'ların temiz bir veritabanında ve mevcut veritabanında sırayla uygulanması.
4. `mupi-daily-summary` Edge Function deploy'u.
5. Scheduler çağrısı için `PUSH_DISPATCH_SECRET` ve JWT doğrulama politikasının mevcut scheduler fonksiyonuyla aynı biçimde ayarlanması.
6. Super Admin ve koordinatör hesabında RLS/yetki izolasyonu.
7. Aynı kullanıcı için aynı gün ikinci normal çağrının cache dönmesi.
8. Eşzamanlı iki çağrıda yalnızca bir generation job'un Gemini'ye ulaşması.
9. Koordinatörde `force=true` → 403; Super Admin'de izin.
10. Key A hata → B fallback ve Key B hata → A fallback.
11. İki anahtar da hata → `generated_by=deterministic-v2` fallback.
12. 09:00 cron sonrası tüm aktif üyelerde o güne ait `summary_date` kaydı.
13. Pasif üyelerde günlük çıktı üretilmemesi.
14. `mupi_daily_summary_observability` görünümünde beklenen sayılar.

## Bilinçli olarak dokunulmayan alan

Mevcut `ai-orchestrator` içindeki takvim sınıflandırma ve farkındalık önerisi Gemini çağrıları bu değişiklikte ortak yeni istemciye taşınmadı. Günlük özet v2 ayrı Edge Function'a izole edildi. Bunun nedeni, repo komutlarını çalıştırıp regresyon testlerini doğrulayamadan çalışan takvim/bildirim/farkındalık yollarını geniş kapsamlı refactor etmemektir. Bu, günlük özet v2'nin işlevini engellemez; ancak planın “tüm Gemini çağrılarını tek ortak istemciye taşıma” maddesi ayrı, kontrollü bir refactor olarak kalır.

## Doğrulama notu

26 Ağustos 2026 tarihinde aşağıdaki kontroller fiilen çalıştırıldı:

- `npm run build`: başarılı.
- `npm run lint`: başarılı.
- Deno öncelik/rapor testleri: 8 test geçti, 0 hata.
- `mupi-daily-summary` ve mevcut `ai-orchestrator` Deno tip kontrolü: başarılı.
- `git diff --check`: başarılı.
- Canlı bağlantıya karşı `supabase db push --linked --dry-run`: sekiz migration doğru sırada bulundu.
- Mevcut canlı şemaya karşı `supabase db lint --linked --level warning`: hata bulunmadı.

Bu aşamada migration'lar canlı veritabanına uygulanmadı ve yeni Edge Function deploy edilmedi. Canlıya alma sırasında önce `mupi-daily-summary` fonksiyonu deploy edilmeli, ardından migration'lar uygulanmalı ve gerçek Super Admin/koordinatör oturumlarıyla doğrulama yapılmalıdır.

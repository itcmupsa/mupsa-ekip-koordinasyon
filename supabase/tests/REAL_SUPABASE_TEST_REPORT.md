# Gerçek Supabase test raporu

**Tarih:** 2 Ağustos 2026

**Ortam:** MUPSA Ekip Koordinasyon — Supabase Free, Central EU (Frankfurt)

## Migration uygulama sonucu

Supabase SQL Editor üzerinden aşağıdaki dosyalar sırayla gerçek veritabanında uygulandı. Her biri `Success. No rows returned` sonucu verdi.

1. `20260802120000_faz1_database_skeleton.sql`
2. `20260802130000_add_period_membership_audit.sql`
3. `20260802140000_queue_task_assigned_notifications.sql`
4. `20260802150000_add_push_subscriptions.sql`

İkinci migration'ın ilk denemesinde SQL Editor önceki sorguyu temizlemediği için ilk migration tekrar çalıştırılmaya çalışıldı ve `event_statuses already exists` hatası görüldü. Bu migration kaynaklı değildi; editör temizlendikten sonra yalnızca ilgili dosya çalıştırıldı ve başarılı oldu.

## Gerçek işlem testi

Tüm test verileri tek bir veritabanı işlemi içinde oluşturuldu ve sonunda `ROLLBACK` ile geri alındı. Son kontrol sorgusu; test kullanıcısı, etkinlik, görev, bildirim, push aboneliği ve audit kaydının her biri için **0** döndürdü.

Doğrulananlar:

- Dönem üyeliğinin oluşturulması ve rol değişikliği audit geçmişine işlendi (3 oluşturma + 2 rol güncellemesi).
- Birincil, destekleyen ve bilgilendirilecek üç atamada **6** bildirim üretildi: 3 uygulama içi + 3 e-posta, tamamı `queued` durumunda.
- Görev silinip yeniden asıl sorumluya atanınca iki yeni bildirim üretildi; toplam **8** bildirim, 4 uygulama içi + 4 e-posta oldu.
- Aynı kişiyi aynı görev ve aynı atama türüyle ikinci kez ekleme denemesi benzersizlik kuralıyla reddedildi.
- Görev başlığı güncellenince yeni `task_assigned` bildirimi oluşmadı.
- Push aboneliklerinde aynı kullanıcı için iki farklı cihaz kaydı tutuldu; aynı `endpoint` ikinci kez eklenemedi.
- Push abonelik anahtarlarının `audit_logs` tablosuna yazılmadığı doğrulandı.

## Henüz test edilmemiş olanlar

- RLS'nin gerçek giriş yapmış normal kullanıcı / süper yönetici rollerindeki ekran davranışı
- Gerçek e-posta gönderimi (şu an yalnızca kuyruk üretimi var)
- Gerçek tarayıcı push aboneliği ve cihazlara push teslimatı

## Migration baseline sonucu

İlk dört dosya SQL Editor ile elle uygulandığı için başlangıçta Supabase CLI migration geçmişinde kayıtlı değildi. Aynı gün proje Supabase CLI ile repoya bağlandı ve aşağıdaki sürümler, SQL yeniden çalıştırılmadan `migration repair --status applied` ile uzak kayıt defterinde işaretlendi:

1. `20260802120000`
2. `20260802130000`
3. `20260802140000`
4. `20260802150000`

Son doğrulamada `supabase migration list` her sürüm için yerel ve uzak kayıtların eşleştiğini, `supabase db push --dry-run` ise bekleyen migration olmadığını gösterdi. Bundan sonra yeni migration'lar güvenli biçimde CLI ile uygulanabilir.

# Tema seçimi PWA duyurusu

> Migration'lar bağlı veritabanına uygulandı ve gerçek duyuru 13 Eylül 2026 13:23 TSİ'de `2026-2027 Dönemi` için gönderildi. Bu sürüm anahtarını yeniden göndermeyin. Sonuçlar için [AI devir notunu](AI_DEVIR_2026-09-13.md) okuyun.

`20260912121000_theme_release_announcement.sql` migration'ı yalnızca güvenli
sunucu fonksiyonunu ve audit kaydını ekler; migration uygulanırken duyuru ya da
push kuyruğu oluşmaz.

Önce hedef dönemin kimliğini açıkça doğrulayın:

```sql
select id, slug, label, starts_on, ends_on
from public.periods
where is_active
order by starts_on desc nulls last;
```

Canlı frontend'de `/app/ayarlar?section=appearance` sayfasının giriş öncesi ve
sonrasında çalıştığı doğrulandıktan sonra, service-role kullanan güvenilir
backend'den veya Supabase SQL Editor'dan doğrulanmış dönem UUID'siyle bir kez
çalıştırın:

```sql
select public.queue_theme_release_announcement('HEDEF-DONEM-UUID'::uuid);
```

İlk çağrı `already_queued: false` ve seçilen aktif dönemdeki aktif kullanıcı
sayısını döndürür. Pasif, bulunamayan veya boş hedef dönem reddedilir. Aynı sürüm
anahtarı ve aynı hedef dönemle sonraki çağrılar `already_queued: true`
döndürür ve yeni bildirim eklemez. Fonksiyon yalnız `service_role` için
çalıştırılabilir; istemci ve normal authenticated kullanıcılar çağıramaz.

Alıcı listesi, açıkça verilen aktif döneme ait etkin üyelik ve etkin profil
kesişimidir. Fonksiyon sadece `in_app` kaydı ekler; mevcut, denetlenmiş tetikleyici
buradan `push` kaydını üretir. E-posta oluşturulmaz. Teslim worker'ı yalnız aktif
mevcut PWA aboneliklerine cihaz başına teslimat oluşturduğu için izin/opt-in ve
çoklu cihaz davranışı değişmez.

Çağrıdan sonra aşağıdaki sorgu hedef, metin ve kuyruk adetlerini doğrulamak için
kullanılabilir:

```sql
select channel, delivery_status, count(*) as notification_count
from public.notifications
where metadata ->> 'release_key' = 'user-theme-pwa-announcement-20260912'
group by channel, delivery_status
order by channel, delivery_status;

select period_id, recipient_count, target_url, queued_at
from public.release_announcements
where release_key = 'user-theme-pwa-announcement-20260912';
```

Gerçek çağrı `release_announcement_id = 83fb9d80-2e03-4fd9-8cdd-9ae36aff61ae`
ve `recipient_count = 15` döndürdü. 15 uygulama içi ve 15 push kaydı oluştu;
0 e-posta oluşturuldu. Çoklu cihazlarda 17 teslim başarılı, bir eski abonelik
`web_push_410` ile kalıcı başarısız oldu. Kuyruklandıktan sonra kullanıcı
iletişimi geri alınamaz.

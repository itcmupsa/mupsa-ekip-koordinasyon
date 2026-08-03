# MUPSA — Yapay Zekâ Çalışma Bağlamı

Bu dosya, MUPSA Ekip Koordinasyon projesine sonradan katılan bir yapay zekânın veya geliştiricinin projeyi kısa sürede doğru anlaması içindir. Görev verildiyse önce bu dosyayı ve `AI_DURUM.md` dosyasını oku; görev kapsamı açıkça genişletilmedikçe burada yazan kararları değiştirme.

## 1. Projenin amacı

MUPSA Ekip Koordinasyon, üniversite kulübü yönetim kurulunun iç kullanımı için mobil öncelikli bir web uygulamasıdır. Kulüpte yaklaşık 14 farklı koordinatörlük bulunur. Etkinlikler farklı koordinatörlüklerce önerilir ve yürütülür; başvuru formu, bütçe, SKS başvurusu, tasarım, duyuru gibi işler birden fazla kişi ve koordinatörlüğü ilgilendirir.

Uygulamanın amacı WhatsApp'ın yerine geçmek değildir. WhatsApp'ta konuşulan fakat zamanla kaybolan iş bilgisini kalıcı, aranabilir ve dönemler arası devredilebilir bir çalışma hafızasına dönüştürmektir.

Uygulama zamanla şunları kapsayacaktır:

- Etkinlik planlama ve SKS süreci takibi
- Birincil ve destekleyen kişilere görev atama
- Görev bağımlılıkları, gecikme ve yaklaşan tarih hatırlatmaları
- Kararlar, notlar, raporlar ve dosya bağlantıları
- Bildirimler
- Dönem arşivi ve dışa aktarım

## 2. Kesin ürün kararları

- Kullanım alanı yalnızca kulüp yönetim kuruludur.
- Görünürlük ilkesi şeffaflıktır: aktif dönemdeki herkes kayıtları görebilir.
- Yazma yetkileri sınırlıdır; herkes ilgisiz bir süreci değiştiremez.
- Başkan ve Bilişim Teknolojileri Koordinatörü Süper Yönetici olabilir.
- Süper Yönetici her şeyi görür, düzenler, siler, kullanıcı/yetki yönetir.
- Etkinlik açan kişi o etkinliğin sahibi olur ve genel işleyişi yönetir.
- SKS, bütçe, tasarım gibi ayrı süreçlerin kendi sorumluları olabilir. Etkinlik sahibi bu süreç alanlarına sınırsız biçimde müdahale edemez.
- Eski dönemler saklanır ve salt okunur olur; yeni ekip geçmiş rapor ve notları okuyabilir, değiştiremez.
- Kullanıcı girişi kişisel e-posta ile yapılır. Ortak kulüp e-postası kullanıcı hesabı olarak kullanılmaz.
- Giriş yöntemi parolasız Magic Link'tir. Sadece önceden davet edilmiş hesaplar giriş yapabilir.
- Dosya yükleme hedef limiti dosya başına 5 MB'dir. Bu ekran henüz yapılmamıştır.

## 3. Etkinlik ve görev ilkeleri

- Etkinlikler aylar öncesinden planlanabilir.
- Etkinlik sahibi görev tanımını oluşturur; bir görevde birden fazla kişi olabilir.
- Görev atamalarında `primary` ve `supporting` ayrımı vardır.
- Geciken görevlerde ilk anda ve 24 saat sonra bir kez daha bildirim üretilir.
- SKS durum değişiminde aktif dönemdeki tüm ekibe bildirim üretilir.
- Görev bağımlılıkları SKS durumu, başka bir görevin ilerlemesi veya etkinlik tarihine göre tanımlanabilir.
- Tarih değişince bağlı işler otomatik olarak farklı bir tarihe taşınmaz; ilgili kişilere gözden geçirme bildirimi gider.
- Etkinlik iptal veya SKS ret durumunda bağlı işler otomatik silinmez ya da iptal edilmez; insan kararı beklenir.

## 4. Teknik altyapı

| Alan | Karar |
| --- | --- |
| Frontend | Vite + React + TypeScript + Tailwind CSS |
| Veritabanı ve Auth | Supabase PostgreSQL + Supabase Auth + RLS |
| Barındırma | Cloudflare Pages |
| Giriş | Supabase Magic Link, yalnızca davetli kullanıcılar |
| E-posta/Bildirim | Supabase üzerinde bildirim kuyruğu; gerçek teslimat katmanı henüz yok |
| Zamanlanmış işler | Supabase `pg_cron` |
| Mobil hedef | Responsive web uygulaması; tam PWA kurulumu henüz yapılmadı |

Frontend istemcisi yalnızca yayınlanabilir Supabase anahtarını kullanır. `service_role`, veritabanı parolası veya başka gizli değerler asla tarayıcıya, GitHub'a veya `.env.example` dosyasına eklenmez.

## 5. Mevcut frontend düzeni

Önemli dosyalar:

- `src/App.tsx`: route tanımları
- `src/pages/Login.tsx`: Magic Link giriş ekranı
- `src/pages/AuthCallback.tsx`: giriş bağlantısı dönüş ekranı
- `src/pages/AppHome.tsx`: oturum açmış kullanıcı ana ekranı
- `src/hooks/useSession.ts`: Supabase oturum yönetimi
- `src/hooks/useMembershipStatus.ts`: profil ve aktif dönem üyeliği kontrolü
- `src/lib/supabaseClient.ts`: Supabase tarayıcı istemcisi
- `src/index.css`: ortak görsel dil

Şu an mevcut route'lar:

- `/login`
- `/auth/callback`
- `/app`
- `/app/yonetim/uyeler` (yalnızca Süper Yönetici)
- `/app/etkinlikler` (aktif dönem üyeleri)
- `/app/etkinlikler/:eventId` (etkinlik detay iskeleti)

Cloudflare Pages istemci tarafı route'lar için otomatik SPA geri dönüşünü kullanır. Eski `_redirects` kuralı bu nedenle projede kullanılmaz.

## 6. Temel veritabanı yapısı

Önemli tablolar:

- `profiles`: `id`, `display_name`, `is_active`
- `periods`: dönem bilgisi ve kilit durumu
- `coordinator_roles`: koordinatörlük tanımları
- `period_memberships`: bir kullanıcının bir dönemdeki koordinatörlüğü, uygulama rolü ve aktifliği
- `events`, `event_members`, `event_process_members`
- `tasks`, `task_assignees`, `task_dependencies`
- `notifications`, `push_subscriptions`, `audit_logs`

`period_memberships.app_role` yalnızca şu değerleri kullanır:

- `super_admin`
- `coordinator`

`profiles` e-posta tutmaz. E-posta Supabase Auth içindedir ve istemci tarafındaki yönetim ekranlarında listelenmemelidir.

RLS önemlidir:

- Aktif üyeler kayıtları okuyabilir.
- Süper Yöneticiler dönem, koordinatörlük ve dönem üyeliklerini yönetebilir.
- Sıradan kullanıcı kendi kendini Süper Yönetici yapamaz.
- İlk Süper Yönetici ataması uygulama arayüzüyle değil, kontrollü bir yönetici/SQL işlemiyle yapılır.
- Süper Yönetici üyelik ekranında mevcut davetli kullanıcı aktif döneme eklenebilir; mevcut üyelerin koordinatörlüğü, uygulama rolü ve aktifliği de güncellenebilir. Silme yerine pasifleştirme kullanılır.

## 7. Çalışma ve teslim kuralları

Bir yapay zekâya verilecek her görev küçük, tek amaçlı ve açık kapsamlı olmalıdır.

- Kullanıcı istemedikçe migration, RLS, veritabanı şeması, cron veya bildirim fonksiyonlarını değiştirme.
- Kullanıcı istemedikçe mevcut giriş akışını veya Cloudflare ayarlarını değiştirme.
- `service_role`, gerçek `.env` içeriği, anahtarlar, parolalar ve kişisel verileri üretme veya dosyalara yazma.
- Önce var olan dosyaları incele; sıfırdan aynı yapıyı yeniden yazma.
- TypeScript'te `any` kullanma.
- Yeni kullanıcı daveti e-posta gönderimi, tarayıcı uygulamasından doğrudan yapılmamalıdır; bunun için ileride güvenli bir sunucu katmanı gerekir.
- Kaynak kodu teslim ederken `node_modules`, `dist` ve `.env.local` ekleme.
- Her görev sonunda `npm run lint` ve `npm run build` çalıştır; sonuçları kısa bir kontrol raporuna yaz.
- Geliştirici, görev kapsamı dışındaki bir eksikliği fark ederse bunu not eder; sessizce başka bir sistemi değiştirmez.

## 8. Ana kaynaklar

- Ayrıntılı ürün ve teknik kararlar: `docs/MUPSA-Master-Dokuman.md`
- Güncel çalışma durumu: `docs/AI_DURUM.md`
- Cloudflare yayın rehberi: `docs/CLOUDFLARE_PAGES_YAYIN_REHBERI.md`
- Supabase şeması ve migration'lar: `supabase/migrations/`

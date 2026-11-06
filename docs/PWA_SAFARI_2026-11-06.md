# 6 Kasım 2026 — Kurulu iPhone PWA açılış sorunu

## Bildirim ve doğrulanan kapsam

Birden fazla iPhone kullanıcısı ana ekrandaki MUPSA simgesini açınca `FetchEvent.respondWith received an error: TypeError: Load failed` ekranına düştü. Kullanıcı normal Safari sekmesinin henüz denenmediğini ve bilgisayarın çalıştığını söyledi. Etkilenen cihazlardaki aktif worker sürümü/origin doğrudan okunamadı; kök neden tamamen doğrulanmış değildir.

## Kanıtlar

- Vercel HTML, `/app`, `/sw.js` ve sorgu parametreli `/sw.js` normal/iPhone user-agent ile 200 döndü; worker gövdeleri aynı SHA-256 değerine sahipti. Canlı worker'da 30 Ekim'de kaldırılan fetch dinleyicisi hâlâ yok. `Cache-Control` no-cache/no-store mevcut. TLS doğrulaması başarılı. Resmi Vercel durumunda kontrol anında aktif olay yoktu. Bu sonuç etkilenen telefon/operatör yolunu test etmez.
- Eski `.pages.dev` adresinin isteği bu ortamda TLS bağlantı sıfırlaması verdi. Kullanıcının kurulu simgesinin hangi origin'e bağlı olduğu görülmedi; eski kurulum ihtimali açık.
- Önceki registration kodu React/Supabase importlarından ve `window.load` olayından sonra çalışıyordu. Uygulama/asset yüklemesi aksarsa güncelleme koduna ulaşamama riski vardır; yalnız sunucudaki worker'ı değiştirmek telefonda etkinleştiğini kanıtlamaz.
- Safari ve ana ekran web uygulaması ayrı depolama alanları kullanır: https://developer.apple.com/videos/play/wwdc2023/10120/ ve https://webkit.org/tracking-prevention/ . Safari'de onarım kurulu PWA'nın da onarıldığı anlamına gelmez.

## Uygulanan değişiklikler

- Registration, ana uygulamadan bağımsız `pwa-bootstrap.js` dosyasına taşındı; `index.html` içinde React modülünden önce yüklenir, `window.load` beklemez. Aynı `/` scope kaydı `/sw.js?revision=2026-11-06.1` ile güncellenir; mevcut registration/PushSubscription silinmez. Oturum, localStorage, Cache Storage veya sunucu kayıtları temizlenmez.
- Sayfa/PWA yeniden görünür olduğunda, pageshow ve online olaylarında 5 dakika aralığıyla güncelleme kontrolü yapılır. Eşzamanlı registration çağrıları birleştirilir. Form taslaklarını korumak için otomatik reload yoktur.
- Worker, MessageChannel üzerinden sürüm ve `handlesFetch: false` yanıtı verir. Bekleyen worker için skipWaiting mesajı desteklenir; install işlemi skipWaiting sözünü bekler. Fetch interception geri eklenmedi.
- Bağımsız `/pwa-recovery.html` React, Supabase veya kullanıcı oturumu olmadan sürümü kontrol eder. Açılışı onar güncellemeyi ister, etkin worker'ı mesajla doğrular; zaman aşımı ve ağ hatasında başarılı demek yerine hata/retry gösterir. Eski controller sürüyorsa kapat/aç gerektiğini belirtir. Sayfa hangi tarayıcı/PWA bağlamında açılmışsa yalnız o bağlamı onarır.
- Bootstrap ve recovery dosyalarına no-cache/no-store başlıkları eklendi.
- Bildirime tıklama yolunda `client.navigate` artık `waitUntil` zincirinde beklenir, sonra focus yapılır. Var olan iOS penceresi gezinemezse güvenli mutlak uygulama adresiyle yeni pencere denenir. Bu ek bir hata dayanıklılığı düzeltmesidir; rapor edilen açılışın bildirim tıklamasından geldiği varsayılmadı.

## Doğrulama

- Mac Safari'de yalnız loopback `127.0.0.1:4188` alanında bir eski-worker fixture kuruldu. `/blocked` için kontrollü fetch reddi oluşturuldu; Safari kullanıcının ekranıyla aynı `FetchEvent.respondWith ... TypeError: Load failed` hatasını gösterdi. Bu kontrollü üretilmiş hatadır; telefonun gerçek ağ hatasının tekrarı değildir.
- Aynı scope'u kullanan onarım sayfası açılıp Açılışı onar seçildi. Hem etkin hem sayfayı yöneten worker `2026-11-06.1` olarak görüntülendi. Önceden hata veren `/blocked` daha sonra açıldı; `mupsa-pwa-test-sentinel` yerel test verisi `preserved` kaldı.
- VM regresyon testleri başlangıcı, eski/current worker ayrımını, eşzamanlı istekleri, zaman aşımını, ağ hatasında retry'ı, eski controller için yanlış başarı verilmemesini, push içeriğini ve bildirime tıklama gezinme zincirini kapsar.
- Gerçek push izni, test bildirimi veya gerçek kullanıcı verisi oluşturulmadı. Test senaryosu aktif iPhone kurulumunda henüz denenmedi.

## Etkilenen telefon için sonraki kontrol

1. Aynı telefonda normal Safari'de güncel `/login` adresinin açılıp açılmadığını kontrol et. Bu, sunucuya erişim ile kurulu uygulamanın yerel durumunu ayırır.
2. Safari'de `/pwa-recovery.html` aç, gerekirse Açılışı onar seç. Kontrol bilgilerindeki ortam/origin/sürüm görülebilir. Safari sonucu kurulu uygulamaya otomatik genellenmemeli.
3. Ana ekrandaki MUPSA'yı uygulama değiştiriciden kapatıp yeniden aç. Yeni worker otomatik kontrolü devralabilir; etkilenen cihazdan sonuç alınmadan sorun kapatılmaz.
4. Safari açılıyor fakat eski simge hâlâ hata veriyorsa eski PWA kurulumunu yenilemek veya bağlı Mac Web Inspector ile o kurulumun worker/origin bilgisini incelemek gerekir. Yeniden kurulum oturumu ve cihaz push aboneliğini etkileyebilir; kullanıcıya bunu belirt. Diğer site verilerini topluca temizleme.
5. Recovery de açılmıyorsa aynı-origin worker veya ağ hâlâ engeldir. Bu sayfa tüm navigasyonu engelleyen bir worker'ı sihirli biçimde atlamaz. Ağ/operatör ve gerçek iPhone Web Inspector verisi gerekir.

## Yayın

Yayın: uygulama commit'i `4ea372a` main üzerinden Vercel üretimine alındı; GitHub Vercel durumu success / Deployment has completed. Dağıtım: https://vercel.com/mupsa/mupsa-ekip-koordinasyon/6qQCchTEP1kVthgggnarFUJX3Rzd . Canlı worker/bootstrap/recovery dosyaları kaynakla birebir eşleşiyor ve no-cache/no-store başlığı var. Canlı HTML erken bootstrap'ı içeriyor. Üretim `/pwa-recovery.html` Mac Safari'de açıldı, Açılışı onar seçilerek hem etkin hem controller sürümü `2026-11-06.1` mesaj yanıtıyla doğrulandı. Son testler 56/56 frontend ve 5/5 push politikası (toplam 61); lint ve tam build temiz. Gerçek iPhone ana ekran kurulumundan sonuç henüz yok; aynı hata devam ederse ayrı PWA veri alanı/eski origin ve gerçek cihaz Web Inspector kontrolü hâlâ gerekli.

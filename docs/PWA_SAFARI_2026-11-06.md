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

## Aynı gün ek bildirim — Normal Safari de açılmıyor

Kullanıcı daha sonra normal Safari'den de giriş yapılamadığını bildirdi. Yeni Safari hatasının önceki FetchEvent metniyle aynı olup olmadığı, iOS sürümü ve mobil operatör henüz verilmedi. Bu nedenle olayı yalnız kurulu PWA/worker güncellemesiyle açıklayan teşhis yeterli değildir. Sonraki incelemede uygulama kodu değiştirilmedi ve yeni yama yayımlanmadı.

Bağımsız Globalping HTTPS ölçümleri (6 Kasım 2026, yaklaşık 18:00 TSİ):

| Sağlayıcı | Nokta | /login | Üretim JavaScript | HTTPS |
| --- | ---: | --- | --- | --- |
| Türk Telekom AS9121 | 3 (İstanbul/Sancaktepe) | 3/3 HTTP 200 | 3/3 HTTP 200 | Geçerli |
| Superonline AS34984 | 2 (Trabzon/Ankara) | 2/2 HTTP 200 | 2/2 HTTP 200 | Geçerli |
| TurkNet AS12735 | 2 (Antalya/Ankara) | 2/2 HTTP 200 | 2/2 HTTP 200 | Geçerli |

Kanıt bağlantıları:
- HTML: https://api.globalping.io/v1/measurements/2ALUrUkBtE9lFQ1I400021SFw
- Üretim JS: https://api.globalping.io/v1/measurements/2cFQj4cYdrHHNQMI200021SFx
- Auth endpoint ağ erişimi: https://api.globalping.io/v1/measurements/2CRkorwtrnp565whZ00021SFx (anahtarsız çağrı için beklenen HTTP 401 alındı; bu kayıt giriş işleminin başarı testi değildir).

Yerel istemciden HTTP/1.1, HTTP/2, TLS 1.2 ve farklı Vercel IP'leriyle /login 200 döndü. Vercel resmi durumunda aktif incident yoktu. Ölçümler bu sabit ağlardaki test noktalarını kapsar; etkilenen telefon, mobil şebeke, özel DNS/VPN/Private Relay veya Safari depolama bağlamını kapsamaz. Güncel deployment'ın benzersiz alias'ları Vercel SSO korumalı olduğundan kullanıcıya temiz-origin test bağlantısı diye verilmedi, koruma kapatılmadı.

Açık sınır: sorunu yaşayan telefondaki yeni hata metni ve aynı ağda temiz/özel Safari sekmesi sonucu gerekli. Normal Safari de o site için worker tutabilir; normal sekmede başarısızlık tek başına ağ/operatör veya Vercel arızasını kanıtlamaz. Bu testler sunucuya ulaşan diğer ağların çalıştığını gösterir; olay çözüldü sayılmaz.

## Kullanıcıya iş devretmeden sürdürülen ek inceleme — Eski giriş dosyaları

Kullanıcı telefondan ek test/ekran görüntüsü istemek yerine incelemeyi ajanın sürdürmesini istedi. Aynı hata yalnız kurulu PWA'ya bağlanmadı; yeni yama öncesi kaynak geçmişi ve üretim dosya yönlendirmeleri ayrıca incelendi.

### Doğrulanan üretim kusuru

Canlı `/assets/index-DlZSv3fr.js`, `/assets/index-BbJ-skmL.js` ve bilinmeyen asset isteği HTTP 200 + `text/html` ile güncel index.html döndürüyordu. Eski sürümün açılış belgesindeki module script böyle bir yanıtla çalışamaz. Mevcut geçerli üretim JS dosyası ise doğru JavaScript içerik tipiyle sunuluyordu. Bu, eski açılış belgesi taşıyan istemcileri etkileyebilen gerçek bir deployment uyumluluğu kusurudur. Fotoğraftaki üst seviye FetchEvent ağ hatasının tek/birebir nedeni olduğu kanıtlanmadı.

### Düzeltme

- Geniş tüm yolları HTML'e çeviren rewrite kaldırıldı. SPA HTML dönüşü `/app`, alt yolları, `/login` ve `/auth/callback` ile sınırlandı. Gerçek statik dosyalar Vercel'in filesystem önceliğiyle korunur.
- Vite build eklentisi `_mupsa/entry.js` ve `_mupsa/style.css` üretir; bu küçük dosyalar o build'in gerçek hash'li JavaScript/CSS dosyasına mutlak uygulama içi URL ile işaret eder. Eksik eski `assets/index-HASH.js/css` istekleri bu uyumluluk girişlerine gider. Genel eksik dosyalar HTML'e çevrilmez. Çoklu entry/CSS düzenine geçilirse build sessizce yanlış dosyayı seçmek yerine hata verir.
- Açılış HTML'ine açık no-store/no-cache eklendi. Module script başlamazsa boş root yerine statik yükleniyor/yenile bağlantısı kalır. Otomatik reload, oturum/storage/abonelik temizliği yok.
- `@vercel/routing-utils` geçici `/tmp` klasöründe kurularak gerçek route dönüşümü doğrulandı: önce filesystem, sonra sadece eksik eski entry adları için compatibility; geçerli hash'li asset'ler shim'e yönlenmez. Depo bağımlılıklarına paket eklenmedi.

### Test

Uygulama içi tarayıcıda yerel `127.0.0.1:4192` test sunucusu aynı eski HTML'i, eski `index-BbJ-skmL.js` ve `index-DJag-tWX.css` adlarıyla açtı. Hatalı production davranışı taklidinde eski HTML kaldı ve uygulama başlamadı. Yalnız yönlendirme modu değiştirildi; aynı eski HTML yeniden yüklendiğinde gerçek derlenmiş uygulamanın giriş ekranı açıldı. Yerel build sahte Supabase ayarlarıyla çalıştı; gerçek hesapla giriş veya veri yazma yapılmadı. Bu son test uygulama içi tarayıcıdadır; fiziksel iPhone/Safari testi diye raporlanmamalı.

Frontend testleri 59/59, push politikası 5/5 (toplam 64), lint, build ve diff kontrolü geçti. Sonraki adım üretim yayını sonrası eski JS/CSS adlarının doğru içerik tipiyle çalıştığını ve mevcut dosyaların değişmediğini doğrulamaktır. Önceki controlled FetchEvent testi yanında üretimde doğrulanan bu farklı açılış kusuru ayrı tutulur.

### Ek ağ sonucu

Eski `pages.dev` adresi Globalping Türk Telekom noktasında DNS `ECONNREFUSED` verdi; Superonline, Almanya ve ABD noktalarında HTTP 200 döndü. Ölçüm: https://api.globalping.io/v1/measurements/20j6MjulWqhFC5GQY00021SG5 . Kullanıcı simgesinin origin'i bilinmediği için bu ağ sonucu güncel Vercel kurulumuna genellenmedi.

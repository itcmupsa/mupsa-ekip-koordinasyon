# Faz 1 Web Temeli — Teslim Notu

Bu web temeli Vite, React, TypeScript, Tailwind CSS ve Supabase Auth kullanır. Uygulama yalnızca giriş, oturum ve korumalı `/app` kabuğunu içerir.

Görsel referans olarak master dokümanda adı geçen eski statik prototip erişilebilir olmadığından sade ve uyarlanabilir bir tasarım temeli kullanıldı.

## Bilinçli olarak henüz yapılmayanlar

- Etkinlik, görev, SKS, karar, bütçe, dosya/link ve dashboard ekranları
- Bildirim merkezi, gerçek e-posta teslimatı ve web push gönderimi
- Rol/dönem yönetimi ekranları
- PWA push aboneliği ve çevrimdışı çalışma

## Güvenlik notu

Giriş bağlantısı isteği `shouldCreateUser: false` ile çalışır. Böylece yalnızca Başkan veya IT'nin Supabase üzerinden önceden davet ettiği kullanıcılar giriş yapabilir; rastgele bir e-posta adresi yeni kullanıcı hesabı açamaz.

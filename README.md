# Daily Project 3 — Sistem Pelacakan Alumni (Web)

Prototype web statis (HTML/CSS/JS) yang mengimplementasikan alur use case:

1. **Profiling Data** (profil master alumni → normalisasi & alias)
2. **Query Generator**
3. **Mesin Pencari Publik (simulasi)** → multi-source evidence
4. **Validasi & Skor** → finalisasi data alumni
5. **Filter data pribadi / Opt-out**

## Cara Menjalankan

Opsi paling mudah:
- Buka file `index.html` langsung di browser.

Opsi disarankan (agar fetch/clipboard lebih stabil):
- Jalankan server lokal: `python -m http.server 5500`
- Buka: `http://localhost:5500`

Halaman yang tersedia:
- `auth.html` — Login admin/operator
- `register.html` — Registrasi admin/operator
- `index.html` — Profiling + generate query
- `search.html` — Pencarian publik (crawler simulasi)
- `validation.html` — Validasi, finalisasi, dan proof

## Auth (Login/Registrasi)

Prototype ini memakai autentikasi **client-side** (tanpa backend) untuk kebutuhan demo.

- Jika belum login, halaman utama akan redirect ke `auth.html`.
- Halaman awal hanya **Login**: `auth.html`.
- Registrasi ada di halaman terpisah: `register.html`.
- Opsi cepat untuk demo: tombol **Buat Admin Default** membuat akun `admin` / `admin123`.

Catatan: Ini **bukan** sistem keamanan produksi karena data akun tersimpan di browser.

## Link

- GitHub repo: (isi setelah push)
- Publish web (GitHub Pages / Netlify / Vercel): (isi setelah publish)

## Fitur yang Disimulasikan

Karena ini prototype tanpa backend, modul pencarian publik **tidak** melakukan pencarian web sungguhan dan **tidak** melakukan scraping. Evidence dibuat secara simulasi untuk menunjukkan:
- bentuk evidence (title/url/snippet/source)
- proses skoring kecocokan
- verifikasi manual
- finalisasi ringkas
- penyimpanan bukti (LocalStorage) dan export JSON

Tambahan (opsional):
- Mode **OpenAlex (API publik)** untuk mengambil metadata karya ilmiah secara real-time.
	- Jika fetch gagal (mis. jaringan/CORS), aplikasi akan fallback ke mode simulasi.

## Pengujian (Tabel)

| ID | Aspek Kualitas | Skenario Uji | Langkah | Hasil yang Diharapkan | Status |
|---:|---|---|---|---|---|
| T1 | Fungsional | Generate query | Isi profil → klik **Generate Query** | Daftar query terisi dan tombol crawler aktif | ✅ |
| T2 | Fungsional | Crawler menghasilkan evidence | Klik **Jalankan Crawler** | Evidence tampil dengan skor dan alasan | ✅ |
| T3 | Fungsional | Verifikasi manual | Centang **Verifikasi manual** pada item | Item dianggap verified dan final output ter-update | ✅ |
| T4 | Fungsional | Finalisasi | Klik **Finalisasi Data Alumni** | Output finalisasi terisi JSON ringkas | ✅ |
| T5 | Fungsional | Simpan bukti | Klik **Simpan Bukti** | Riwayat proof bertambah dan tersimpan lokal | ✅ |
| T6 | Keamanan/Privasi | Opt-out | Centang **Opt-out** | Input/crawler nonaktif + hasil dibersihkan | ✅ |
| T7 | Usability | Reset | Klik **Reset** | Form & hasil kembali kosong | ✅ |

## Struktur File

- `index.html` — halaman Profiling
- `search.html` — halaman Pencarian Publik (simulasi)
- `validation.html` — halaman Validasi & Bukti
- `auth.html` — halaman Login
- `register.html` — halaman Registrasi
- `style.css` — styling UI (light/dark via system colors)
- `app.js` — logika query/evidence/scoring/proof + state multi-page + auth client-side

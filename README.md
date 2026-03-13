# Daily Project 3 — Sistem Pelacakan Alumni (Web)

- GitHub repo: https://github.com/Celcouzz/daily-project-3-track-alumni-
- Publish web (GitHub Pages): https://celcouzz.github.io/daily-project-3-web-tracker-alumni-/

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

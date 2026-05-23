# 🚀 Deploy NexLoad ke Vercel

Panduan deploy serverless — dari nol sampai live dalam 3 menit.

---

## Arsitektur Serverless

```
Browser
  │
  ├── GET  /            → public/index.html  (Vercel CDN)
  ├── POST /api/analyze → api/analyze.js     (Serverless Function)
  ├── GET  /api/stream  → api/stream.js      (Streaming Function)
  └── GET  /api/detect  → api/detect.js      (Serverless Function)
```

**Cara download bekerja:**
1. Browser POST `/api/analyze` → dapat metadata + daftar format
2. User klik format → browser fetch `/api/stream?url=...&formatId=...`
3. Vercel function spawn `yt-dlp -o -` (pipe ke stdout)
4. Response body di-stream ke browser → Blob → Save dialog

Tidak ada filesystem, tidak ada queue, tidak ada database.

---

## Langkah 1 — Push ke GitHub

```bash
cd nexload-vercel
git init
git add .
git commit -m "feat: nexload serverless"
git branch -M main
git remote add origin https://github.com/USERNAME/nexload.git
git push -u origin main
```

---

## Langkah 2 — Deploy ke Vercel

### Via Vercel Dashboard (paling mudah):
1. Buka **[vercel.com](https://vercel.com)** → login pakai GitHub
2. Klik **"Add New Project"**
3. Import repo `nexload`
4. Framework Preset: **"Other"**
5. Klik **"Deploy"**

### Via Vercel CLI:
```bash
npm i -g vercel
vercel          # first deploy + setup
vercel --prod   # deploy ke production
```

---

## Langkah 3 — Selesai ✅

Vercel otomatis:
- Install `yt-dlp-exec` (bundled binary, tidak perlu sistem yt-dlp)
- Deploy fungsi ke edge
- Beri domain `nexload-xxx.vercel.app`

---

## ⚠️ Catatan Penting: Function Timeout

Vercel **Hobby (gratis)** = max **60 detik** per function.

| Konten | Estimasi waktu |
|---|---|
| Video pendek < 5 menit | ✅ Cukup |
| Video 10-30 menit (360p-480p) | ⚠️ Mepet |
| Video panjang / 1080p besar | ❌ Timeout |

**Solusi untuk video panjang:**
- Upgrade ke Vercel **Pro** ($20/bulan) → max 300 detik
- Atau deploy ke **Railway** (lihat `DEPLOY-RAILWAY.md`)

---

## Environment Variables (opsional)

Di Vercel dashboard → Settings → Environment Variables:

| Key | Value |
|---|---|
| `NODE_ENV` | `production` |

---

## Update App

Setiap push ke GitHub otomatis trigger deploy ulang:

```bash
git add .
git commit -m "update: ..."
git push
```

---

## Troubleshooting

**Error "Function timed out"**
→ Video terlalu panjang / besar. Coba format kualitas lebih rendah.

**Error "yt-dlp not found"**
→ Pastikan `yt-dlp-exec` ada di `dependencies` di `package.json` (bukan devDependencies).

**Download mulai tapi stuck di browser**
→ Normal untuk video besar — browser menunggu streaming selesai sebelum muncul Save dialog.

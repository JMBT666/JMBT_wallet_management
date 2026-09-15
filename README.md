<div align="center">

# 🟢 JMBT Web3 Wallet Management

### Multi-Chain Crypto Wallet Asset Monitor, Analyzer & Smart Backup Tool

[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-6.0-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Vite](https://img.shields.io/badge/Vite-8-646CFF?logo=vite&logoColor=white)](https://vitejs.dev)
[![License: MIT](https://img.shields.io/badge/License-MIT-00e676.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/Platform-Web%20(Client--Side)-black?logo=googlechrome&logoColor=00e676)](https://github.com)

**Select Language / Pilih Bahasa:**  
[ 🇬🇧 English ](#-english) • [ 🇮🇩 Bahasa Indonesia ](#-bahasa-indonesia)

</div>

---

<a name="-english"></a>
# 🇬🇧 English

## 📖 Overview

**JMBT Web3 Wallet Management** is a high-performance, web-based tool (**100% client-side, zero backend server**) designed to monitor, inspect, calculate value, and safely sweep/backup cryptocurrency assets across thousands of wallets simultaneously.

It supports **EVM** (Ethereum, BSC, Polygon, Arbitrum, Base, Optimism, Avalanche, and more), **Solana**, **TRON**, **Bitcoin**, **Litecoin**, and **XRP** — complete with automated gas dispensing, token burner/rent reclamation, and anti-scam multi-sig safeguards.

---

## ✨ Key Features

### 🔍 Multi-Chain Scanner & Analyzer
- **Bulk Wallet Import**: Scan thousands of wallets simultaneously via **Private Keys** or **Mnemonic Seed Phrases** (12/24 words).
- **EVM Ecosystem**: Ethereum, Binance Smart Chain (BSC), Polygon, Arbitrum, Optimism, Base, Avalanche, and custom EVM RPC networks.
- **Solana Ecosystem**: Native SOL and SPL token discovery (automatic price & metadata resolution with CoinGecko and DexScreener fallbacks).
- **TRON Ecosystem**: TRX native balance + USDT (TRC-20) + all TRC-20 custom tokens.
- **UTXO & Legacy Chains**: Bitcoin (BTC), Litecoin (LTC), and Ripple (XRP).
- **NFT Detection**: Detects ERC-721/ERC-1155 and Metaplex Solana digital collectibles.

### 💼 Smart Backup & Sweeper Engine (Transfer All)
- **One-Click Bulk Sweep**: Evacuate and consolidate all assets from compromised or multiple source wallets into designated secure vault addresses.
- **Intelligent TRX Gas Dispenser**: Automatically detects when a TRON wallet lacks Energy/TRX to sweep USDT TRC-20, and automatically funds exact TRX gas from a designated backup wallet.
- **Intelligent BNB Gas Dispenser**: Automatically detects BSC wallets with tokens but 0 BNB, dispensing exact gas fees on the fly.
- **TRON Permission & Multi-Sig Scam Detection**: Detects wallets with hijacked permission structures or scam multi-sigs and automatically skips them to avoid burning gas fees.
- **Solana Token Burn & Rent Reclaim**: Burn worthless spam/scam tokens and close the associated SPL token accounts to reclaim SOL rent back to your main wallet.
- **EIP-1559 Dynamic Gas Pricing**: Automatic optimal gas estimation for Ethereum and EVM networks.
- **Automatic Multi-RPC Failover**: Redundant node pools ensure transfers don't fail due to public rate limits.

### 📊 Real-Time Portfolio Analytics
- Live total portfolio valuation in USD.
- Breakdown per chain with real-time spot prices from CoinGecko and DexScreener APIs.
- Filter, search, and sort wallets by USD balance, chain, or asset type.
- Clean visual asset distribution dashboard.

### 🔑 Flexible Key Import & Export
- **File Upload**: Import directly from `.txt` or `.csv` files (one entry per line).
- **Auto-Detection**: Automatically detects Hex Private Keys (with or without `0x`), WIF, and 12/24-word Mnemonics.
- **Multi-Chain Derivation**: Derives corresponding EVM, Solana, TRON, BTC, LTC, and XRP addresses from a single mnemonic phrase.
- **Export Options**: Export parsed address books and balances to CSV, JSON, or TXT.

### 🔒 100% Client-Side Privacy & Security
- **Zero Server Footprint**: Runs completely in your local browser using IndexedDB.
- **No Data Leaks**: Private keys and seed phrases are never sent across the network or stored on any remote server.
- **Fully Open-Source & Auditable**: Review the code yourself before running.

### ⚙️ Customizable Node Infrastructure
- Custom RPC endpoints for each network.
- Optional API integrations: Infura, dRPC, Helius (Solana), Covalent / GoldRush, Blockchair.
- Automated rate-limit handling and health checks.

---

## 🚀 Getting Started

### Prerequisites
- **Node.js** v18.0.0 or higher ([Download Node.js](https://nodejs.org))
- **npm** (bundled with Node.js)
- **Git** ([Download Git](https://git-scm.com))

### 1. Clone the Repository
```bash
git clone https://github.com/USERNAME/jmbt-web3-wallet.git
cd jmbt-web3-wallet
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Launch Development Server
```bash
npm run dev
```
Open your browser and navigate to: **http://localhost:5173**

### 4. Build for Production
```bash
npm run build
```
The optimized production bundle will be generated in the `dist/` directory, ready to deploy to GitHub Pages, Vercel, Netlify, or an offline air-gapped machine.

---

## 📖 User Workflow

### Step 1 — Import Wallets
1. Click the **"Import Wallet"** button in the top navigation bar.
2. Select your import method:
   - **Direct Paste**: Paste a list of private keys or seed phrases into the text area.
   - **File Upload**: Upload a `.txt` file containing one key or mnemonic per line.
3. Click **"Parse & Preview"**, review the detected entries, and click **"Import"**.

```txt
# Supported formats:
# 12 or 24-word Mnemonic
word1 word2 word3 word4 word5 word6 word7 word8 word9 word10 word11 word12

# Hex Private Key (with or without 0x)
0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef
0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef

# Optional Label Prefix
[Main Account] 0x0123456789abcdef...
[Airdrop Wallet] word1 word2 word3...
```

### Step 2 — Scan Balances
1. Select individual wallets or check **"Select All"**.
2. Choose target blockchains to scan.
3. Click **"Scan Assets"** to trigger live balances and token fetching.

### Step 3 — Sweeper / Asset Backup
1. Click **"Transfer All"** (or backup button).
2. Configure destination recipient addresses:
   - **EVM**: `0x...` (receives ETH, BNB, MATIC, USDT, etc.)
   - **Solana**: Solana public key (receives SOL & SPL tokens)
   - **TRON**: `T...` (receives TRX & USDT TRC-20)
   - **Bitcoin**: `1...` / `3...` / `bc1...`
   - **Litecoin**: `L...` / `M...` / `ltc1...`
3. Toggle intelligent options:
   - ✅ **TRX Gas Dispenser**: Automatically funds TRX gas to zero-TRX wallets holding USDT TRC-20.
   - ✅ **BNB Gas Dispenser**: Automatically funds BNB gas to zero-BNB wallets holding BEP-20 tokens.
   - ✅ **Solana Burn & Close**: Closes zero/dust SPL accounts to reclaim SOL rent.
4. Click **"Start Transfer"** and observe the live transaction monitor.

---

## 🔧 Optional API Keys (Settings)

Configure API keys under the **Settings** menu for faster throughput:

| Service | Provider Link | Purpose |
|---------|---------------|---------|
| **Infura** | [infura.io](https://infura.io) | EVM RPC endpoint provider |
| **dRPC** | [drpc.org](https://drpc.org) | Multi-chain decentralized RPCs |
| **Helius** | [helius.dev](https://helius.dev) | High-speed Solana RPC & token parser |
| **Covalent** | [goldrush.dev](https://goldrush.dev) | Comprehensive multi-chain token balances |
| **Blockchair** | [blockchair.com/api](https://blockchair.com/api) | Bitcoin & Litecoin UTXO indexing |

---

## 🏗️ Technology Stack

| Technology | Role |
|------------|------|
| **React 19 + TypeScript** | Modern reactive user interface & strict type safety |
| **Vite 8** | Next-generation fast frontend tooling and builder |
| **ethers.js v6** | EVM wallet generation, contracts & transaction broadcasting |
| **@solana/web3.js** | Solana transactions, SPL token derivation & RPC |
| **@scure/btc-signer** | Bitcoin & Litecoin segwit/legacy signing |
| **TronGrid API** | TRON network smart contract interactions |
| **IndexedDB** | High-capacity, persistent local storage in browser |
| **CoinGecko & DexScreener** | Spot cryptocurrency price feeds |

---

## ⚠️ Security & Disclaimer

> **PLEASE READ CAREFULLY:**
> 1. Run this application **only on trusted, secure local machines**.
> 2. Private keys and recovery phrases grant **absolute control** over funds. Never share them.
> 3. Double-check all destination addresses before initiating sweep operations. Blockchain transactions are final and irreversible.
> 4. Test all transfer configurations with **small amounts first**.
> 5. The authors assume no liability for lost assets or misconfigured operations.

---

<br/>

---

<a name="-bahasa-indonesia"></a>
# 🇮🇩 Bahasa Indonesia

## 📖 Ringkasan

**JMBT Web3 Wallet Management** adalah tools berbasis web (**100% client-side, tanpa server backend**) yang dirancang untuk memantau, memeriksa nilai saldo, dan membackup/mentransfer aset kripto dari ribuan wallet sekaligus.

Aplikasi ini mendukung **EVM** (Ethereum, BSC, Polygon, Arbitrum, Base, Optimism, Avalanche, dll.), **Solana**, **TRON**, **Bitcoin**, **Litecoin**, dan **XRP** — dilengkapi dengan fitur pengisian gas fee otomatis (Gas Dispenser), penutup akun token Solana (Rent Reclaim), serta perlindungan deteksi scam multi-sig.

---

## ✨ Fitur Utama

### 🔍 Multi-Chain Scanner & Analyzer
- **Scan Massal**: Cek ribuan wallet sekaligus menggunakan **Private Key** atau **Mnemonic Seed Phrase** (12/24 kata).
- **Ekosistem EVM**: Ethereum, Binance Smart Chain (BSC), Polygon, Arbitrum, Optimism, Base, Avalanche, dan custom EVM RPC.
- **Ekosistem Solana**: Deteksi saldo native SOL dan token SPL (termasuk deteksi metadata dan harga via CoinGecko & DexScreener).
- **Ekosistem TRON**: Saldo native TRX + USDT (TRC-20) + seluruh token TRC-20 lainnya.
- **Koin UTXO & Legacy**: Bitcoin (BTC), Litecoin (LTC), dan Ripple (XRP).
- **Deteksi NFT**: Mendeteksi koleksi NFT di EVM chains dan Solana.

### 💼 Smart Backup & Sweeper Engine (Transfer Semua Aset)
- **Transfer Massal 1-Klik**: Pindahkan semua aset dari banyak wallet asal ke wallet penampung yang aman dalam satu kali proses.
- **Intelligent TRX Gas Dispenser**: Otomatis mendeteksi wallet TRON yang memiliki USDT TRC-20 namun kekurangan TRX/Energy, lalu otomatis mengirimkan TRX dari wallet cadangan.
- **Intelligent BNB Gas Dispenser**: Otomatis mendeteksi wallet BSC yang memiliki token namun 0 BNB, lalu mengirimkan BNB gas secukupnya.
- **Deteksi Scam Permission & Multi-Sig TRON**: Otomatis mendeteksi wallet yang izin transfernya telah dibajak hacker/scam dan langsung melewatinya (skip) agar tidak membuang gas fee.
- **Solana Burn & Close SPL**: Bakar token scam/spam yang tidak bernilai dan tutup akun SPL untuk mengambil kembali (*reclaim*) saldo sewa SOL (rent) ke wallet utama.
- **Dukungan EIP-1559**: Estimasi gas optimal dan dinamis untuk Ethereum dan jaringan EVM.
- **Multi-RPC Failover Otomatis**: Penggantian node otomatis jika salah satu RPC publik terkena rate-limit.

### 📊 Portfolio Analytics Real-Time
- Tampilan dashboard total nilai portofolio dalam mata uang USD.
- Rincian aset per blockchain dengan harga live dari CoinGecko dan DexScreener.
- Filter, cari, dan urutkan wallet berdasarkan nilai saldo USD, blockchain, atau tipe wallet.
- Grafik visual distribusi portofolio.

### 🔑 Import & Export Data Fleksibel
- **Upload File**: Import langsung dari file `.txt` atau `.csv` (satu wallet per baris).
- **Auto-Detection Cerdas**: Otomatis mendeteksi Private Key Hex (dengan atau tanpa `0x`), format WIF, dan Mnemonic 12/24 kata.
- **Derivasi Multi-Chain**: Otomatis menghasilkan alamat EVM, Solana, TRON, BTC, LTC, dan XRP dari satu mnemonic phrase.
- **Ekspor Data**: Ekspor daftar wallet dan saldo ke format CSV, JSON, atau TXT.

### 🔒 Privasi & Keamanan 100% Client-Side
- **Tanpa Server Backend**: Berjalan sepenuhnya di browser lokal Anda menggunakan IndexedDB.
- **Tidak Ada Kebocoran Data**: Private key dan mnemonic **tidak pernah dikirim ke server mana pun**.
- **Open Source & Transparan**: Kode dapat diaudit secara bebas sebelum dijalankan.

### ⚙️ Pengaturan RPC & API Lanjutan
- Kustomisasi RPC untuk setiap jaringan blockchain.
- Integrasi API opsional: Infura, dRPC, Helius (Solana), Covalent / GoldRush, Blockchair.
- Penanganan rate-limit otomatis dan pengecekan node aktif.

---

## 🚀 Panduan Instalasi

### Prasyarat
- **Node.js** versi 18.0.0 atau lebih baru ([Unduh Node.js](https://nodejs.org))
- **npm** (otomatis terpasang bersama Node.js)
- **Git** ([Unduh Git](https://git-scm.com))

### 1. Clone Repository
```bash
git clone https://github.com/USERNAME/jmbt-web3-wallet.git
cd jmbt-web3-wallet
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Jalankan Mode Development
```bash
npm run dev
```
Buka browser Anda dan akses: **http://localhost:5173**

### 4. Build untuk Produksi
```bash
npm run build
```
File hasil kompilasi akan berada di folder `dist/` dan siap di-hosting di Vercel, Netlify, GitHub Pages, atau dijalankan offline.

---

## 📖 Panduan Penggunaan

### Langkah 1 — Import Wallet
1. Klik tombol **"Import Wallet"** di navigasi kanan atas.
2. Pilih metode yang diinginkan:
   - **Tempel Teks (Paste)**: Salin daftar private key atau seed phrase ke kolom teks.
   - **Unggah File**: Unggah file `.txt` yang berisi satu key/mnemonic per baris.
3. Klik **"Parse & Preview"**, periksa hasil pratinjau, lalu klik **"Import"**.

```txt
# Format yang didukung:
# Mnemonic 12 atau 24 kata
word1 word2 word3 word4 word5 word6 word7 word8 word9 word10 word11 word12

# Hex Private Key (dengan atau tanpa 0x)
0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef
0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef

# Dengan Label Opsional
[Akun Utama] 0x0123456789abcdef...
[Wallet Airdrop] word1 word2 word3...
```

### Langkah 2 — Scan Saldo Aset
1. Pilih wallet yang ingin diperiksa (atau centang **"Pilih Semua"**).
2. Tentukan blockchain yang ingin di-scan.
3. Klik tombol **"Scan Aset"** untuk memuat saldo native dan token secara real-time.

### Langkah 3 — Backup / Transfer Semua Aset (Sweeper)
1. Klik tombol **"Transfer Semua"**.
2. Masukkan alamat tujuan penampung sesuai jaringan:
   - **EVM**: `0x...` (menerima ETH, BNB, MATIC, USDT, dll.)
   - **Solana**: Alamat Solana (menerima SOL & token SPL)
   - **TRON**: `T...` (menerima TRX & USDT TRC-20)
   - **Bitcoin**: `1...` / `3...` / `bc1...`
   - **Litecoin**: `L...` / `M...` / `ltc1...`
3. Aktifkan opsi pendukung:
   - ✅ **TRX Gas Dispenser**: Otomatis mendanai TRX ke wallet TRON yang memiliki USDT namun tanpa saldo TRX.
   - ✅ **BNB Gas Dispenser**: Otomatis mendanai BNB ke wallet BSC yang memiliki token namun tanpa saldo BNB.
   - ✅ **Solana Burn & Close**: Menutup token account SPL yang kosong/spam untuk klaim balik SOL rent.
4. Klik **"Mulai Transfer"** dan pantau log transaksi langsung.

---

## 🔧 Konfigurasi API (Opsional di Menu Settings)

| Penyedia API | Tautan Pendaftaran | Kegunaan |
|--------------|-------------------|---------|
| **Infura** | [infura.io](https://infura.io) | Penyedia RPC Ethereum & EVM |
| **dRPC** | [drpc.org](https://drpc.org) | Multi-chain RPC terdesentralisasi |
| **Helius** | [helius.dev](https://helius.dev) | RPC cepat & parser token Solana |
| **Covalent** | [goldrush.dev](https://goldrush.dev) | Penelusuran saldo token multi-chain |
| **Blockchair** | [blockchair.com/api](https://blockchair.com/api) | Indeks UTXO Bitcoin & Litecoin |

---

## 🏗️ Stack Teknologi

| Komponen | Kegunaan |
|----------|---------|
| **React 19 + TypeScript** | Antarmuka pengguna responsif & type safety ketat |
| **Vite 8** | Tooling frontend modern dan cepat |
| **ethers.js v6** | Pengelolaan wallet EVM, smart contract, dan pengiriman transaksi |
| **@solana/web3.js** | Interaksi RPC Solana & transaksi token SPL |
| **@scure/btc-signer** | Penandatanganan transaksi Bitcoin & Litecoin |
| **TronGrid API** | Interaksi smart contract dan network TRON |
| **IndexedDB** | Penyimpanan database lokal browser tanpa batas kuota sempit |
| **CoinGecko & DexScreener** | Sumber data harga pasar kripto real-time |

---

## 📁 Struktur Direktori

```
jmbt-web3-wallet/
├── src/
│   ├── components/          # Komponen UI antarmuka React
│   ├── services/            # Logika utama (Scanner, Sweeper, Parser)
│   ├── config/              # Konfigurasi chain & default RPC
│   └── types/               # Definisi tipe TypeScript
├── public/                  # Asset publik & ikon
├── index.html               # Entry HTML utama
├── package.json             # Manifest dependensi & script
├── vite.config.ts           # Konfigurasi Vite bundler
└── LICENSE                  # Lisensi MIT
```

---

## ⚠️ Peringatan & Disclaimer Keamanan

> **PENTING UNTUK DIPERHATIKAN:**
> 1. Gunakan aplikasi ini hanya di **perangkat komputer pribadi yang aman dan terpercaya**.
> 2. Private key dan seed phrase memberikan **kontrol penuh** atas aset Anda. Jangan pernah membagikannya kepada siapa pun.
> 3. Selalu periksa ulang alamat tujuan sebelum melakukan transfer. Transaksi blockchain bersifat permanen dan tidak dapat dibatalkan.
> 4. Selalu uji coba fitur transfer dengan **nominal kecil terlebih dahulu**.
> 5. Pengembang tidak bertanggung jawab atas segala kerugian yang diakibatkan oleh kelalaian atau kesalahan penggunaan.

---

## 📝 Lisensi

Proyek ini didistribusikan di bawah lisensi **MIT License** — bebas untuk digunakan, dimodifikasi, dan didistribusikan.

---

<div align="center">

Dibuat dengan 💚 oleh **JMBT**

[Back to top / Kembali ke atas](#-jmbt-web3-wallet-management)

</div>

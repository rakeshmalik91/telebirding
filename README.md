# Telebirding

<div align="center">
	<img src="icons/favicon-64x64.png" alt="Telebirding Logo" width="80"/>
	<br/>
	<b>Rakesh's Bird Watching & Photography Blog</b>
</div>
<br/>

**Telebirding** is a personal blog and digital catalogue documenting bird sightings from across the Indian subcontinent. It serves as a visual diary of avian encounters, featuring detailed logs, photography, and stories from various birding expeditions.

## 🌐 Live Site
Explore the catalogue online:
- **Primary**: [telebirding.info](https://telebirding.info)
- **Mirrors**: [Firebase](https://telebirding-49623.web.app) | [Netlify](https://telebirding.netlify.app)

## 📱 Mobile App (Android)
Access the bird database on the go.
- **[Google Play Store](https://play.google.com/store/apps/details?id=com.rakeshmalik.telebirding)**
- **APK Archive**: [Google Drive](https://drive.google.com/drive/folders/1UNogisKp3rtcOnigcibAPiNsQB-gZJpD?usp=drive_link) | [Dropbox](https://www.dropbox.com/scl/fo/5t1zgkn419ctlzkuacu3h/ACC-_MbfOOu151yPRRH25XU?rlkey=3tirqkq5xland2qx3dfa8hrda&st=0aosjy2b&dl=0)

## 📸 Features
- **Bird Feed**: A comprehensive timeline of bird sightings.
- **Interactive Map**: View sightings plotted on a map.
- **Stories**: Detailed blog posts and videos from birding trips (e.g., Ladakh, Uttarakhand, Rajasthan).
- **Insect ID Integration**: Links to the sister project, [Insect ID](https://github.com/rakeshmalik91/insect-id/blob/main/README.md).
- **Filtering & Sorting**: Filter by location, date, species name, and image grade.

## 🛠️ Technical Setup

The project is a static web app hosted on Firebase, using Vanilla JS, HTML, and CSS.

### Prerequisites
- **Node.js** (v20.x recommended)
- **Firebase CLI**
- **gsutil** (Google Cloud Storage utility)

### Local Development
1. **Clone the repository**:
   ```bash
   git clone https://github.com/rakeshmalik91/telebirding.git
   ```
2. **Setup Environment**:
   Run the setup script (Windows PowerShell):
   ```powershell
   ./setup.ps1
   ```
   *Alternatively, install Firebase tools globally: `npm install -g firebase-tools`*

3. **Run Locally**:
   ```bash
   firebase serve --only hosting
   ```
   Access at `http://localhost:5000`
   
### Testing
1. **Install Dependencies**:
   ```bash
   npm install
   ```
2. **Run All Tests**:
   ```bash
   npm test
   ```
   *This uses **Vitest** with a **jsdom** environment to verify core utility functions and UI helpers.*

3. **Generate Full Project Coverage**:
   ```bash
   npm run coverage
   ```
   *This generates a comprehensive report for all modules, including both **Public** and **Admin** features. Aim for 90%+ coverage on core application logic.*


### Deployment

To deploy changes to the live site:
```bash
firebase deploy
```

### Data Management
Data and media are stored in **Firebase Storage**.

**File Structure**:
- `data/`: JSON files (`birds.json`, `species.json`, `places.json`, etc.)
- `images/`: Bird photography (`*.jpg`)
- `videos/`: Sighting videos (`*.mp4`)
- `featured-images/`: Highlight thumbnails

**CORS Configuration**:
To add a new domain for CORS access:
```bash
gsutil cors set cors.json gs://telebirding-49623.appspot.com
```
---
*Developed by Rakesh Malik*
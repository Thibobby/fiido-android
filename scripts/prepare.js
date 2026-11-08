// Prépare le projet Android de Fiido Explorer. Lancé par GitHub Actions :
//   node scripts/prepare.js config    -> avant « npx cap add android »
//   node scripts/prepare.js android   -> après « npx cap add android »
// Variables d'environnement : OWNER (compte GitHub), BUILD (numéro de compilation).
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const step = process.argv[2];
const owner = (process.env.OWNER || '').toLowerCase();
const build = parseInt(process.env.BUILD || '1', 10);

function edit(file, fn){
  const p = path.join(root, file);
  const before = fs.readFileSync(p, 'utf8');
  const after = fn(before);
  if (after === before) throw new Error('Aucune modification appliquée à ' + file);
  fs.writeFileSync(p, after);
  console.log('✔ ' + file);
}
function copyDir(src, dst){
  fs.mkdirSync(dst, {recursive: true});
  for (const f of fs.readdirSync(src)){
    const s = path.join(src, f), d = path.join(dst, f);
    if (fs.statSync(s).isDirectory()) copyDir(s, d); else fs.copyFileSync(s, d);
  }
}

async function prepareConfig(){
  if (!owner) throw new Error('Variable OWNER manquante');
  // L'app garde l'adresse <compte>.github.io : les données déjà enregistrées sur le téléphone sont conservées
  for (const f of ['capacitor.config.json', 'www/index.html', 'www/offline.html'])
    edit(f, s => s.split('__OWNER__').join(owner));

  // Interface embarquée : la dernière version publiée dans le dossier « fiido »
  const url = `https://raw.githubusercontent.com/${owner}/fiido/main/index.html`;
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Impossible de récupérer ${url} (${r.status})`);
  const html = await r.text();
  if (!/APP_VERSION/.test(html)) throw new Error('La page récupérée ne ressemble pas à Fiido Explorer');
  fs.writeFileSync(path.join(root, 'www/app.html'), html);
  console.log('✔ interface embarquée : version ' + (html.match(/APP_VERSION\s*=\s*'([^']+)'/) || [])[1]);

  // Bibliothèques (carte et graphiques) embarquées pour fonctionner sans réseau
  fs.mkdirSync(path.join(root, 'www/lib'), {recursive: true});
  for (const [src, dst] of [['leaflet/dist/leaflet.css', 'leaflet.css'], ['leaflet/dist/leaflet.js', 'leaflet.js'], ['chart.js/dist/chart.umd.js', 'chart.umd.js']])
    fs.copyFileSync(path.join(root, 'node_modules', src), path.join(root, 'www/lib', dst));
  console.log('✔ bibliothèques embarquées');
}

if (step === 'config'){
  prepareConfig().catch(e => { console.error('✘ ' + e.message); process.exit(1); });
}

else if (step === 'android'){
  const res = 'android/app/src/main/res';

  // 1. Numéro de version : chaque compilation remplace la précédente sur le téléphone.
  //    Le nom affiché dans les réglages Android reprend la version de l'interface embarquée.
  const appHtml = fs.readFileSync(path.join(root, 'www/app.html'), 'utf8');
  const appVer = ((appHtml.match(/APP_VERSION\s*=\s*'([^']+)'/) || [])[1] || '0').replace(/\s*bêta/, '-beta');
  edit('android/app/build.gradle', s => s
    .replace(/versionCode \d+/, `versionCode ${build}`)
    .replace(/versionName "[^"]*"/, `versionName "${appVer} (build ${build})"`));

  // 2. Signature : la même clé à chaque compilation, sinon Android refuse la mise à jour
  edit('android/app/build.gradle', s => s
    .replace(/android \{\n/, `android {
    signingConfigs {
        release {
            storeFile file(System.getenv("KEYSTORE_FILE") ?: "release.jks")
            storePassword System.getenv("KEYSTORE_PASSWORD")
            keyAlias "fiido"
            keyPassword System.getenv("KEYSTORE_PASSWORD")
        }
    }
`)
    .replace(/release \{\n(\s*)minifyEnabled false/, (m, sp) => `release {\n${sp}signingConfig signingConfigs.release\n${sp}minifyEnabled false`));

  // 3. Icônes de l'app et de la notification
  copyDir(path.join(root, 'resources/android'), path.join(root, res));
  edit(`${res}/values/ic_launcher_background.xml`, s => s.replace(/#[0-9A-Fa-f]{6}/, '#0B0E10'));
  console.log('✔ icônes');

  // 4. Écran de démarrage sombre (au lieu du logo Capacitor)
  for (const d of fs.readdirSync(path.join(root, res))){
    const f = path.join(root, res, d, 'splash.png');
    if (d.startsWith('drawable') && fs.existsSync(f)) fs.unlinkSync(f);
  }
  fs.writeFileSync(path.join(root, res, 'drawable/splash.xml'),
    '<?xml version="1.0" encoding="utf-8"?>\n<shape xmlns:android="http://schemas.android.com/apk/res/android" android:shape="rectangle">\n    <solid android:color="#0B0E10" />\n</shape>\n');
  edit(`${res}/values/styles.xml`, s => s.replace(
    '<item name="android:background">@drawable/splash</item>',
    '<item name="android:background">@drawable/splash</item>\n        <item name="windowSplashScreenBackground">#0B0E10</item>\n        <item name="postSplashScreenTheme">@style/AppTheme.NoActionBar</item>'));

  // 5. Activité principale avec rapport de plantage
  fs.copyFileSync(path.join(root, 'resources/MainActivity.java'),
    path.join(root, 'android/app/src/main/java/fr/fiidoexplorer/app/MainActivity.java'));
  console.log('✔ rapport de plantage');

  // 6. Textes de la notification « trajet en cours »
  edit(`${res}/values/strings.xml`, s => s.replace('</resources>',
    `    <string name="capacitor_background_geolocation_notification_channel_name">Trajet en cours</string>
    <string name="capacitor_background_geolocation_notification_icon">drawable/ic_tracking</string>
    <string name="capacitor_background_geolocation_notification_color">#2DD4BF</string>
</resources>`));
}

else {
  throw new Error('Étape inconnue : ' + step);
}

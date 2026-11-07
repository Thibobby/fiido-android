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

if (step === 'config'){
  if (!owner) throw new Error('Variable OWNER manquante');
  // L'app charge l'interface depuis GitHub Pages : les mises à jour de index.html arrivent sans réinstaller l'APK
  for (const f of ['capacitor.config.json', 'www/offline.html'])
    edit(f, s => s.split('__OWNER__').join(owner));
}

else if (step === 'android'){
  const res = 'android/app/src/main/res';

  // 1. Numéro de version : chaque compilation remplace la précédente sur le téléphone
  edit('android/app/build.gradle', s => s
    .replace(/versionCode \d+/, `versionCode ${build}`)
    .replace(/versionName "[^"]*"/, `versionName "0.10.${build}"`));

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

  // 5. Textes de la notification « trajet en cours »
  edit(`${res}/values/strings.xml`, s => s.replace('</resources>',
    `    <string name="capacitor_background_geolocation_notification_channel_name">Trajet en cours</string>
    <string name="capacitor_background_geolocation_notification_icon">drawable/ic_tracking</string>
    <string name="capacitor_background_geolocation_notification_color">#2DD4BF</string>
</resources>`));
}

else {
  throw new Error('Étape inconnue : ' + step);
}

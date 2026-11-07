package fr.fiidoexplorer.app;

import android.app.AlertDialog;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Context;
import android.os.Build;
import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

import java.io.BufferedReader;
import java.io.File;
import java.io.FileReader;
import java.io.FileWriter;
import java.io.IOException;
import java.io.PrintWriter;

// Activité principale de Fiido Explorer, avec un rapport de plantage :
// si l'app s'arrête brutalement, l'erreur est enregistrée puis affichée au lancement suivant.
public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        final File crashFile = new File(getFilesDir(), "dernier-plantage.txt");
        final String version = appVersion();

        final Thread.UncaughtExceptionHandler previous = Thread.getDefaultUncaughtExceptionHandler();
        Thread.setDefaultUncaughtExceptionHandler((thread, error) -> {
            try (PrintWriter w = new PrintWriter(new FileWriter(crashFile))) {
                w.println("Fiido Explorer " + version + " · Android " + Build.VERSION.RELEASE
                        + " (API " + Build.VERSION.SDK_INT + ") · " + Build.MANUFACTURER + " " + Build.MODEL);
                w.println("Fil : " + thread.getName());
                error.printStackTrace(w);
            } catch (IOException ignored) {
                // rien à faire : on ne peut pas enregistrer le rapport
            }
            if (previous != null) previous.uncaughtException(thread, error);
        });

        if (crashFile.exists()) {
            final String report = read(crashFile);
            //noinspection ResultOfMethodCallIgnored
            crashFile.delete();
            final String shown = report.length() > 2500 ? report.substring(0, 2500) + "…" : report;
            new AlertDialog.Builder(this)
                    .setTitle("L'application s'est arrêtée la dernière fois")
                    .setMessage("Copie ce rapport et envoie-le à Claude :\n\n" + shown)
                    .setPositiveButton("Copier le rapport", (dialog, which) -> {
                        ClipboardManager clipboard = (ClipboardManager) getSystemService(Context.CLIPBOARD_SERVICE);
                        if (clipboard != null) clipboard.setPrimaryClip(ClipData.newPlainText("Rapport Fiido Explorer", report));
                    })
                    .setNegativeButton("Fermer", null)
                    .show();
        }
    }

    private String appVersion() {
        try {
            return getPackageManager().getPackageInfo(getPackageName(), 0).versionName;
        } catch (Exception e) {
            return "?";
        }
    }

    private static String read(File file) {
        StringBuilder sb = new StringBuilder();
        try (BufferedReader r = new BufferedReader(new FileReader(file))) {
            String line;
            while ((line = r.readLine()) != null) sb.append(line).append('\n');
        } catch (IOException ignored) {
            // rapport illisible
        }
        return sb.toString();
    }
}

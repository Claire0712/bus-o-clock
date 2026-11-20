package hk.edu.busoclock;

import androidx.appcompat.app.AppCompatDelegate;
import androidx.core.os.LocaleListCompat;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.util.Arrays;

/** Connects the in-app language picker to Android's per-app locale. */
@CapacitorPlugin(name = "AppLanguage")
public class AppLanguagePlugin extends Plugin {
    @PluginMethod
    public void setLanguage(PluginCall call) {
        String language = call.getString("language", "");
        if (!Arrays.asList("en", "zh-Hans", "zh-Hant", "ja", "ko", "fr", "es", "de", "pt").contains(language)) {
            call.reject("Unsupported application language");
            return;
        }
        getActivity().runOnUiThread(() -> {
            try {
                LocaleListCompat locales = LocaleListCompat.forLanguageTags(language);
                if (!locales.equals(AppCompatDelegate.getApplicationLocales())) {
                    AppCompatDelegate.setApplicationLocales(locales);
                }
                call.resolve();
            } catch (Exception error) {
                call.reject("Unable to update Android application language", error);
            }
        });
    }
}

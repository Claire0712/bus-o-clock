package hk.edu.busoclock;

import com.getcapacitor.BridgeActivity;
import android.os.Bundle;
import android.content.res.Configuration;
import androidx.core.view.WindowCompat;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(AppLanguagePlugin.class);
        super.onCreate(savedInstanceState);
        updateSystemBars();
    }

    private void updateSystemBars() {
        WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView()).setAppearanceLightStatusBars(true);
        WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView()).setAppearanceLightNavigationBars(true);
    }

    @Override public void onResume() {
        super.onResume();
        updateSystemBars();
    }

    @Override public void onConfigurationChanged(Configuration configuration) {
        super.onConfigurationChanged(configuration);
        updateSystemBars();
    }
}

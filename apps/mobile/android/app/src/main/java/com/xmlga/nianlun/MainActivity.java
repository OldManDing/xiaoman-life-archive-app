package com.xmlga.nianlun;

import android.graphics.Color;
import android.os.Build;
import android.os.Bundle;
import android.view.Window;
import android.view.WindowInsetsController;
import android.view.WindowManager;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private static final int APP_STATUS_BAR_COLOR = Color.parseColor("#F7F4EE");
    private static final int APP_NAVIGATION_BAR_COLOR = Color.parseColor("#F7F4EE");

    @Override
    public void onCreate(Bundle savedInstanceState) {
        configureSystemBars();
        registerPlugin(NativeLocationPlugin.class);
        registerPlugin(NativeExportPlugin.class);
        registerPlugin(AppUpdaterPlugin.class);
        super.onCreate(savedInstanceState);
        configureSystemBars();
    }

    @Override
    public void onResume() {
        super.onResume();
        configureSystemBars();
    }

    private void configureSystemBars() {
        Window window = getWindow();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            window.setDecorFitsSystemWindows(true);
        }
        window.clearFlags(WindowManager.LayoutParams.FLAG_TRANSLUCENT_STATUS | WindowManager.LayoutParams.FLAG_TRANSLUCENT_NAVIGATION);
        window.addFlags(WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS);
        window.setBackgroundDrawable(new android.graphics.drawable.ColorDrawable(APP_STATUS_BAR_COLOR));
        window.setStatusBarColor(APP_STATUS_BAR_COLOR);
        window.setNavigationBarColor(APP_NAVIGATION_BAR_COLOR);
    }
}

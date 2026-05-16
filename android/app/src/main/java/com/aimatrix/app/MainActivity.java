package com.aimatrix.app;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Register Capacitor plugins before super.onCreate()
        registerPlugin(JarvisPlugin.class);
        super.onCreate(savedInstanceState);
    }
}

package id.my.smartoutsource.salescanvas;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(RootCheckPlugin.class);
        super.onCreate(savedInstanceState);
    }
}

package id.my.smartoutsource.salescanvas;

import android.content.pm.PackageManager;
import android.os.Build;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.util.ArrayList;
import java.util.List;

// DETEKSI ROOT TINGKAT 1 - pemeriksaan ringan di HP, BUKAN jaminan.
// Bisa dilewati oleh modul penyembunyi root (mis. Magisk DenyList/Zygisk).
// Hasilnya HANYA dipakai untuk menambah skor risiko di server (mode diam) -
// TIDAK PERNAH dipakai untuk memblokir apa pun langsung di HP. Root sendiri
// bukan bukti kecurangan, cuma menunjukkan HP MAMPU dipakai curang.
@CapacitorPlugin(name = "RootCheck")
public class RootCheckPlugin extends Plugin {

    private static final String[] SU_PATHS = {
        "/system/bin/su", "/system/xbin/su", "/sbin/su",
        "/system/su", "/system/bin/.ext/su", "/data/local/su",
        "/data/local/bin/su", "/data/local/xbin/su",
        "/system/app/Superuser.apk", "/system/app/SuperSU.apk",
    };

    private static final String[] ROOT_APP_PACKAGES = {
        "com.topjohnwu.magisk",
        "eu.chainfire.supersu",
        "com.noshufou.android.su",
        "com.noshufou.android.su.elite",
        "com.kingroot.kinguser",
        "com.kingo.root",
        "com.smedialink.oneclickroot",
        "com.zhiqupk.root.global",
        "com.alephzain.framaroot",
    };

    @PluginMethod
    public void check(PluginCall call) {
        List<String> flags = new ArrayList<>();

        if (Build.TAGS != null && Build.TAGS.contains("test-keys")) {
            flags.add("build_test_keys");
        }

        for (String path : SU_PATHS) {
            if (new File(path).exists()) {
                flags.add("su_binary_ditemukan");
                break;
            }
        }

        PackageManager pm = getContext().getPackageManager();
        for (String pkg : ROOT_APP_PACKAGES) {
            try {
                pm.getPackageInfo(pkg, 0);
                flags.add("aplikasi_root_terpasang");
                break;
            } catch (PackageManager.NameNotFoundException e) {
                // tidak terpasang - lanjut cek paket berikutnya
            }
        }

        JSArray flagsArray = new JSArray();
        for (String f : flags) flagsArray.put(f);

        JSObject ret = new JSObject();
        ret.put("possibleRoot", !flags.isEmpty());
        ret.put("flags", flagsArray);
        call.resolve(ret);
    }
}

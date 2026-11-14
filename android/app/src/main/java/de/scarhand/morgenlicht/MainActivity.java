package de.scarhand.morgenlicht;

import android.Manifest;
import android.app.Activity;
import android.app.AlarmManager;
import android.app.NotificationManager;
import android.content.ActivityNotFoundException;
import android.content.ContentUris;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.database.Cursor;
import android.net.Uri;
import android.provider.CalendarContract;
import android.media.AudioManager;
import android.os.Build;
import android.os.PowerManager;
import android.provider.Settings;
import android.os.Bundle;
import android.view.View;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import androidx.webkit.ServiceWorkerClientCompat;
import androidx.webkit.ServiceWorkerControllerCompat;
import androidx.webkit.WebViewAssetLoader;
import androidx.webkit.WebViewCompat;
import androidx.webkit.WebViewFeature;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.Calendar;
import java.util.Collections;
import java.util.TimeZone;

/**
 * App-Hülle für die Morgenlicht-Web-App. Die Web-Dateien liegen in der APK (assets/www)
 * und werden über eine https-Adresse ausgeliefert, damit Speicher, Klänge und Offline-Betrieb
 * wie im Browser funktionieren. Solange die App offen ist, bleibt das Display an.
 */
public class MainActivity extends Activity {

    private static final String HOST = "appassets.androidplatform.net";
    private static final String START = "https://" + HOST + "/assets/www/Morgenlicht.html";
    private static final int FILE_REQUEST = 1;
    private static final int CALENDAR_REQUEST = 2;
    private static final int NOTIFICATION_REQUEST = 3;

    /**
     * Die App läuft im Vollbild und hält das Display selbst wach (FLAG_KEEP_SCREEN_ON).
     * Damit die Seite das erkennt und nicht vor fehlender Display-Sperre oder Browser-Tab warnt,
     * bekommt sie passende Schnittstellen für wakeLock, Vollbild und "als App geöffnet".
     */
    private static final String APP_BRIDGE =
            "(function(){try{"
            + "Object.defineProperty(navigator,'standalone',{configurable:true,value:true});"
            + "Element.prototype.requestFullscreen=function(){return Promise.resolve();};"
            + "class MorgenlichtSentinel extends EventTarget{"
            + "constructor(){super();this.type='screen';this.released=false;this.onrelease=null;}"
            + "async release(){if(this.released)return;this.released=true;"
            + "const e=new Event('release');if(typeof this.onrelease==='function')this.onrelease(e);this.dispatchEvent(e);}}"
            + "Object.defineProperty(navigator,'wakeLock',{configurable:true,"
            + "value:{request:async function(){return new MorgenlichtSentinel();}}});"
            + "}catch(e){}})();";

    private WebView web;
    private WebViewAssetLoader loader;
    private ValueCallback<Uri[]> fileCallback;
    /** Die App wurde vom Wecker geöffnet und die Seite soll Licht und Ton starten. */
    private boolean alarmLaunch;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);

        loader = new WebViewAssetLoader.Builder()
                .setDomain(HOST)
                .addPathHandler("/assets/", new WebViewAssetLoader.AssetsPathHandler(this))
                .build();

        web = new WebView(this);
        web.setBackgroundColor(0xFF19202B);
        setContentView(web);

        WebSettings settings = web.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setAllowFileAccess(false);

        web.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                return loader.shouldInterceptRequest(request.getUrl());
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri url = request.getUrl();
                if (HOST.equals(url.getHost())) return false;
                // Fremde Links (z. B. Quellen) im normalen Browser öffnen
                try {
                    startActivity(new Intent(Intent.ACTION_VIEW, url));
                } catch (ActivityNotFoundException ignored) {
                }
                return true;
            }
        });

        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
                if (fileCallback != null) fileCallback.onReceiveValue(null);
                fileCallback = callback;
                try {
                    startActivityForResult(params.createIntent(), FILE_REQUEST);
                    return true;
                } catch (ActivityNotFoundException e) {
                    fileCallback = null;
                    return false;
                }
            }
        });

        if (WebViewFeature.isFeatureSupported(WebViewFeature.SERVICE_WORKER_BASIC_USAGE)
                && WebViewFeature.isFeatureSupported(WebViewFeature.SERVICE_WORKER_SHOULD_INTERCEPT_REQUEST)) {
            ServiceWorkerControllerCompat.getInstance().setServiceWorkerClient(new ServiceWorkerClientCompat() {
                @Override
                public WebResourceResponse shouldInterceptRequest(WebResourceRequest request) {
                    return loader.shouldInterceptRequest(request.getUrl());
                }
            });
        }

        if (WebViewFeature.isFeatureSupported(WebViewFeature.DOCUMENT_START_SCRIPT)) {
            WebViewCompat.addDocumentStartJavaScript(web, APP_BRIDGE, Collections.singleton("https://" + HOST));
        }

        web.addJavascriptInterface(new CalendarBridge(), "MorgenlichtKalender");
        web.addJavascriptInterface(new AlarmBridge(), "MorgenlichtAlarm");
        alarmLaunch = savedInstanceState == null && getIntent().hasExtra(AlarmScheduler.EXTRA_PHASE);

        hideSystemBars();

        if (savedInstanceState == null || web.restoreState(savedInstanceState) == null) {
            web.loadUrl(START);
        }
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        if (intent.hasExtra(AlarmScheduler.EXTRA_PHASE)) {
            alarmLaunch = true;
            web.evaluateJavascript("window.morgenlichtAlarmLaunch&&window.morgenlichtAlarmLaunch()", null);
        }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        if (requestCode == FILE_REQUEST) {
            if (fileCallback != null) {
                fileCallback.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(resultCode, data));
                fileCallback = null;
            }
            return;
        }
        super.onActivityResult(requestCode, resultCode, data);
    }

    /** Während Nachtansicht oder Weckbildschirm laufen, beendet die Zurück-Taste die App nicht. */
    @Override
    @SuppressWarnings("deprecation")
    public void onBackPressed() {
        web.evaluateJavascript(
                "(function(){var s=document.getElementById('stage');return !!(s&&!s.hidden);})()",
                value -> {
                    if ("true".equals(value)) return;
                    if (web.canGoBack()) web.goBack();
                    else finish();
                });
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) hideSystemBars();
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        super.onSaveInstanceState(outState);
        web.saveState(outState);
    }

    // Absichtlich kein web.onPause(): Die Seite soll weiterlaufen, auch wenn die App kurz verdeckt ist.

    @Override
    protected void onDestroy() {
        if (fileCallback != null) {
            fileCallback.onReceiveValue(null);
            fileCallback = null;
        }
        web.destroy();
        super.onDestroy();
    }

    @SuppressWarnings("deprecation")
    private void hideSystemBars() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            WindowInsetsController controller = getWindow().getInsetsController();
            if (controller != null) {
                controller.hide(WindowInsets.Type.systemBars());
                controller.setSystemBarsBehavior(WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
            }
        } else {
            getWindow().getDecorView().setSystemUiVisibility(
                    View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                            | View.SYSTEM_UI_FLAG_FULLSCREEN
                            | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                            | View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                            | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                            | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN);
        }
    }

    /**
     * Schnittstelle für die Seite: liest die Termine von heute aus dem Handy-Kalender.
     * Nichts davon verlässt das Gerät. Ohne Erlaubnis liefert sie eine leere Liste.
     */
    private class CalendarBridge {
        @JavascriptInterface
        public boolean hasPermission() {
            return checkSelfPermission(Manifest.permission.READ_CALENDAR) == PackageManager.PERMISSION_GRANTED;
        }

        @JavascriptInterface
        public void requestPermission() {
            if (hasPermission()) return;
            runOnUiThread(() -> requestPermissions(new String[]{Manifest.permission.READ_CALENDAR}, CALENDAR_REQUEST));
        }

        /** JSON: {"granted":true,"events":[{"title":"..","begin":ms,"end":ms,"allDay":false}]} */
        @JavascriptInterface
        public String getToday() {
            JSONObject result = new JSONObject();
            JSONArray events = new JSONArray();
            try {
                boolean granted = hasPermission();
                result.put("granted", granted);
                if (granted) readToday(events);
                result.put("events", events);
            } catch (Exception e) {
                try {
                    result.put("granted", false);
                    result.put("events", events);
                } catch (Exception ignored) {
                }
            }
            return result.toString();
        }

        private void readToday(JSONArray out) throws Exception {
            Calendar day = Calendar.getInstance();
            int year = day.get(Calendar.YEAR), month = day.get(Calendar.MONTH), date = day.get(Calendar.DAY_OF_MONTH);
            day.set(year, month, date, 0, 0, 0);
            day.set(Calendar.MILLISECOND, 0);
            long from = day.getTimeInMillis();
            day.add(Calendar.DAY_OF_MONTH, 1);
            long to = day.getTimeInMillis();

            // Ganztägige Termine liegen in UTC: ihr Tag wird über das UTC-Datum bestimmt
            Calendar utc = Calendar.getInstance(TimeZone.getTimeZone("UTC"));
            utc.clear();
            utc.set(year, month, date);
            long todayUtc = utc.getTimeInMillis();

            Uri.Builder builder = CalendarContract.Instances.CONTENT_URI.buildUpon();
            ContentUris.appendId(builder, from - 24L * 3600000L);
            ContentUris.appendId(builder, to + 24L * 3600000L);
            String[] columns = {
                    CalendarContract.Instances.TITLE,
                    CalendarContract.Instances.BEGIN,
                    CalendarContract.Instances.END,
                    CalendarContract.Instances.ALL_DAY,
                    CalendarContract.Instances.SELF_ATTENDEE_STATUS
            };
            try (Cursor c = getContentResolver().query(builder.build(), columns, null, null,
                    CalendarContract.Instances.ALL_DAY + " DESC, " + CalendarContract.Instances.BEGIN + " ASC")) {
                if (c == null) return;
                while (c.moveToNext() && out.length() < 20) {
                    long begin = c.getLong(1), end = c.getLong(2);
                    boolean allDay = c.getInt(3) == 1;
                    if (c.getInt(4) == CalendarContract.Attendees.ATTENDEE_STATUS_DECLINED) continue;
                    boolean today = allDay ? (begin <= todayUtc && todayUtc < end) : (begin < to && end > from);
                    if (!today) continue;
                    String title = c.getString(0);
                    JSONObject event = new JSONObject();
                    event.put("title", title == null || title.trim().isEmpty() ? "(ohne Titel)" : title);
                    event.put("begin", begin);
                    event.put("end", end);
                    event.put("allDay", allDay);
                    out.put(event);
                }
            }
        }
    }

    /** Schnittstelle für die Seite: Systemalarm planen, Zustand der Freigaben melden. */
    private class AlarmBridge {
        @JavascriptInterface
        public void schedule(double start, double end) {
            AlarmScheduler.schedule(MainActivity.this, (long) start, (long) end);
        }

        @JavascriptInterface
        public void cancel() {
            AlarmScheduler.cancel(MainActivity.this);
        }

        /** Gibt true zurück, wenn der Wecker die App geöffnet hat (einmalig). */
        @JavascriptInterface
        public boolean consumeLaunch() {
            boolean value = alarmLaunch;
            alarmLaunch = false;
            return value;
        }

        /** Geplante Zeiten: {"start":ms,"end":ms} oder {}. */
        @JavascriptInterface
        public String getPlan() {
            return AlarmScheduler.planJson(MainActivity.this);
        }

        @JavascriptInterface
        public void requestNotifications() {
            if (Build.VERSION.SDK_INT >= 33
                    && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
                runOnUiThread(() -> requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, NOTIFICATION_REQUEST));
            }
        }

        /** {"exactAlarm":b,"notifications":b,"fullScreen":b,"batteryFree":b,"mediaVolume":0-100} */
        @JavascriptInterface
        public String status() {
            try {
                AlarmManager alarms = getSystemService(AlarmManager.class);
                NotificationManager notes = getSystemService(NotificationManager.class);
                PowerManager power = getSystemService(PowerManager.class);
                AudioManager audio = getSystemService(AudioManager.class);
                boolean exact = Build.VERSION.SDK_INT < Build.VERSION_CODES.S || alarms.canScheduleExactAlarms();
                boolean enabled = notes.areNotificationsEnabled();
                boolean full = Build.VERSION.SDK_INT < 34 || notes.canUseFullScreenIntent();
                boolean battery = power.isIgnoringBatteryOptimizations(getPackageName());
                int max = Math.max(1, audio.getStreamMaxVolume(AudioManager.STREAM_MUSIC));
                int volume = audio.getStreamVolume(AudioManager.STREAM_MUSIC) * 100 / max;
                return "{\"exactAlarm\":" + exact + ",\"notifications\":" + enabled + ",\"fullScreen\":" + full
                        + ",\"batteryFree\":" + battery + ",\"mediaVolume\":" + volume + "}";
            } catch (RuntimeException e) {
                return "{}";
            }
        }

        /** Öffnet die passende Android-Einstellung: exact, fullscreen, notifications oder battery. */
        @JavascriptInterface
        public void openSettings(String kind) {
            runOnUiThread(() -> {
                Uri pkg = Uri.parse("package:" + getPackageName());
                Intent intent;
                switch (kind) {
                    case "exact":
                        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) return;
                        intent = new Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM, pkg);
                        break;
                    case "fullscreen":
                        if (Build.VERSION.SDK_INT < 34) return;
                        intent = new Intent(Settings.ACTION_MANAGE_APP_USE_FULL_SCREEN_INTENT, pkg);
                        break;
                    case "notifications":
                        intent = new Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS)
                                .putExtra(Settings.EXTRA_APP_PACKAGE, getPackageName());
                        break;
                    default:
                        intent = new Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS);
                }
                try {
                    startActivity(intent);
                } catch (ActivityNotFoundException ignored) {
                }
            });
        }
    }
}

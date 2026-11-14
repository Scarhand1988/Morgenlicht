package de.scarhand.morgenlicht;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;

/**
 * Plant die zwei Systemalarme der App: Lichtbeginn und Weckzeit.
 * Die Zeiten stehen zusätzlich in den Einstellungen, damit sie nach einem Neustart neu geplant werden können.
 */
final class AlarmScheduler {
    static final String ACTION = "de.scarhand.morgenlicht.ALARM";
    static final String EXTRA_PHASE = "alarm_phase";
    private static final String PREFS = "alarm";
    private static final int CODE_LIGHT = 11, CODE_RING = 12, CODE_SHOW = 13;

    private AlarmScheduler() {
    }

    static void schedule(Context context, long start, long end) {
        cancelAlarms(context);
        long now = System.currentTimeMillis();
        if (end <= now) {
            clear(context);
            return;
        }
        prefs(context).edit().putLong("start", start).putLong("end", end).apply();
        AlarmManager manager = context.getSystemService(AlarmManager.class);
        if (manager == null) return;

        PendingIntent show = PendingIntent.getActivity(context, CODE_SHOW,
                new Intent(context, MainActivity.class), PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);

        // Weckzeit: als Wecker beim System angemeldet (zeigt das Wecker-Symbol, funktioniert auch im Ruhezustand)
        manager.setAlarmClock(new AlarmManager.AlarmClockInfo(end, show), pending(context, CODE_RING, "ring"));

        // Lichtbeginn: exakt, wenn erlaubt, sonst ebenfalls als Wecker
        if (start > now && start < end) {
            PendingIntent light = pending(context, CODE_LIGHT, "light");
            boolean exact = Build.VERSION.SDK_INT < Build.VERSION_CODES.S || manager.canScheduleExactAlarms();
            if (exact) manager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, start, light);
            else manager.setAlarmClock(new AlarmManager.AlarmClockInfo(start, show), light);
        }
    }

    static void cancel(Context context) {
        cancelAlarms(context);
        clear(context);
    }

    /** Nach Neustart oder App-Update: gespeicherte Zeiten erneut planen. */
    static void restore(Context context) {
        SharedPreferences p = prefs(context);
        long start = p.getLong("start", 0), end = p.getLong("end", 0);
        if (end > System.currentTimeMillis()) schedule(context, start, end);
    }

    /** {"start":ms,"end":ms} oder leer, wenn nichts geplant ist. */
    static String planJson(Context context) {
        SharedPreferences p = prefs(context);
        long end = p.getLong("end", 0);
        if (end <= 0) return "{}";
        return "{\"start\":" + p.getLong("start", 0) + ",\"end\":" + end + "}";
    }

    private static void cancelAlarms(Context context) {
        AlarmManager manager = context.getSystemService(AlarmManager.class);
        if (manager == null) return;
        manager.cancel(pending(context, CODE_LIGHT, "light"));
        manager.cancel(pending(context, CODE_RING, "ring"));
    }

    private static void clear(Context context) {
        prefs(context).edit().clear().apply();
    }

    private static PendingIntent pending(Context context, int code, String phase) {
        Intent intent = new Intent(context, AlarmReceiver.class).setAction(ACTION).putExtra(EXTRA_PHASE, phase);
        return PendingIntent.getBroadcast(context, code, intent, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
    }

    private static SharedPreferences prefs(Context context) {
        return context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }
}

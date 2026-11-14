package de.scarhand.morgenlicht;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.PowerManager;

import java.util.Locale;

/**
 * Kommt zum Lichtbeginn und zur Weckzeit an. Öffnet die App über dem Sperrbildschirm
 * (Vollbild-Benachrichtigung); die Seite startet dann Licht und Ton von selbst.
 */
public class AlarmReceiver extends BroadcastReceiver {
    private static final String CHANNEL = "wecker";
    private static final int NOTIFICATION_ID = 7;

    @Override
    public void onReceive(Context context, Intent intent) {
        String phase = intent.getStringExtra(AlarmScheduler.EXTRA_PHASE);
        if (phase == null) phase = "ring";

        // Kurz wach bleiben, bis die App im Vordergrund ist
        PowerManager power = context.getSystemService(PowerManager.class);
        if (power != null) {
            power.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "morgenlicht:alarm").acquire(60_000L);
        }

        NotificationManager manager = context.getSystemService(NotificationManager.class);
        if (manager == null) return;
        boolean german = "de".equals(Locale.getDefault().getLanguage());
        NotificationChannel channel = new NotificationChannel(CHANNEL, german ? "Wecker" : "Alarm", NotificationManager.IMPORTANCE_HIGH);
        channel.setDescription(german ? "Startet Sonnenaufgang und Weckton" : "Starts the sunrise and the alarm sound");
        channel.setSound(null, null);
        channel.enableVibration(false);
        channel.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
        manager.createNotificationChannel(channel);

        Intent open = new Intent(context, MainActivity.class)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP)
                .putExtra(AlarmScheduler.EXTRA_PHASE, phase);
        PendingIntent pending = PendingIntent.getActivity(context, "ring".equals(phase) ? 22 : 21, open,
                PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);

        Notification notification = new Notification.Builder(context, CHANNEL)
                .setSmallIcon(android.R.drawable.ic_lock_idle_alarm)
                .setContentTitle("Sunrise Clock")
                .setContentText("ring".equals(phase)
                        ? (german ? "Zeit aufzuwachen" : "Time to wake up")
                        : (german ? "Der Sonnenaufgang beginnt" : "The sunrise is starting"))
                .setCategory(Notification.CATEGORY_ALARM)
                .setVisibility(Notification.VISIBILITY_PUBLIC)
                .setAutoCancel(true)
                .setContentIntent(pending)
                .setFullScreenIntent(pending, true)
                .build();
        manager.notify(NOTIFICATION_ID, notification);

        // Ist die App schon sichtbar oder darf sie starten, geht es ohne Umweg
        try {
            context.startActivity(open);
        } catch (RuntimeException ignored) {
        }
    }
}

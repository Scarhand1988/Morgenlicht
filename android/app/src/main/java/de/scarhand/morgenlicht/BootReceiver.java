package de.scarhand.morgenlicht;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/** Plant den gestellten Wecker nach Neustart, Zeitänderung oder App-Update neu. */
public class BootReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        AlarmScheduler.restore(context);
    }
}

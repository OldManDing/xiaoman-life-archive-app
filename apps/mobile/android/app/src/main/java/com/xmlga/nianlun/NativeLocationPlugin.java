package com.xmlga.nianlun;

import android.Manifest;
import android.content.Context;
import android.content.pm.PackageManager;
import android.location.Location;
import android.location.LocationListener;
import android.location.LocationManager;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;

import androidx.annotation.NonNull;
import androidx.core.content.ContextCompat;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Locale;
import java.util.concurrent.atomic.AtomicBoolean;

@CapacitorPlugin(
    name = "NativeLocation",
    permissions = {
        @Permission(
            alias = "location",
            strings = {
                Manifest.permission.ACCESS_FINE_LOCATION,
                Manifest.permission.ACCESS_COARSE_LOCATION
            }
        )
    }
)
public class NativeLocationPlugin extends Plugin {
    private static final float REQUIRED_ACCURACY_METERS = 10.0f;
    private static final long LOCATION_TIMEOUT_MS = 15000L;
    private static final long MAX_LAST_KNOWN_AGE_MS = 120000L;

    @PluginMethod
    public void getCurrentPosition(PluginCall call) {
        if (!hasAnyLocationPermission()) {
            requestPermissionForAlias("location", call, "locationPermissionCallback");
            return;
        }

        if (!hasFineLocationPermission()) {
            call.reject("precise location permission required");
            return;
        }

        resolveCurrentPosition(call);
    }

    @PermissionCallback
    private void locationPermissionCallback(PluginCall call) {
        if (!hasAnyLocationPermission()) {
            call.reject("location permission denied");
            return;
        }

        if (!hasFineLocationPermission()) {
            call.reject("precise location permission required");
            return;
        }

        resolveCurrentPosition(call);
    }

    private void resolveCurrentPosition(PluginCall call) {
        if (!hasAnyLocationPermission()) {
            call.reject("location permission denied");
            return;
        }

        if (!hasFineLocationPermission()) {
            call.reject("precise location permission required");
            return;
        }

        LocationManager locationManager = (LocationManager) getContext().getSystemService(Context.LOCATION_SERVICE);
        if (locationManager == null) {
            call.reject("location service unavailable");
            return;
        }

        Location lastKnownLocation = findBestLastKnownLocation(locationManager);
        if (isFresh(lastKnownLocation) && hasRequiredAccuracy(lastKnownLocation)) {
            call.resolve(locationToResult(lastKnownLocation));
            return;
        }

        List<String> providers = findEnabledProviders(locationManager);
        if (providers.isEmpty()) {
            call.reject("location service disabled");
            return;
        }

        Handler handler = new Handler(Looper.getMainLooper());
        AtomicBoolean settled = new AtomicBoolean(false);
        final Location[] bestLocation = new Location[] { isFresh(lastKnownLocation) ? lastKnownLocation : null };
        final Runnable[] timeoutTask = new Runnable[1];

        LocationListener listener = new LocationListener() {
            @Override
            public void onLocationChanged(@NonNull Location location) {
                if (settled.get()) {
                    return;
                }

                boolean accurateEnough;
                synchronized (bestLocation) {
                    if (isFresh(location) && isBetterLocation(location, bestLocation[0])) {
                        bestLocation[0] = location;
                    }
                    accurateEnough = isFresh(location) && hasRequiredAccuracy(location);
                }

                if (!accurateEnough || !settled.compareAndSet(false, true)) {
                    return;
                }

                handler.removeCallbacks(timeoutTask[0]);
                locationManager.removeUpdates(this);
                call.resolve(locationToResult(location));
            }

            @Override
            public void onStatusChanged(String provider, int status, Bundle extras) {
                // Required by older Android versions.
            }

            @Override
            public void onProviderEnabled(@NonNull String provider) {
                // No-op.
            }

            @Override
            public void onProviderDisabled(@NonNull String provider) {
                // The timeout path reports failure when no precise fix arrives.
            }
        };

        timeoutTask[0] = () -> {
            if (!settled.compareAndSet(false, true)) {
                return;
            }
            locationManager.removeUpdates(listener);

            Location candidate;
            synchronized (bestLocation) {
                candidate = bestLocation[0];
            }
            if (candidate != null && isFresh(candidate) && hasRequiredAccuracy(candidate)) {
                call.resolve(locationToResult(candidate));
                return;
            }
            if (candidate != null && candidate.hasAccuracy()) {
                call.reject("location accuracy insufficient: " + formatAccuracy(candidate.getAccuracy()) + "m");
                return;
            }
            call.reject("location timeout");
        };

        int requestedProviderCount = 0;
        for (String provider : providers) {
            try {
                locationManager.requestLocationUpdates(provider, 0L, 0.0f, listener, Looper.getMainLooper());
                requestedProviderCount++;
            } catch (SecurityException ignored) {
                // Permission may have been revoked while the request was starting.
            } catch (IllegalArgumentException ignored) {
                // Provider is not available on this device.
            }
        }

        if (requestedProviderCount == 0) {
            call.reject("location provider unavailable");
            return;
        }

        handler.postDelayed(timeoutTask[0], LOCATION_TIMEOUT_MS);
    }

    private boolean hasAnyLocationPermission() {
        return ContextCompat.checkSelfPermission(getContext(), Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED ||
            ContextCompat.checkSelfPermission(getContext(), Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED;
    }

    private boolean hasFineLocationPermission() {
        return ContextCompat.checkSelfPermission(getContext(), Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED;
    }

    private boolean hasRequiredAccuracy(Location location) {
        return location != null && location.hasAccuracy() && location.getAccuracy() >= 0.0f && location.getAccuracy() <= REQUIRED_ACCURACY_METERS;
    }

    private String formatAccuracy(float accuracy) {
        if (accuracy == Math.round(accuracy)) {
            return String.valueOf(Math.round(accuracy));
        }
        return String.format(Locale.US, "%.1f", accuracy);
    }

    private List<String> findEnabledProviders(LocationManager locationManager) {
        List<String> providers = Arrays.asList(
            LocationManager.GPS_PROVIDER,
            LocationManager.NETWORK_PROVIDER
        );
        List<String> enabledProviders = new ArrayList<>();

        for (String provider : providers) {
            try {
                if (locationManager.isProviderEnabled(provider)) {
                    enabledProviders.add(provider);
                }
            } catch (Exception ignored) {
                // Some Android builds throw for unavailable providers.
            }
        }

        return enabledProviders;
    }

    private Location findBestLastKnownLocation(LocationManager locationManager) {
        Location bestLocation = null;
        List<String> providers = Arrays.asList(
            LocationManager.GPS_PROVIDER,
            LocationManager.NETWORK_PROVIDER,
            LocationManager.PASSIVE_PROVIDER
        );

        for (String provider : providers) {
            try {
                Location location = locationManager.getLastKnownLocation(provider);
                if (isFresh(location) && isBetterLocation(location, bestLocation)) {
                    bestLocation = location;
                }
            } catch (SecurityException ignored) {
                return null;
            } catch (IllegalArgumentException ignored) {
                // Provider is not present on this device.
            }
        }

        return bestLocation;
    }

    private boolean isFresh(Location location) {
        if (location == null) return false;
        long age = System.currentTimeMillis() - location.getTime();
        return age >= 0L && age <= MAX_LAST_KNOWN_AGE_MS;
    }

    private boolean isBetterLocation(Location candidate, Location currentBest) {
        if (candidate == null) return false;
        if (currentBest == null) return true;

        if (candidate.hasAccuracy() && !currentBest.hasAccuracy()) return true;
        if (!candidate.hasAccuracy()) return false;

        boolean moreAccurate = candidate.getAccuracy() < currentBest.getAccuracy();
        boolean equallyAccurateAndNewer = candidate.getAccuracy() == currentBest.getAccuracy() && candidate.getTime() > currentBest.getTime();
        return moreAccurate || equallyAccurateAndNewer;
    }

    private JSObject locationToResult(Location location) {
        JSObject result = new JSObject();
        result.put("latitude", location.getLatitude());
        result.put("longitude", location.getLongitude());
        result.put("accuracy", location.hasAccuracy() ? location.getAccuracy() : null);
        result.put("provider", location.getProvider());
        result.put("timestamp", location.getTime());
        return result;
    }
}

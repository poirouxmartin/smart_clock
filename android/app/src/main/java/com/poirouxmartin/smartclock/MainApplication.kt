package com.poirouxmartin.smartclock

import android.app.Application
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.res.Configuration
import android.os.UserManager

import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactNativeApplicationEntryPoint.loadReactNative
import com.facebook.react.ReactPackage
import com.facebook.react.ReactHost
import com.facebook.react.common.ReleaseLevel
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint

import expo.modules.ApplicationLifecycleDispatcher
import expo.modules.ExpoReactHostFactory

class MainApplication : Application(), ReactApplication {

  override val reactHost: ReactHost by lazy {
    ExpoReactHostFactory.getDefaultReactHost(
      context = applicationContext,
      packageList =
        PackageList(this).packages.apply {
          // Packages that cannot be autolinked yet can be added manually here, for example:
          // add(MyReactNativePackage())
        }
    )
  }

  private var reactLoaded = false

  override fun onCreate() {
    super.onCreate()
    // Alarm components are direct-boot aware: after a night reboot the process can start
    // before the first unlock, when React Native cannot touch its credential-protected files.
    // The alarm side is native only, so React Native waits for the unlock.
    if (getSystemService(UserManager::class.java)?.isUserUnlocked != false) {
      ensureReactLoaded()
    } else {
      registerReceiver(object : BroadcastReceiver() {
        override fun onReceive(context: Context, intent: Intent) {
          unregisterReceiver(this)
          ensureReactLoaded()
        }
      }, IntentFilter(Intent.ACTION_USER_UNLOCKED))
    }
  }

  @Synchronized
  fun ensureReactLoaded() {
    if (reactLoaded) return
    reactLoaded = true
    DefaultNewArchitectureEntryPoint.releaseLevel = try {
      ReleaseLevel.valueOf(BuildConfig.REACT_NATIVE_RELEASE_LEVEL.uppercase())
    } catch (e: IllegalArgumentException) {
      ReleaseLevel.STABLE
    }
    loadReactNative(this)
    ApplicationLifecycleDispatcher.onApplicationCreate(this)
  }

  override fun onConfigurationChanged(newConfig: Configuration) {
    super.onConfigurationChanged(newConfig)
    if (reactLoaded) ApplicationLifecycleDispatcher.onConfigurationChanged(this, newConfig)
  }
}

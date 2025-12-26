# Capacitor Plugin Integration Guide - Complete Solution

## Overview

This guide provides a comprehensive process for integrating and troubleshooting Capacitor plugins in iOS, Android, and web environments. It covers the complete plugin lifecycle from installation to verification.

## Problem Statement

When implementing Capacitor plugins (Dialog, Device, Geolocation, etc.), developers often encounter platform-specific errors:

```
[warn] - Plugin not available: {"code":"UNIMPLEMENTED"}
[error] - ERROR: Plugin is not implemented
```

These errors typically occur because the plugin is installed on the web side but the native platform hasn't been properly synchronized or the native dependencies haven't been installed.

## Root Cause Analysis

Capacitor plugins require synchronization across **three separate environments**:

```
┌─────────────────────────────────────────────────────┐
│          Web Environment (Angular/React)            │
│              (npm packages)                          │
│  ✓ Installed via: npm install @capacitor/plugin    │
└────────────────────────┬────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────┐
│      Capacitor Configuration Layer                  │
│      (capacitor.config.ts/json)                     │
│  ✓ Plugin registration                             │
│  ✓ Platform-specific settings                      │
└────────────────────────┬────────────────────────────┘
                         │
          ┌──────────────┴──────────────┐
          ▼                             ▼
   ┌─────────────┐            ┌─────────────────┐
   │ iOS         │            │ Android         │
   │ (CocoaPods) │            │ (Gradle)        │
   │ ✓ Pod files │            │ ✓ AAR files     │
   │ ✓ Podfile   │            │ ✓ build.gradle  │
   │ ✓ Swift src │            │ ✓ Java src      │
   └─────────────┘            └─────────────────┘
```

**Common Issues:**
1. ✗ Plugin installed but `npx cap sync` not run
2. ✗ Sync completed but CocoaPods/Gradle dependencies not installed
3. ✗ Dependencies installed but Xcode/Android Studio not rebuilt
4. ✗ Platform configuration missing from `capacitor.config.ts`
5. ✗ Info.plist or AndroidManifest.xml blocking plugin access

## Complete Solution Process

### Phase 1: Web Environment Setup

#### 1.1 Install the Plugin

```bash
npm install @capacitor/plugin-name
```

**Examples:**
```bash
npm install @capacitor/dialog
npm install @capacitor/device
npm install @capacitor/geolocation
npm install @capacitor/camera
```

#### 1.2 Update Capacitor Configuration

**File**: `capacitor.config.ts` or `capacitor.config.json`

Add platform-specific configuration if needed:

```typescript
import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.example.app',
  appName: 'Example App',
  webDir: 'www',
  
  // Platform-specific settings
  ios: {
    limitsNavigationsToAppBoundDomains: true,
    // Add iOS-specific plugin configurations here
  },
  
  android: {
    allowMixedContent: true,
    // Add Android-specific plugin configurations here
  },
};

export default config;
```

#### 1.3 Import and Use in Code

```typescript
import { SomePlugin } from '@capacitor/plugin-name';

async function usePlugin(): Promise<void> {
  try {
    const result = await SomePlugin.method({
      option: 'value',
    });
    console.log('Success:', result);
  } catch (error) {
    console.warn('Plugin not available, using fallback:', error);
    // Fallback implementation here
  }
}
```

### Phase 2: Platform Synchronization

#### 2.1 Update Capacitor Platforms

Update the platform packages to latest versions:

```bash
npx cap update ios
npx cap update android
```

#### 2.2 Synchronize Plugin to Native Projects

This critical step copies plugin files to native projects:

```bash
# Sync all platforms
npx cap sync

# Or sync specific platform
npx cap sync ios
npx cap sync android
```

**What this does:**
- Copies web build files to native projects
- Registers plugins in native bridge
- Updates platform-specific configurations
- Creates/updates project files (Podfile, build.gradle, etc.)

#### 2.3 Verify Synchronization

Check that the plugin was added to native build files:

**For iOS:**
```bash
grep -i "PluginName" ios/App/Podfile
# Should show: pod 'CapacitorPluginName', :path => '../../node_modules/@capacitor/plugin-name'
```

**For Android:**
```bash
grep -i "pluginname" android/build.gradle
# Should reference the plugin package
```

### Phase 3: Install Native Dependencies

#### 3.1 iOS Dependencies (CocoaPods)

**Run on host machine where CocoaPods is installed:**

```bash
cd ios/App

# Install/update pods with repository update
pod install --repo-update

# Optional: Update pod repository separately
pod repo update

# Optional: Clean CocoaPods cache if issues persist
pod cache clean --all
cd ../../
```

**What this does:**
- Downloads native plugin code (Swift files)
- Downloads all plugin dependencies
- Installs into iOS project
- Updates `Podfile.lock`
- Creates `.xcworkspace` file

#### 3.2 Android Dependencies (Gradle)

**Run on host machine:**

```bash
cd android

# Sync Gradle dependencies
./gradlew build

# Or if you have issues:
./gradlew clean build
cd ..
```

**What this does:**
- Downloads plugin AAR (Android Archive) files
- Downloads all plugin dependencies
- Compiles native plugin code
- Updates gradle caches

### Phase 4: Rebuild Native Projects

#### 4.1 iOS Rebuild

**In Xcode:**
```
Product → Clean Build Folder (⌘⇧K)
Product → Build (⌘B)
```

**Or from terminal:**
```bash
xcodebuild clean -workspace ios/App/App.xcworkspace -scheme App
xcodebuild -workspace ios/App/App.xcworkspace -scheme App -configuration Debug
```

#### 4.2 Android Rebuild

**In Android Studio:**
```
Build → Clean Project
Build → Make Project
```

**Or from terminal:**
```bash
cd android
./gradlew clean build
cd ..
```

### Phase 5: Build and Test Web Assets

```bash
# Build web assets
npm run build

# For development with hot reload (if available)
npm run watch
```

## Implementation Pattern: Plugin with Fallback

Use this pattern for any Capacitor plugin to ensure cross-platform compatibility:

```typescript
import { SomePlugin } from '@capacitor/plugin-name';
import { HttpClient } from '@angular/common/http'; // For fallback

export class MyService {
  constructor(private http: HttpClient) {}

  async performAction(): Promise<any> {
    try {
      // Try native plugin first
      const result = await SomePlugin.method({
        param: 'value',
      });
      console.log('Native plugin success:', result);
      return result;
    } catch (error: any) {
      // Log the error for debugging
      console.warn('Native plugin failed:', error);

      // Fallback to web implementation
      if (error?.code === 'UNIMPLEMENTED') {
        console.log('Plugin not available, using web fallback');
        return this.webImplementation();
      }

      throw error;
    }
  }

  private webImplementation(): any {
    // Your web-based fallback logic
    return {};
  }
}
```

## Troubleshooting Common Issues

### Issue 1: Plugin Still Returns UNIMPLEMENTED After pod install

**Causes:**
- Xcode build cache not cleared
- CocoaPods cache issue
- Plugin not properly registered

**Solutions:**
```bash
# Clean everything and rebuild
cd ios/App
rm -rf Pods Podfile.lock
pod install --repo-update
cd ../..

# Clean Xcode cache
xcodebuild clean -workspace ios/App/App.xcworkspace -scheme App

# Rebuild
npm run build
xcodebuild -workspace ios/App/App.xcworkspace -scheme App -configuration Debug
```

### Issue 2: Plugin Works on Web but Not on Device

**Causes:**
- Plugin not synced to native project
- Capacitor config not updated
- Device-specific permissions missing

**Solutions:**
```bash
# Re-sync everything
npx cap sync ios
npx cap sync android

# Check platform configurations
cat capacitor.config.ts

# Check native permissions (Info.plist for iOS)
cat ios/App/App/Info.plist

# Verify plugin is registered in native bridge
```

### Issue 3: CocoaPods Installation Fails

**Causes:**
- Pod repository issue
- Network connectivity
- Incompatible Capacitor version

**Solutions:**
```bash
# Update pod repository
pod repo update

# Try installation again
cd ios/App
pod install --repo-update --verbose

# If still failing, try specific repository
pod install --sources='https://github.com/CocoaPods/Specs.git'
```

### Issue 4: Android Gradle Sync Fails

**Causes:**
- Gradle cache corruption
- Incompatible dependencies
- Network issues

**Solutions:**
```bash
cd android
./gradlew --stop
rm -rf .gradle
./gradlew clean build --refresh-dependencies
cd ..
```

## Advanced: Simulator-Incompatible Plugins

Some Capacitor plugins contain native code that is only compiled for physical device architectures (e.g., `arm64`, `armv7s`) and lack simulator architectures (`x86_64`, `arm64e`). This causes build failures when attempting to run simulator builds in CI.

### Example: capacitor-thermal-printer

The `capacitor-thermal-printer` plugin includes a vendored static library (`libRTPrinterSDK.a`) that does not have simulator slices, causing linker errors during simulator builds:

```
ld: building for iOS Simulator, but linking in object file built for iOS
```

### Solution: Conditional Pod Installation + Plugin Registration

#### Step 1: Add Environment Variable Gate to Podfile

**File**: `ios/App/Podfile`

Wrap the plugin pod in a conditional check that respects an environment variable:

```ruby
def capacitor_pods
  pod 'Capacitor', :path => '../../node_modules/@capacitor/ios'
  # ... other pods ...
  pod 'CapacitorStatusBar', :path => '../../node_modules/@capacitor/status-bar'
  
  # Only install thermal printer for device builds (not simulator)
  if ENV.fetch('CAPACITOR_THERMAL_PRINTER_ENABLED', '1') == '1'
    pod 'CapacitorThermalPrinter', :path => '../../node_modules/capacitor-thermal-printer'
  end
end
```

**Key points:**
- Default value is `'1'` (enabled), so local device builds work without any env var setup
- Set to `'0'` in simulator builds to skip the pod entirely, preventing linker errors
- The env var name should be descriptive: `CAPACITOR_{PLUGIN_NAME}_ENABLED`

#### Step 2: Exclude Plugin from CocoaPods in CI Simulator Build

**File**: `Jenkinsfile` (or your CI configuration)

Before running `pod install` in the simulator build stage, export the environment variable:

```groovy
echo "--- Installing CocoaPods Dependencies (Simulator) ---"
dir('ios/App') {
    sh '''
        export CAPACITOR_THERMAL_PRINTER_ENABLED=0
        pod install
    '''
}
```

#### Step 3: Remove Plugin from Capacitor Runtime Registry (Optional but Recommended)

After `npx cap sync ios`, remove the plugin class from the `packageClassList` in the generated `capacitor.config.json` to prevent registration attempts:

```groovy
echo "--- Removing Thermal Printer from Plugin Registry (Simulator) ---"
sh '''
    if [ -f "ios/App/App/capacitor.config.json" ]; then
        node -e "
        const fs = require('fs');
        const path = 'ios/App/App/capacitor.config.json';
        const config = JSON.parse(fs.readFileSync(path, 'utf8'));
        if (config.ios && config.ios.capacitorPlugins) {
          config.ios.capacitorPlugins.packageClassList = config.ios.capacitorPlugins.packageClassList.filter(p => p !== 'CapacitorThermalPrinterPlugin');
          fs.writeFileSync(path, JSON.stringify(config, null, 2));
          console.log('Removed CapacitorThermalPrinterPlugin from packageClassList');
        }
        "
    else
        echo "capacitor.config.json not found, skipping plugin registry patch"
    fi
'''
```

### Result

- **Local Xcode device builds**: Plugin is enabled and available (env var defaults to `'1'`)
- **CI simulator builds**: Plugin is excluded from both CocoaPods linking and Capacitor runtime registration
- **No app code changes**: If your app already implements fallback handling for unavailable plugins, no changes are needed
- **No impact on device CI builds**: Only the simulator stage sets the env var; device/archive stages remain unchanged

### Implementation Example

Use this pattern in your app code to gracefully handle plugins that may not be available on simulator:

```typescript
import { ThermalPrinterPlugin } from 'capacitor-thermal-printer';

export class PrinterService {
  async printReceipt(data: string): Promise<void> {
    try {
      // Try native plugin first
      await ThermalPrinterPlugin.print({ content: data });
      console.log('Printed via thermal printer');
    } catch (error: any) {
      // Fallback for simulator or when plugin is unavailable
      if (error?.code === 'UNIMPLEMENTED') {
        console.warn('Thermal printer unavailable (simulator?), using print preview instead');
        this.showPrintPreview(data);
      } else {
        throw error;
      }
    }
  }

  private showPrintPreview(data: string): void {
    // Web-based fallback (e.g., window.print())
    const printWindow = window.open('', '', 'height=400,width=600');
    if (printWindow) {
      printWindow.document.write('<pre>' + data + '</pre>');
      printWindow.print();
    }
  }
}
```

### Applying to Other Device-Only Plugins

This pattern can be applied to any native plugin with device-only libraries. Simply:

1. Replace `CAPACITOR_THERMAL_PRINTER_ENABLED` with `CAPACITOR_{PLUGIN_NAME}_ENABLED`
2. Replace `CapacitorThermalPrinter` with your plugin pod name
3. Replace `CapacitorThermalPrinterPlugin` with the actual plugin class name
4. Ensure your app handles the `UNIMPLEMENTED` error gracefully

## Verification Checklist

Before considering the plugin ready:

- [ ] Plugin installed: `npm list @capacitor/plugin-name`
- [ ] `capacitor.config.ts` updated with platform settings
- [ ] `npx cap sync` run successfully
- [ ] iOS: `pod install --repo-update` completed without errors
- [ ] Android: `./gradlew build` completed without errors
- [ ] Xcode: Clean build folder and rebuild completed
- [ ] Android Studio: Clean project and rebuild completed
- [ ] Web app: `npm run build` successful
- [ ] Plugin appears in Podfile (iOS)
- [ ] Plugin appears in build.gradle (Android)
- [ ] No UNIMPLEMENTED errors in console
- [ ] Native dialog/feature works on device
- [ ] Fallback works on web development server

## Quick Reference Commands

```bash
# Install plugin
npm install @capacitor/plugin-name

# Update platforms
npx cap update

# Sync plugins
npx cap sync

# iOS CocoaPods (host machine)
cd ios/App && pod install --repo-update && cd ../..

# Android Gradle
cd android && ./gradlew build && cd ..

# Build web
npm run build

# Full iOS rebuild
xcodebuild clean -workspace ios/App/App.xcworkspace -scheme App
xcodebuild -workspace ios/App/App.xcworkspace -scheme App -configuration Debug

# Full clean on iOS
cd ios/App && rm -rf Pods Podfile.lock && pod install && cd ../..
```

## Platform-Specific Configuration Reference

### iOS (capacitor.config.ts)

```typescript
ios: {
  // Allow WebView to access native plugins
  limitsNavigationsToAppBoundDomains: true,
  
  // Custom schemes if needed
  scheme: 'capacitor',
  
  // App-bound domains
  limitsNavigationsToAppBoundDomains: true,
}
```

### Android (capacitor.config.ts)

```typescript
android: {
  // Allow mixed HTTP/HTTPS content
  allowMixedContent: true,
  
  // Plugin-specific settings
  plugins: {
    PluginName: {
      setting: 'value',
    },
  },
}
```

## Resources and Documentation

- [Capacitor Official Documentation](https://capacitorjs.com/docs)
- [Capacitor iOS Troubleshooting](https://capacitorjs.com/docs/ios/troubleshooting)
- [Capacitor Android Troubleshooting](https://capacitorjs.com/docs/android/troubleshooting)
- [CocoaPods Documentation](https://cocoapods.org/)
- [Gradle Documentation](https://gradle.org/documentation/)
- [Xcode Build Documentation](https://developer.apple.com/documentation/xcode)

## Summary

Successfully integrating a Capacitor plugin requires:

1. **Web Setup**: Install package, update config, import in code
2. **Sync**: Run `npx cap sync` to register with native projects
3. **Install Dependencies**: `pod install` (iOS), `gradle build` (Android)
4. **Rebuild**: Clean and rebuild native projects
5. **Test**: Verify on device and web
6. **Fallback**: Implement error handling for cross-platform compatibility

Following this process ensures plugins work reliably across all platforms.

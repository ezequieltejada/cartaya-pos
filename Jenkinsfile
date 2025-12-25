pipeline {
    agent none

    tools {
        nodejs 'nodejs'
    }

    stages {
        // -------------------------------------------------------------------------
        // Stage 0: Environment Checks (Fail-Fast)
        // -------------------------------------------------------------------------
        stage('Environment Checks') {
            agent { label 'linux' }

            steps {
                script {
                    echo "--- Checking Build Environment ---"
                    sh 'node -v && npm -v'
                    sh 'java -version 2>&1 || echo "Java not required for web build"'

                    // Helpful diagnostics for Android builds on Linux agents
                    sh 'echo "ANDROID_SDK_ROOT=${ANDROID_SDK_ROOT:-}" && echo "ANDROID_HOME=${ANDROID_HOME:-}"'
                }
            }
        }

        // -------------------------------------------------------------------------
        // Stage 1: Build Web Assets (Angular/Ionic)
        // -------------------------------------------------------------------------
        stage('Build Web App') {
            agent { label 'linux' } // Uses the Linux (amd64) agent

            steps {
                dir('cartayaPos') {
                    script {
                        echo "--- Installing Dependencies ---"
                        sh 'npm install'

                        echo "--- Building Angular App ---"
                        // Generates the 'www' directory
                        sh 'npm run build'
                    }
                    
                    // Stash the compiled web assets to share with the native build stages.
                    // We do NOT stash node_modules because architectures differ (Linux vs Mac).
                    stash includes: 'www/**', name: 'web-dist'
                    stash includes: 'package.json, package-lock.json, capacitor.config.ts', name: 'config-files'
                }
            }
        }

        // -------------------------------------------------------------------------
        // Stage 2: Parallel Native Builds (Android & iOS)
        // -------------------------------------------------------------------------
        stage('Native Builds') {
            parallel {
                
                // --- Android Build (Linux Agent) ---
                stage('Android (APK)') {
                    agent { label 'linux' }

                    environment {
                        // Prefer Jenkins-managed ANDROID_SDK_ROOT/ANDROID_HOME, otherwise fall back to the repo default.
                        ANDROID_SDK_ROOT = "${env.ANDROID_HOME ?: '/home/circleci/android-sdk'}"
                        ANDROID_HOME = "${env.ANDROID_HOME ?: '/home/circleci/android-sdk'}"
                    }

                    steps {
                        dir('cartayaPos') {
                            script {
                                echo "--- Preparing Android Workspace ---"
                                // Unstash configuration to ensure consistency
                                unstash 'config-files'
                                unstash 'web-dist'

                                // Ensure the Android SDK is discoverable by Gradle on the Linux agent.
                                // The failure in build #16 was: "SDK location not found".
                                echo "--- Validating Android SDK Environment ---"
                                sh '''
                                    # Check if SDK exists
                                    if [ ! -d "$ANDROID_SDK_ROOT" ]; then
                                        echo "ERROR: Android SDK not found at $ANDROID_SDK_ROOT"
                                        echo "Current user: $(whoami)"
                                        exit 1
                                    fi
                                    echo "✓ Android SDK found at: $ANDROID_SDK_ROOT"
                                    echo "Checking SDK permissions..."
                                    stat "$ANDROID_SDK_ROOT" || true
                                '''
                                
                                dir('android') {
                                    sh '''
                                        cat > local.properties <<'EOF'
sdk.dir=/home/circleci/android-sdk
EOF
                                    '''
                                    echo "✓ local.properties created with SDK path"
                                }

                                // Install dependencies (needed for Capacitor CLI)
                                sh 'npm ci'

                                echo "--- Syncing Capacitor Android ---"
                                sh 'npx cap sync android'

                                echo "--- Creating Debug Keystore & Properties ---"
                                dir('android') {
                                    // Create a debug keystore (if it doesn't exist) for signing Debug APK
                                    // This prevents the "path may not be null" error in build.gradle:27
                                    sh '''
                                        if [ ! -f app/debug.keystore ]; then
                                            echo "Generating debug keystore..."
                                            keytool -genkey -v -keystore app/debug.keystore \
                                                -keyalg RSA -keysize 2048 -validity 10000 \
                                                -alias androiddebugkey -keypass android -storepass android \
                                                -dname "CN=Android Debug,O=Android,C=US"
                                        else
                                            echo "Debug keystore already exists."
                                        fi
                                    '''
                                    
                                    // Create keystore.properties pointing to the debug keystore
                                    sh '''
                                        cat > keystore.properties <<EOF
storeFile=app/debug.keystore
storePassword=android
keyAlias=androiddebugkey
keyPassword=android
EOF
                                    '''
                                }

                                echo "--- Building Debug APK ---"
                                dir('android') {
                                    // Ensure Gradle wrapper is executable
                                    sh 'chmod +x gradlew'
                                    // Build Debug APK (no signing config requirements for Debug)
                                    sh './gradlew :app:assembleDebug --no-daemon --stacktrace'
                                }
                            }
                        }
                    }
                    post {
                        success {
                            // Archive the APK for download
                            // Note: We need to match the path relative to workspace root, so we prepend cartayaPos/
                            archiveArtifacts artifacts: 'cartayaPos/android/app/build/outputs/apk/debug/*.apk', fingerprint: true
                        }
                        failure {
                            echo "Android build failed."
                        }
                    }
                }

                // --- iOS Build (Mac Agent) ---
                stage('iOS (Simulator)') {
                    agent { label 'mac' } // Uses the Mac OS X (aarch64) agent

                    steps {
                        script {
                            echo "--- Preparing iOS Workspace ---"
                            // Clean checkout on the new agent
                            checkout scm
                            
                            dir('cartayaPos') {
                                unstash 'config-files'
                                unstash 'web-dist'

                                // The iOS failure in build #16 was during `npx cap sync ios` when it ran:
                                // `xcodebuild -project App.xcodeproj clean`
                                // and Xcode refused to delete `ios/App/build` because it wasn't created by the build system.
                                // Clear it proactively so `cap sync` can clean safely.
                                dir('ios/App') {
                                    sh 'rm -rf build || true'
                                }

                                // Install dependencies (recompiles native modules for M1/M2)
                                sh 'npm ci'

                                echo "--- Syncing Capacitor iOS ---"
                                // Updates native ios project with web assets and plugins
                                sh 'npx cap sync ios'

                                echo "--- Installing CocoaPods Dependencies ---"
                                dir('ios/App') {
                                    sh 'pod install'
                                }

                                echo "--- Building iOS Simulator App ---"
                                dir('ios/App') {
                                    // Xcode 26.2 with explicit simulator SDK and destination.
                                    // -sdk iphonesimulator: force simulator SDK (overrides device-only SDKROOT settings)
                                    // -destination: specify explicit simulator (iPhone 15 is widely available in Xcode 26.2)
                                    // Add arm64e exclusion if needed for older simulators on Apple Silicon
                                    sh '''
                                        set -e
                                        echo "Available simulators:"
                                        xcrun simctl list devices available || true
                                        
                                        echo ""
                                        echo "Building for simulator..."
                                        xcodebuild -workspace App.xcworkspace \
                                            -scheme App \
                                            -configuration Debug \
                                            -sdk iphonesimulator \
                                            -destination 'platform=iOS Simulator,name=iPhone 16' \
                                            -derivedDataPath build \
                                            clean build
                                     '''
                                }

                                echo "--- Zipping App Bundle ---"
                                // The .app bundle is a directory, so we zip it for the artifact
                                dir('ios/App/build/Build/Products/Debug-iphonesimulator') {
                                    sh 'zip -r App-Simulator.zip App.app'
                                }
                            }
                        }
                    }
                    post {
                        success {
                            archiveArtifacts artifacts: 'cartayaPos/ios/App/build/Build/Products/Debug-iphonesimulator/App-Simulator.zip', fingerprint: true
                        }
                        failure {
                            echo "iOS build failed. Collecting diagnostics..."
                            dir('cartayaPos/ios/App') {
                                sh '''
                                    echo "=== Xcode Version ==="
                                    xcodebuild -version
                                    echo ""
                                    echo "=== Available Simulators ==="
                                    xcrun simctl list devices available || true
                                    echo ""
                                    echo "=== Workspace Info ==="
                                    xcodebuild -list -workspace App.xcworkspace || true
                                    echo ""
                                    echo "=== Pod Status ==="
                                    ls -la Pods/ || echo "Pods directory not found"
                                ''' as String
                            }
                        }
                    }
                }
            }
        }
    }

    // Global Post-Build Actions
    post {
        always {
            echo "Pipeline completed."
        }
    }
}

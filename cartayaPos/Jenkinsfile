pipeline {
    agent none

    environment {
        // --- Global Environment Variables ---
        // Adjust these as needed for your specific setup
        // NODE_ENV = 'production' (Optional: forces production build behavior in some tools)
    }

    stages {
        // -------------------------------------------------------------------------
        // Stage 1: Build Web Assets (Angular/Ionic)
        // -------------------------------------------------------------------------
        stage('Build Web App') {
            agent { label 'linux' } // Uses the Linux (amd64) agent
            
            environment {
                // Ensure the path includes standard locations if needed, or rely on agent config
                // PATH = "/usr/local/bin:$PATH" 
            }

            steps {
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

        // -------------------------------------------------------------------------
        // Stage 2: Parallel Native Builds (Android & iOS)
        // -------------------------------------------------------------------------
        stage('Native Builds') {
            parallel {
                
                // --- Android Build (Linux Agent) ---
                stage('Android (APK)') {
                    agent { label 'linux' }
                    
                    environment {
                        // Ensure JAVA_HOME and ANDROID_HOME are set on the agent or here
                        // JAVA_HOME = "/path/to/java"
                    }

                    steps {
                        script {
                            echo "--- Preparing Android Workspace ---"
                            // Unstash configuration to ensure consistency
                            unstash 'config-files'
                            unstash 'web-dist'

                            // Install dependencies (needed for Capacitor CLI)
                            sh 'npm ci'

                            echo "--- Syncing Capacitor Android ---"
                            sh 'npx cap sync android'

                            echo "--- Building APK ---"
                            dir('android') {
                                // Ensure Gradle wrapper is executable
                                sh 'chmod +x gradlew'
                                // Build Debug APK
                                sh './gradlew assembleDebug'
                            }
                        }
                    }
                    post {
                        success {
                            // Archive the APK for download
                            archiveArtifacts artifacts: 'android/app/build/outputs/apk/debug/*.apk', fingerprint: true
                        }
                        failure {
                            echo "Android build failed."
                        }
                    }
                }

                // --- iOS Build (Mac Agent) ---
                stage('iOS (Simulator)') {
                    agent { label 'mac' } // Uses the Mac OS X (aarch64) agent
                    
                    environment {
                        // Ensure CocoaPods/Xcode tools are in PATH if not default
                        // PATH = "/usr/local/bin:/opt/homebrew/bin:$PATH"
                    }

                    steps {
                        script {
                            echo "--- Preparing iOS Workspace ---"
                            // Clean checkout on the new agent
                            checkout scm
                            
                            unstash 'config-files'
                            unstash 'web-dist'

                            // Install dependencies (recompiles native modules for M1/M2)
                            sh 'npm ci'

                            echo "--- Syncing Capacitor iOS ---"
                            // Updates native ios project with web assets and plugins
                            sh 'npx cap sync ios'

                            echo "--- Building iOS Simulator App ---"
                            dir('ios/App') {
                                // 'generic/platform=iOS Simulator' builds for the simulator architecture (x86_64 or arm64 sim)
                                // derivedDataPath ensures we know exactly where the output goes
                                sh '''
                                    xcodebuild -workspace App.xcworkspace \
                                        -scheme App \
                                        -configuration Debug \
                                        -destination 'generic/platform=iOS Simulator' \
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
                    post {
                        success {
                            archiveArtifacts artifacts: 'ios/App/build/Build/Products/Debug-iphonesimulator/App-Simulator.zip', fingerprint: true
                        }
                        failure {
                            echo "iOS build failed."
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

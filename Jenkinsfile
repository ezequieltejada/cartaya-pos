// Helper Functions for Version Management and Release Publishing

/**
 * Extract version from multiple sources in priority order:
 * 1. package.json (Node project version)
 * 2. android/app/build.gradle (Android versionName)
 * Returns normalized version string or empty string if not found.
 */
def extractVersion() {
    // Try package.json first
    def pkgVersion = sh(
        script: '''
            if [ -f "package.json" ]; then
                grep -o '"version"[[:space:]]*:[[:space:]]*"[^"]*' package.json | \
                sed 's/"version"[[:space:]]*:[[:space:]]*"//g' || true
            fi
        ''',
        returnStdout: true
    ).trim()
    
    if (pkgVersion) {
        echo "✓ Found version in package.json: ${pkgVersion}"
        return pkgVersion
    }
    
    // Fall back to build.gradle versionName
    def gradleVersion = sh(
        script: '''
            if [ -f "android/app/build.gradle" ]; then
                grep 'versionName[[:space:]]*"' android/app/build.gradle | \
                sed 's/.*versionName[[:space:]]*"//;s/".*//' | head -1 || true
            fi
        ''',
        returnStdout: true
    ).trim()
    
    if (gradleVersion) {
        echo "✓ Found version in android/app/build.gradle: ${gradleVersion}"
        return gradleVersion
    }
    
    echo "✗ Could not extract version from package.json or build.gradle"
    return ""
}

/**
 * Normalize version string to semantic versioning format (x.y.z).
 * - Removes leading 'v' prefix
 * - Validates format matches \d+\.\d+(\.\d+)?
 * - Returns normalized version or throws error if invalid
 */
def normalizeVersion(String version) {
    // Remove leading 'v' if present
    def normalized = version.replaceAll(/^[vV]/, '')
    
    // Validate semantic version format (x.y or x.y.z)
    if (!normalized.matches(/^\d+\.\d+(\.\d+)?$/)) {
        error "Invalid version format: '${version}' -> '${normalized}'. Expected x.y or x.y.z format"
    }
    
    // Ensure three-part version (x.y.z) by adding .0 if needed
    def parts = normalized.split('\\.')
    if (parts.size() == 2) {
        normalized = "${parts[0]}.${parts[1]}.0"
        echo "Expanded version: ${normalized}"
    }
    
    return normalized
}

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
            options {
                timeout(time: 5, unit: 'MINUTES')
            }

            steps {
                script {
                    echo "--- Checking Build Environment ---"
                    sh '''
                        set +e
                        node -v && npm -v || echo "Node/npm check failed"
                        java -version 2>&1 || echo "Java not required for web build"
                        echo "ANDROID_SDK_ROOT=${ANDROID_SDK_ROOT:-NOT SET}"
                        echo "ANDROID_HOME=${ANDROID_HOME:-NOT SET}"
                        set -e
                    '''
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
                        echo "--- Installing Dependencies with npm cache ---"
                        sh '''
                            CACHE_KEY=$(md5sum package-lock.json | cut -d" " -f1)
                            CACHE_DIR="$HOME/.npm-cache/node/$CACHE_KEY"
                            if [ -d "$CACHE_DIR/node_modules" ]; then
                                echo "Restoring node_modules from cache"
                                cp -r "$CACHE_DIR/node_modules" ./
                            else
                                echo "Cache miss, installing dependencies"
                                rm -rf node_modules
                                npm ci
                                mkdir -p "$CACHE_DIR"
                                cp -r node_modules "$CACHE_DIR/"
                            fi
                        '''

                        echo "--- Building Angular App ---"
                        // Generates the 'www' directory
                        sh 'npm run build'
                    }
                }
            }
            post {
                success {
                    stash includes: 'cartayaPos/www/**', name: 'web-dist'
                    stash includes: 'cartayaPos/package.json, cartayaPos/package-lock.json, cartayaPos/capacitor.config.ts', name: 'config-files'
                }
            }
        }

        // -------------------------------------------------------------------------
        // Stage 2: Android Build
        // -------------------------------------------------------------------------
        stage('Android Build') {
            options {
                timeout(time: 45, unit: 'MINUTES')
            }
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
                            echo "Current user: $(whoami)"
                            echo "Current group: $(id)"
                            echo "ANDROID_SDK_ROOT: ${ANDROID_SDK_ROOT:-NOT SET}"
                            echo "ANDROID_HOME: ${ANDROID_HOME:-NOT SET}"
                            echo ""
                            echo "Checking /home/circleci permissions:"
                            stat /home/circleci 2>/dev/null || echo "Cannot stat /home/circleci"
                            echo ""
                            echo "Checking SDK directory:"
                            if [ -d "$ANDROID_SDK_ROOT" ]; then
                                echo "✓ Android SDK found at: $ANDROID_SDK_ROOT"
                                stat "$ANDROID_SDK_ROOT"
                            else
                                echo "✗ Android SDK not found at: $ANDROID_SDK_ROOT"
                                echo "Checking if path exists with different permissions:"
                                test -e "$ANDROID_SDK_ROOT" && echo "Path exists but no read permission" || echo "Path does not exist"
                                exit 1
                            fi
                        '''

                        dir('android') {
                            sh '''
                                cat > local.properties <<'EOF'
sdk.dir=/home/circleci/android-sdk
EOF
                            '''
                            echo "✓ local.properties created"
                        }

                        // Install dependencies (needed for Capacitor CLI)
                        sh '''
                            CACHE_KEY=$(md5sum package-lock.json | cut -d" " -f1)
                            CACHE_DIR="$HOME/.npm-cache/node-android/$CACHE_KEY"
                            if [ -d "$CACHE_DIR/node_modules" ]; then
                                echo "Restoring node_modules from cache"
                                cp -r "$CACHE_DIR/node_modules" ./
                            else
                                echo "Cache miss, installing dependencies"
                                rm -rf node_modules
                                npm ci
                                mkdir -p "$CACHE_DIR"
                                cp -r node_modules "$CACHE_DIR/"
                            fi
                        '''

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
                            sh './gradlew :app:assembleDebug --stacktrace'
                        }
                    }
                }
            }
            post {
                success {
                    // Archive the APK for download
                    // Note: We need to match the path relative to workspace root, so we prepend cartayaPos/
                    archiveArtifacts artifacts: 'cartayaPos/android/app/build/outputs/apk/debug/*.apk', fingerprint: true
                    stash includes: 'cartayaPos/android/app/build/outputs/apk/debug/*.apk', name: 'release-asset-android'
                }
                failure {
                    echo "Android build failed."
                }
            }
        }

        // -------------------------------------------------------------------------
        // Stage 3: Publish Release to GitHub (Obtainium Integration)
        // -------------------------------------------------------------------------
        stage('Publish Release') {
            agent { label 'linux' }
            when {
                expression { currentBuild.result == null || currentBuild.result == 'SUCCESS' }
            }
            steps {
                script {
                    dir('cartayaPos') {
                        unstash 'release-asset-android'
                        echo "=== GitHub Release Publisher (Android) ==="

                        // =====================================================
                        // Step 1: Extract Version
                        // =====================================================
                        echo "--- Step 1: Extracting Version ---"
                        def version = extractVersion()

                        if (!version) {
                            echo "WARNING: Could not extract version, skipping release publication"
                            return
                        }

                        echo "✓ Extracted version: ${version}"

                        // =====================================================
                        // Step 2: Validate and normalize version
                        // =====================================================
                        echo "--- Step 2: Validating Version Format ---"
                        def normalizedVersion = normalizeVersion(version)
                        echo "✓ Normalized version: ${normalizedVersion}"

                        def tagName = normalizedVersion.startsWith('v') ? normalizedVersion : "v${normalizedVersion}"
                        def releaseVersion = normalizedVersion.replaceAll(/^v/, '')

                        echo "Git tag: ${tagName}"
                        echo "Release version: ${releaseVersion}"

                        // =====================================================
                        // Step 3: Ensure git tag exists
                        // =====================================================
                        echo "--- Step 3: Managing Git Tag ---"
                        def tagExists = sh(
                            script: "git rev-parse '${tagName}' > /dev/null 2>&1",
                            returnStatus: true
                        ) == 0

                        if (!tagExists) {
                            echo "Creating git tag: ${tagName}"
                            sh '''
                                git config user.email "jenkins@cartaya.app"
                                git config user.name "Jenkins CI"
                                git tag -a "${TAG_NAME}" \
                                    -m "Automated release ${RELEASE_VERSION} from Jenkins Build #${BUILD_NUMBER}"
                                echo "✓ Git tag created"
                            '''.replace('${TAG_NAME}', tagName).replace('${RELEASE_VERSION}', releaseVersion).replace('${BUILD_NUMBER}', "${BUILD_NUMBER}")
                        } else {
                            echo "ℹ Git tag ${tagName} already exists"
                        }

                        // =====================================================
                        // Step 4: Locate build artifact
                        // =====================================================
                        echo "--- Step 4: Locating Build Artifacts ---"
                        def candidateArtifacts = [
                            'android/app/build/outputs/apk/debug/app-debug.apk',
                            'android/app/build/outputs/apk/release/app-release.apk'
                        ]

                        def artifactPath = candidateArtifacts.find { path ->
                            fileExists(path)
                        }

                        if (!artifactPath) {
                            echo "ERROR: No APK found in android/app/build/outputs/apk"
                            error "APK artifact not found"
                        }

                        def artifactFileName = artifactPath.tokenize('/').last()
                        echo "✓ Artifact found: ${artifactPath}"
                        echo "  Filename: ${artifactFileName}"

                        // =====================================================
                        // Step 5: Publish to GitHub Releases
                        // =====================================================
                        echo "--- Step 5: Publishing to GitHub Releases ---"

                        withCredentials([string(credentialsId: 'github-app-jenkins-pws', variable: 'GITHUB_TOKEN')]) {
                            sh '''
                                set -e

                                # Extract owner/repo from GIT_URL
                                # Handles: https://github.com/owner/repo.git or git@github.com:owner/repo.git
                                REPO_SLUG=$(echo "${GIT_URL}" | sed -E 's|.*github.com[:/](.*)(\\.git)?$|\\1|')
                                echo "Repository: ${REPO_SLUG}"

                                # Get commit info for release notes
                                COMMIT_SHA=$(git rev-parse --short HEAD)
                                COMMIT_MSG=$(git log -1 --pretty=%B | head -1)
                                BUILD_URL="${JENKINS_URL}job/${JOB_NAME}/${BUILD_NUMBER}/"

                                # Build release body
                                RELEASE_BODY=$(cat <<EOF
**Version:** ${RELEASE_VERSION}
**Platform:** android
**Build:** #${BUILD_NUMBER}
**Commit:** ${COMMIT_SHA}
**Message:** ${COMMIT_MSG}

**Build Details:**
- Job: ${JOB_NAME}
- Build URL: ${BUILD_URL}

This is an automated release for Obtainium app update tracking.
EOF
)

                                echo "Release Notes:"
                                echo "${RELEASE_BODY}"

                                # Check if release already exists
                                echo "Checking for existing release..."
                                RELEASE_RESPONSE=$(curl -s -H "Authorization: token ${GITHUB_TOKEN}" \\
                                    "https://api.github.com/repos/${REPO_SLUG}/releases/tags/${TAG_NAME}" 2>/dev/null || true)

                                RELEASE_ID=$(echo "${RELEASE_RESPONSE}" | grep -o '"id"[[:space:]]*:[[:space:]]*[0-9]*' | head -1 | grep -o '[0-9]*' || true)

                                if [ -n "${RELEASE_ID}" ]; then
                                    echo "✓ Release already exists (ID: ${RELEASE_ID})"
                                    RELEASE_EXISTS="true"
                                else
                                    echo "Creating new release..."
                                    RELEASE_RESPONSE=$(curl -s -X POST \\
                                        -H "Authorization: token ${GITHUB_TOKEN}" \\
                                        -H "Accept: application/vnd.github.v3+json" \\
                                        -d @- "https://api.github.com/repos/${REPO_SLUG}/releases" <<'PAYLOAD'
{
    "tag_name": "TAG_NAME_PLACEHOLDER",
    "name": "Release TAG_NAME_PLACEHOLDER",
    "body": "BODY_PLACEHOLDER",
    "draft": false,
    "prerelease": false
}
PAYLOAD
)
                                    echo "${RELEASE_RESPONSE}" | sed "s/TAG_NAME_PLACEHOLDER/${TAG_NAME}/g; s|BODY_PLACEHOLDER|${RELEASE_BODY}|g"

                                    RELEASE_ID=$(echo "${RELEASE_RESPONSE}" | grep -o '"id"[[:space:]]*:[[:space:]]*[0-9]*' | head -1 | grep -o '[0-9]*' || true)
                                    if [ -n "${RELEASE_ID}" ]; then
                                        echo "✓ Release created (ID: ${RELEASE_ID})"
                                        RELEASE_EXISTS="true"
                                    else
                                        echo "ERROR: Failed to create release"
                                        echo "Response: ${RELEASE_RESPONSE}"
                                        exit 1
                                    fi
                                fi

                                # Get upload URL
                                UPLOAD_URL=$(echo "${RELEASE_RESPONSE}" | grep -o '"upload_url"[[:space:]]*:[[:space:]]*"[^"]*' | sed 's/"upload_url"[[:space:]]*:[[:space:]]*"//;s/{.*$//' || true)

                                if [ -z "${UPLOAD_URL}" ]; then
                                    echo "ERROR: Could not obtain upload URL from release response"
                                    exit 1
                                fi

                                echo "Upload URL: ${UPLOAD_URL}"

                                # Upload release asset
                                echo "Uploading release asset: ${ARTIFACT_FILENAME}"
                                curl -X POST \\
                                    -H "Authorization: token ${GITHUB_TOKEN}" \\
                                    -H "Content-Type: application/octet-stream" \\
                                    --data-binary @"${ARTIFACT_PATH}" \\
                                    "${UPLOAD_URL}?name=${ARTIFACT_FILENAME}" \\
                                    --fail-with-body \\
                                    -o /dev/null -w "\\nHTTP Status: %{http_code}\\n"

                                echo "✓ Release asset uploaded"
                            '''
                            .replace('${TAG_NAME}', tagName)
                            .replace('${RELEASE_VERSION}', releaseVersion)
                            .replace('${ARTIFACT_PATH}', artifactPath)
                            .replace('${ARTIFACT_FILENAME}', artifactFileName)
                            .replace('${BUILD_NUMBER}', "${BUILD_NUMBER}")
                            .replace('${JOB_NAME}', "${env.JOB_NAME}")
                            .replace('${JENKINS_URL}', "${env.JENKINS_URL}")
                        }

                        echo "=== ✓ Release Publication Complete ==="
                    }
                }
            }
            post {
                failure {
                    echo "ERROR: GitHub Release publication failed"
                    echo "This may indicate: GitHub API error, missing credentials, or network issue"
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

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

/**
 * Convert a branch name into a tag-safe suffix for prerelease tags.
 */
def sanitizeTagSuffix(String value) {
    def sanitized = (value ?: 'branch')
        .toLowerCase()
        .replaceAll(/[^0-9a-z]+/, '-')
        .replaceAll(/^-+|-+$/, '')

    return sanitized ?: 'branch'
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
            agent { label 'jenkins-agent' }
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
            agent { label 'jenkins-agent' } // Uses the Linux (amd64) agent

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

                        echo "--- Uploading Sentry Source Maps ---"
                        sh '''
                            if [ -n "${SENTRY_AUTH_TOKEN:-}" ]; then
                                export SENTRY_ORG=estudio-pws
                                export SENTRY_PROJECT=cartaya-pos
                                npm run sentry:sourcemaps
                            elif [ "${BRANCH_NAME:-}" = "main" ]; then
                                echo "SENTRY_AUTH_TOKEN is required on main to upload Sentry source maps."
                                exit 1
                            else
                                echo "Skipping Sentry source map upload because SENTRY_AUTH_TOKEN is not set."
                            fi
                        '''
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
            agent { label 'jenkins-agent' }

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
// Stage 3: Publish Release to GitHub (Fixed)
// -------------------------------------------------------------------------
        stage('Publish Release') {
            agent { label 'jenkins-agent' }
            steps {
                script {
                    dir('cartayaPos') {
                        // 1. Unstash Android build artifacts
                        unstash 'release-asset-android'
                        
                        // 2. Extract and Normalize Version
                        def rawVersion = extractVersion()
                        if (!rawVersion) {
                            echo "No version found, skipping release."
                            return
                        }
                        def normVersion = normalizeVersion(rawVersion)
                        
                        // 3. Determine Tag Name and Prerelease status
                        def isMain = (env.BRANCH_NAME == 'main')
                        def branchNameForTag = env.CHANGE_BRANCH ?: env.BRANCH_NAME
                        def branchTagSuffix = sanitizeTagSuffix(branchNameForTag)
                        def tagName = isMain ? "v${normVersion}" : "v${normVersion}-${branchTagSuffix}-${env.BUILD_NUMBER}"
                        def isPrerelease = !isMain
                        
                        // 4. Extract Changelog safely
                        def changelogRaw = sh(script: 'git log -1 --pretty=%b', returnStdout: true).trim()
                        def changelogBody = changelogRaw ?: "Automated build from branch: ${env.BRANCH_NAME}"
                        
                        // 5. Generate JSON content safely using Python
                        // We write the body to a temp file first to avoid shell quoting issues with 'echo'
                        writeFile file: 'changelog_raw.txt', text: changelogBody
                        def escapedChangelog = sh(
                            script: "python3 -c 'import json,sys; print(json.dumps(open(\"changelog_raw.txt\").read()))'", 
                            returnStdout: true
                        ).trim()

                        // 6. Create the Release Payload File
                        // We build the JSON file using Groovy interpolation, then write it to disk.
                        // This prevents the shell from ever seeing the special characters in the body.
                        def jsonPayload = """
                        {
                            "tag_name": "${tagName}",
                            "name": "Release ${tagName}",
                            "body": ${escapedChangelog},
                            "draft": false,
                            "prerelease": ${isPrerelease}
                        }
                        """
                        writeFile file: 'release.json', text: jsonPayload

                        // 7. Publish Release
                        withCredentials([string(credentialsId: 'github-api-token', variable: 'GITHUB_TOKEN')]) {
                            echo "--- Publishing Release ${tagName} ---"
                            sh '''
                                set -e
                                REPO_SLUG="ezequieltejada/cartaya-pos"
                                API_URL="https://api.github.com/repos/$REPO_SLUG"
                                TAG_NAME=$(python3 -c "import json; print(json.load(open('release.json'))['tag_name'])")
                                
                                # Create a release. If the tag already has a release, skip publishing
                                # instead of overwriting the existing release or assets.
                                CREATE_RESPONSE_FILE=$(mktemp)
                                CREATE_STATUS=$(curl -sS -o "$CREATE_RESPONSE_FILE" -w "%{http_code}" -X POST \
                                    -H "Authorization: token $GITHUB_TOKEN" \
                                    -H "Accept: application/vnd.github.v3+json" \
                                    -H "Content-Type: application/json" \
                                    "$API_URL/releases" \
                                    -d @release.json)

                                if [ "$CREATE_STATUS" = "201" ]; then
                                    RELEASE_RESPONSE=$(cat "$CREATE_RESPONSE_FILE")
                                    echo "✓ Release created successfully"
                                elif [ "$CREATE_STATUS" = "422" ] && python3 - "$CREATE_RESPONSE_FILE" <<'PY'
import json
import sys

with open(sys.argv[1], 'r', encoding='utf-8') as handle:
    payload = json.load(handle)

errors = payload.get('errors') or []
already_exists = any(
    error.get('resource') == 'Release'
    and error.get('code') == 'already_exists'
    and error.get('field') == 'tag_name'
    for error in errors
)

sys.exit(0 if already_exists else 1)
PY
                                then
                                    echo "Release for $TAG_NAME already exists. Skipping publish to avoid overwriting it."
                                    exit 0
                                else
                                    echo "✗ Failed to create release (HTTP $CREATE_STATUS)"
                                    cat "$CREATE_RESPONSE_FILE"
                                    exit 1
                                fi

                                # Extract upload URL for asset upload.
                                UPLOAD_URL=$(printf '%s' "$RELEASE_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin)['upload_url'].replace('{?name,label}', ''))")
                                
                                # Upload the APK asset
                                echo "--- Uploading APK Asset ---"
                                for apk in android/app/build/outputs/apk/debug/*.apk; do
                                    FILENAME=$(basename "$apk")
                                    echo "Uploading $FILENAME..."
                                    
                                    UPLOAD_RESPONSE_FILE=$(mktemp)
                                    UPLOAD_STATUS=$(curl -sS -o "$UPLOAD_RESPONSE_FILE" -w "%{http_code}" -X POST \
                                        -H "Authorization: token $GITHUB_TOKEN" \
                                        -H "Content-Type: application/vnd.android.package-archive" \
                                        "${UPLOAD_URL}?name=${FILENAME}" \
                                        --data-binary @"$apk")

                                    if [ "$UPLOAD_STATUS" != "201" ]; then
                                        echo "✗ Failed to upload asset $FILENAME (HTTP $UPLOAD_STATUS)"
                                        cat "$UPLOAD_RESPONSE_FILE"
                                        exit 1
                                    fi
                                done
                            '''
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

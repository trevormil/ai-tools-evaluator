import SwiftUI

/// Account state + lets the user point the app at a different backend.
struct SettingsView: View {
    @EnvironmentObject private var auth: AuthStore
    @State private var override: String = AppConfig.storedOverride ?? ""
    @State private var saved = false
    @State private var devUsername = ""

    private var isLocalBase: Bool {
        let host = AppConfig.baseURL.host() ?? ""
        return host == "localhost" || host == "127.0.0.1"
    }

    var body: some View {
        NavigationStack {
            Form {
                accountSection

                Section {
                    TextField("https://aix.trevormil.com", text: $override)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                        .keyboardType(.URL)
                } header: {
                    Text("Base URL override")
                } footer: {
                    Text("Leave blank to use the default (\(AppConfig.defaultBaseURL)). For local dev, enter http://localhost:3000. Changes apply to newly loaded screens.")
                }

                Section {
                    Button("Save") {
                        AppConfig.setOverride(override)
                        saved = true
                    }
                    Button("Reset to default", role: .destructive) {
                        AppConfig.setOverride(nil)
                        override = ""
                        saved = true
                    }
                }

                Section("Effective base URL") {
                    Text(AppConfig.baseURL.absoluteString)
                        .font(.footnote.monospaced())
                        .foregroundStyle(.secondary)
                }
            }
            .navigationTitle("Settings")
            .alert("Saved", isPresented: $saved) {
                Button("OK", role: .cancel) {}
            } message: {
                Text("Pull to refresh any open list to fetch from the new URL.")
            }
        }
    }

    @ViewBuilder
    private var accountSection: some View {
        Section {
            if let user = auth.user {
                HStack(spacing: 12) {
                    AvatarView(url: user.avatarURL, name: user.name, size: 40)
                    VStack(alignment: .leading, spacing: 2) {
                        Text(user.name).font(.headline)
                        Text("@\(user.username)").font(.caption).foregroundStyle(.secondary)
                    }
                }
                Button("Sign out", role: .destructive) {
                    Task { await auth.signOut() }
                }
            } else {
                Button {
                    Task { await auth.signIn() }
                } label: {
                    Label("Sign in with GitHub", systemImage: "person.crop.circle.badge.plus")
                }
                .disabled(auth.isSigningIn)
                // Local-only shortcut for simulator testing (AIX_DEV_LOGIN=1 servers).
                if isLocalBase {
                    HStack {
                        TextField("dev username", text: $devUsername)
                            .textInputAutocapitalization(.never)
                            .autocorrectionDisabled()
                        Button("Dev login") {
                            Task { await auth.devSignIn(username: devUsername.isEmpty ? "dev" : devUsername) }
                        }
                    }
                }
            }
            if let error = auth.lastError {
                Text(error).font(.caption).foregroundStyle(.red)
            }
        } header: {
            Text("Account")
        }
    }
}

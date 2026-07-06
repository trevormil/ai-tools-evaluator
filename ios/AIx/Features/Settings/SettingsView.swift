import SwiftUI

/// Lets the user point the app at a different backend (e.g. localhost:3000).
struct SettingsView: View {
    @State private var override: String = AppConfig.storedOverride ?? ""
    @State private var saved = false

    var body: some View {
        NavigationStack {
            Form {
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
}

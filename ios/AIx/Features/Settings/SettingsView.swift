import SwiftUI

/// Daily-pick reminder + backend override (e.g. localhost:3000 for dev).
struct SettingsView: View {
    @State private var override: String = AppConfig.storedOverride ?? ""
    @State private var saved = false
    @State private var reminderOn = DailyPickReminder.isEnabled
    @State private var reminderDenied = false

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    Toggle("Daily pick reminder", isOn: $reminderOn)
                        .onChange(of: reminderOn) { _, on in
                            Task {
                                if on {
                                    let granted = await DailyPickReminder.enable()
                                    if !granted {
                                        reminderOn = false
                                        reminderDenied = true
                                    }
                                } else {
                                    DailyPickReminder.disable()
                                }
                            }
                        }
                } header: {
                    Text("Notifications")
                } footer: {
                    Text("One notification a day around \(DailyPickReminder.fireHour) AM — the tool judged most worth your attention. Tap it to jump straight to the verdict.")
                }

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
            .navigationTitle("")
            .navigationBarTitleDisplayMode(.inline)
            .alert("Saved", isPresented: $saved) {
                Button("OK", role: .cancel) {}
            } message: {
                Text("Pull to refresh any open list to fetch from the new URL.")
            }
            .alert("Notifications are off", isPresented: $reminderDenied) {
                Button("OK", role: .cancel) {}
            } message: {
                Text("Allow notifications for AIx in the system Settings app to get the daily pick.")
            }
        }
    }
}

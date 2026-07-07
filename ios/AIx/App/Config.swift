import Foundation

/// Runtime configuration. The base URL defaults to production but can be
/// overridden two ways:
///   1. A launch/environment argument `AIX_BASE_URL` (handy for Xcode schemes).
///   2. The in-app Settings field (persisted in UserDefaults), which wins.
///
/// To point at a local dev server, either run the "AIx (Local)" behaviour by
/// setting the env var to `http://localhost:3000`, or type it into Settings.
enum AppConfig {
    static let defaultBaseURL = "https://aix.trevormil.com"
    private static let overrideKey = "aix.baseURLOverride"

    /// The effective base URL, normalized with no trailing slash.
    static var baseURL: URL {
        let raw = storedOverride
            ?? ProcessInfo.processInfo.environment["AIX_BASE_URL"]
            ?? defaultBaseURL
        let trimmed = raw.trimmingCharacters(in: .whitespacesAndNewlines)
            .replacingOccurrences(of: "/+$", with: "", options: .regularExpression)
        return URL(string: trimmed.isEmpty ? defaultBaseURL : trimmed) ?? URL(string: defaultBaseURL)!
    }

    /// User-set override from Settings, if any.
    static var storedOverride: String? {
        let v = UserDefaults.standard.string(forKey: overrideKey)
        return (v?.isEmpty ?? true) ? nil : v
    }

    static func setOverride(_ value: String?) {
        let trimmed = value?.trimmingCharacters(in: .whitespacesAndNewlines)
        if let trimmed, !trimmed.isEmpty {
            UserDefaults.standard.set(trimmed, forKey: overrideKey)
        } else {
            UserDefaults.standard.removeObject(forKey: overrideKey)
        }
    }
}

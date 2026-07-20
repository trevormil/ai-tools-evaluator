import Foundation
import Security

/// Where the session token lives. Protocol-backed so tests can use memory.
protocol TokenStore {
    func read() -> String?
    func write(_ token: String)
    func clear()
}

/// Keychain-backed store — the session token never touches UserDefaults.
struct KeychainTokenStore: TokenStore {
    private let service = "com.trevormil.aix.session"
    private let account = "aix-session-token"

    private var query: [String: Any] {
        [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
        ]
    }

    func read() -> String? {
        var q = query
        q[kSecReturnData as String] = true
        q[kSecMatchLimit as String] = kSecMatchLimitOne
        var result: AnyObject?
        guard SecItemCopyMatching(q as CFDictionary, &result) == errSecSuccess,
              let data = result as? Data
        else { return nil }
        return String(data: data, encoding: .utf8)
    }

    func write(_ token: String) {
        let data = Data(token.utf8)
        var add = query
        add[kSecValueData as String] = data
        add[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlock
        let status = SecItemAdd(add as CFDictionary, nil)
        if status == errSecDuplicateItem {
            SecItemUpdate(query as CFDictionary, [kSecValueData as String: data] as CFDictionary)
        }
    }

    func clear() {
        SecItemDelete(query as CFDictionary)
    }
}

/// Test double — also handy for SwiftUI previews.
final class InMemoryTokenStore: TokenStore {
    private var token: String?
    init(token: String? = nil) { self.token = token }
    func read() -> String? { token }
    func write(_ token: String) { self.token = token }
    func clear() { token = nil }
}

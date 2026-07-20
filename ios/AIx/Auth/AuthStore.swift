import AuthenticationServices
import Foundation
import SwiftUI

/// Abstracts ASWebAuthenticationSession so tests can fake the OAuth round-trip.
protocol WebAuthenticating {
    /// Present the OAuth page and return the aix:// callback URL.
    func authenticate(url: URL, callbackScheme: String) async throws -> URL
}

/// Real implementation — drives ASWebAuthenticationSession.
final class WebAuthenticator: NSObject, WebAuthenticating, ASWebAuthenticationPresentationContextProviding {
    func authenticate(url: URL, callbackScheme: String) async throws -> URL {
        try await withCheckedThrowingContinuation { continuation in
            let session = ASWebAuthenticationSession(url: url, callbackURLScheme: callbackScheme) { callbackURL, error in
                if let callbackURL {
                    continuation.resume(returning: callbackURL)
                } else {
                    continuation.resume(throwing: error ?? APIError.transport("Sign-in was cancelled."))
                }
            }
            session.presentationContextProvider = self
            session.prefersEphemeralWebBrowserSession = false
            DispatchQueue.main.async { session.start() }
        }
    }

    func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor {
        MainActor.assumeIsolated { ASPresentationAnchor() }
    }
}

/// Session state for the whole app: token in the Keychain, current user from
/// GET /api/me, sign-in via the server's ?client=ios OAuth hand-off (0057).
@MainActor
final class AuthStore: ObservableObject {
    @Published private(set) var user: PublicUser?
    @Published private(set) var isSigningIn = false
    @Published var unreadNotifications = 0
    @Published var unreadMessages = 0
    @Published var lastError: String?

    private let tokenStore: TokenStore
    private let webAuth: WebAuthenticating
    private let makeClient: (TokenStore) -> APIClient

    var isSignedIn: Bool { tokenStore.read() != nil }
    var token: String? { tokenStore.read() }

    init(
        tokenStore: TokenStore = KeychainTokenStore(),
        webAuth: WebAuthenticating = WebAuthenticator(),
        clientFactory: ((TokenStore) -> APIClient)? = nil
    ) {
        self.tokenStore = tokenStore
        self.webAuth = webAuth
        // Built per call so the client always sees the current token + base URL.
        self.makeClient = clientFactory ?? { store in APIClient(tokenProvider: { store.read() }) }
    }

    private func client() -> APIClient { makeClient(tokenStore) }

    /// Extract the session token from the aix://auth#token=… callback.
    static func token(fromCallback url: URL) -> String? {
        guard url.scheme == "aix", url.host == "auth" || url.path.contains("auth") || url.absoluteString.contains("auth") else { return nil }
        let raw = url.fragment ?? url.query ?? ""
        for pair in raw.split(separator: "&") {
            let parts = pair.split(separator: "=", maxSplits: 1)
            if parts.count == 2, parts[0] == "token" {
                return String(parts[1])
            }
        }
        return nil
    }

    /// Full GitHub OAuth round-trip through ASWebAuthenticationSession.
    func signIn() async {
        guard !isSigningIn else { return }
        isSigningIn = true
        lastError = nil
        defer { isSigningIn = false }
        do {
            let start = AppConfig.baseURL.appending(path: "api/auth/github")
                .appending(queryItems: [URLQueryItem(name: "client", value: "ios")])
            let callback = try await webAuth.authenticate(url: start, callbackScheme: "aix")
            guard let token = Self.token(fromCallback: callback) else {
                throw APIError.transport("Sign-in failed: no session token returned.")
            }
            tokenStore.write(token)
            await refreshMe()
        } catch {
            // A cancelled sheet isn't an error worth surfacing.
            if (error as? ASWebAuthenticationSessionError)?.code != .canceledLogin {
                lastError = error.localizedDescription
            }
        }
    }

    /// Dev-only simulator sign-in against a local server with AIX_DEV_LOGIN=1.
    func devSignIn(username: String) async {
        do {
            let result = try await client().devLogin(username: username)
            tokenStore.write(result.token)
            await refreshMe()
        } catch {
            lastError = error.localizedDescription
        }
    }

    /// Load /api/me: who am I + unread badges. Clears state on a dead token.
    func refreshMe() async {
        guard isSignedIn else {
            user = nil
            return
        }
        do {
            let me = try await client().fetchMe()
            user = me.user
            unreadNotifications = me.unreadNotifications
            unreadMessages = me.unreadMessages
        } catch APIError.unauthorized {
            // Session expired server-side — drop the stale token.
            tokenStore.clear()
            user = nil
        } catch {
            lastError = error.localizedDescription
        }
    }

    func signOut() async {
        if isSignedIn {
            try? await client().logout()
        }
        tokenStore.clear()
        user = nil
        unreadNotifications = 0
        unreadMessages = 0
    }
}

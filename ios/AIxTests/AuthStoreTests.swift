import XCTest
@testable import AIx

/// AuthStore: the OAuth hand-off, Keychain-backed token lifecycle, and /api/me
/// bootstrap — all with fakes (no network, no real Keychain, no ASWebAuth UI).
@MainActor
final class AuthStoreTests: XCTestCase {
    override func tearDown() {
        MockURLProtocol.handler = nil
        super.tearDown()
    }

    private func makeStore(
        tokens: InMemoryTokenStore = InMemoryTokenStore(),
        webAuth: FakeWebAuth = FakeWebAuth(result: URL(string: "aix://auth#token=tok-abc")!)
    ) -> AuthStore {
        AuthStore(tokenStore: tokens, webAuth: webAuth) { store in
            let config = URLSessionConfiguration.ephemeral
            config.protocolClasses = [MockURLProtocol.self]
            return APIClient(
                baseURL: TestSupport.baseURL,
                session: URLSession(configuration: config),
                tokenProvider: { store.read() }
            )
        }
    }

    func testCallbackTokenParsing() {
        XCTAssertEqual(AuthStore.token(fromCallback: URL(string: "aix://auth#token=abc123")!), "abc123")
        XCTAssertNil(AuthStore.token(fromCallback: URL(string: "aix://auth#nope=1")!), "missing token param")
        XCTAssertNil(AuthStore.token(fromCallback: URL(string: "https://evil.example/auth#token=x")!), "wrong scheme")
    }

    func testSignInStoresTokenAndLoadsUser() async {
        let tokens = InMemoryTokenStore()
        let store = makeStore(tokens: tokens)
        TestSupport.stub(json: #"{"user":{"id":"u1","username":"alice","displayName":"Alice","avatarUrl":null,"bio":null,"role":"user","createdAt":"2026-01-01T00:00:00.000Z"},"unreadNotifications":2,"unreadMessages":1}"#)

        await store.signIn()

        XCTAssertEqual(tokens.read(), "tok-abc")
        XCTAssertEqual(store.user?.username, "alice")
        XCTAssertEqual(store.unreadNotifications, 2)
        XCTAssertEqual(store.unreadMessages, 1)
        XCTAssertTrue(store.isSignedIn)
    }

    func testSignInFailureWithoutTokenLeavesSignedOut() async {
        let tokens = InMemoryTokenStore()
        let store = makeStore(
            tokens: tokens,
            webAuth: FakeWebAuth(result: URL(string: "aix://auth#error=denied")!)
        )
        await store.signIn()
        XCTAssertNil(tokens.read())
        XCTAssertFalse(store.isSignedIn)
        XCTAssertNotNil(store.lastError)
    }

    func testExpiredTokenIsDroppedOnRefresh() async {
        let tokens = InMemoryTokenStore(token: "stale")
        let store = makeStore(tokens: tokens)
        TestSupport.stub(status: 401, json: #"{"error":"Not authenticated"}"#)

        await store.refreshMe()

        XCTAssertNil(tokens.read(), "stale token must be cleared")
        XCTAssertNil(store.user)
        XCTAssertFalse(store.isSignedIn)
    }

    func testSignOutClearsEverything() async {
        let tokens = InMemoryTokenStore(token: "tok")
        let store = makeStore(tokens: tokens)
        TestSupport.stub(json: #"{"ok":true}"#)

        await store.signOut()

        XCTAssertNil(tokens.read())
        XCTAssertNil(store.user)
        XCTAssertFalse(store.isSignedIn)
    }
}

/// Fake ASWebAuthenticationSession: returns a canned callback URL.
struct FakeWebAuth: WebAuthenticating {
    let result: URL
    func authenticate(url: URL, callbackScheme: String) async throws -> URL {
        result
    }
}

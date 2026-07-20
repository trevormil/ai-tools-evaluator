import XCTest
@testable import AIx

/// Device-local favorites: persistence round-trips, toggling, link rules.
@MainActor
final class FavoritesStoreTests: XCTestCase {
    private var defaults: UserDefaults!
    private let suite = "aix-favorites-tests"

    override func setUp() {
        super.setUp()
        defaults = UserDefaults(suiteName: suite)
        defaults.removePersistentDomain(forName: suite)
    }

    override func tearDown() {
        defaults.removePersistentDomain(forName: suite)
        super.tearDown()
    }

    private func sampleItem(slug: String = "ripgrep") -> FavoriteItem {
        FavoriteItem(
            slug: slug, title: "ripgrep", tagline: "Fast grep.",
            verdict: .essential, overallScore: 92, coverImageUrl: nil, savedAt: 1
        )
    }

    func testToggleSavesAndRemovesAndSurvivesRelaunch() {
        let store = FavoritesStore(defaults: defaults)
        XCTAssertTrue(store.toggle(sampleItem()))
        XCTAssertTrue(store.isFavorite(slug: "ripgrep"))

        // "Relaunch": a fresh store over the same defaults sees the bookmark.
        let relaunched = FavoritesStore(defaults: defaults)
        XCTAssertTrue(relaunched.isFavorite(slug: "ripgrep"))
        XCTAssertEqual(relaunched.items.first?.title, "ripgrep")

        XCTAssertFalse(relaunched.toggle(sampleItem()), "second toggle removes")
        XCTAssertFalse(relaunched.isFavorite(slug: "ripgrep"))
        XCTAssertFalse(FavoritesStore(defaults: defaults).isFavorite(slug: "ripgrep"))
    }

    func testNewestBookmarkGoesFirst() {
        let store = FavoritesStore(defaults: defaults)
        store.toggle(sampleItem(slug: "first"))
        store.toggle(sampleItem(slug: "second"))
        XCTAssertEqual(store.items.map(\.slug), ["second", "first"])
    }

    func testAddLinkValidatesAndDedupes() {
        let store = FavoritesStore(defaults: defaults)

        XCTAssertTrue(store.addLink(url: "https://x.com/some/post", title: "Neat thread", note: "read later"))
        XCTAssertEqual(store.links.first?.title, "Neat thread")
        XCTAssertEqual(store.links.first?.note, "read later")

        // Empty title falls back to the host; blank note becomes nil.
        XCTAssertTrue(store.addLink(url: "https://github.com/a/b", title: "  ", note: " "))
        XCTAssertEqual(store.links.first?.title, "github.com")
        XCTAssertNil(store.links.first?.note)

        // Junk and non-web schemes are rejected.
        XCTAssertFalse(store.addLink(url: "not a url", title: nil, note: nil))
        XCTAssertFalse(store.addLink(url: "javascript:alert(1)", title: nil, note: nil))
        XCTAssertFalse(store.addLink(url: "file:///etc/passwd", title: nil, note: nil))

        // Re-pasting the same link (case/trailing-slash noise) is a no-op.
        XCTAssertFalse(store.addLink(url: "https://x.com/some/post/", title: nil, note: nil))
        XCTAssertEqual(store.links.count, 2)
    }

    func testRemoveLinkPersists() {
        let store = FavoritesStore(defaults: defaults)
        store.addLink(url: "https://example.com/a", title: "A", note: nil)
        let id = store.links[0].id
        store.removeLink(id: id)
        XCTAssertTrue(store.links.isEmpty)
        XCTAssertTrue(FavoritesStore(defaults: defaults).links.isEmpty)
    }
}

// MARK: - App Group era (ticket 0072)

extension FavoritesStoreTests {
    func testDrainsPendingSharedLinksFromTheShareExtension() {
        // The extension queued two links while the app wasn't running.
        defaults.set(
            [
                ["url": "https://x.com/great/post", "title": "Great post"],
                ["url": "https://github.com/a/b"],
            ],
            forKey: FavoritesStore.pendingSharedKey
        )
        let store = FavoritesStore(defaults: defaults)
        XCTAssertEqual(store.links.count, 2)
        XCTAssertEqual(store.links[0].title, "Great post", "queue order preserved (oldest first → newest on top)")
        XCTAssertEqual(store.links[1].title, "github.com")
        XCTAssertNil(defaults.array(forKey: FavoritesStore.pendingSharedKey), "queue cleared after drain")

        // Draining again is a no-op; duplicates from re-shares are rejected.
        defaults.set([["url": "https://x.com/great/post/"]], forKey: FavoritesStore.pendingSharedKey)
        store.drainPendingShared()
        XCTAssertEqual(store.links.count, 2)
    }

    func testMigratesLegacyStandardDefaultsIntoTheAppGroupSuite() throws {
        // Favorites saved before the App Group move live in .standard.
        let legacy = FavoritesStore(defaults: .standard)
        legacy.toggle(sampleItem(slug: "legacy-tool"))
        defer { UserDefaults.standard.removeObject(forKey: "aix.favorites.items")
                UserDefaults.standard.removeObject(forKey: "aix.favorites.links") }

        let migrated = FavoritesStore(defaults: defaults)
        XCTAssertTrue(migrated.isFavorite(slug: "legacy-tool"))
    }
}

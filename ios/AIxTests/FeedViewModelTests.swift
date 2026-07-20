import XCTest
@testable import AIx

@MainActor
final class FeedViewModelTests: XCTestCase {
    override func tearDown() {
        MockURLProtocol.handler = nil
        super.tearDown()
    }

    private func makeVM() -> FeedViewModel {
        FeedViewModel(client: TestSupport.client())
    }

    private func itemEntryJSON(id: String, slug: String) -> String {
        """
        {"kind":"item","createdAt":1750000000,
         "item":{"id":"\(id)","slug":"\(slug)","title":"T","tagline":"t","category":"cli-tool",
                 "verdict":"worthwhile","overallScore":70,"noiseScore":10,"coverImageUrl":null,
                 "upvotes":0,"commentCount":0,"createdAt":1750000000,"scoreStatus":"scored"}}
        """
    }

    private let pickJSON = """
    {"item":{"slug":"pick-of-day","title":"Pick","url":"https://x","kind":"github_repo",
             "category":"cli-tool","integration":"i","verdict":"essential","overallScore":95,
             "noiseScore":3,"tagline":"t","audience":"both","coverImageUrl":null,
             "createdAt":"2026-07-01T00:00:00.000Z"},
     "pickedAt":"2026-07-20T07:00:00.000Z"}
    """

    func testRefreshLoadsFeedAndDailyPick() async {
        let vm = makeVM()
        TestSupport.stubRoutes([
            (path: "/api/feed", json: "{\"entries\":[\(itemEntryJSON(id: "i1", slug: "a"))],\"nextCursor\":null}"),
            (path: "/api/v1/daily-pick", json: pickJSON),
        ])
        await vm.refresh()
        XCTAssertEqual(vm.entries.count, 1)
        XCTAssertEqual(vm.dailyPick?.item.slug, "pick-of-day")
    }

    func testMissingDailyPickNeverBlocksTheFeed() async {
        let vm = makeVM()
        // daily-pick 404s (no pick yet) — the feed must still load cleanly.
        TestSupport.stubRoutes([
            (path: "/api/feed", json: "{\"entries\":[\(itemEntryJSON(id: "i1", slug: "a"))],\"nextCursor\":null}")
        ])
        await vm.refresh()
        XCTAssertEqual(vm.entries.count, 1)
        XCTAssertNil(vm.dailyPick)
        XCTAssertNil(vm.errorMessage)
    }

    func testLoadMorePaginatesAndDedups() async {
        let vm = makeVM()
        TestSupport.stubRoutes([
            (path: "/api/feed", json: "{\"entries\":[\(itemEntryJSON(id: "i1", slug: "a")),\(itemEntryJSON(id: "i2", slug: "b"))],\"nextCursor\":\"c1\"}")
        ])
        await vm.refresh()
        XCTAssertTrue(vm.canLoadMore)

        // Page 2 overlaps i2 (new content shifted the pages) and ends the cursor.
        TestSupport.stubRoutes([
            (path: "/api/feed", json: "{\"entries\":[\(itemEntryJSON(id: "i2", slug: "b")),\(itemEntryJSON(id: "i3", slug: "c"))],\"nextCursor\":null}")
        ])
        await vm.loadMore()
        XCTAssertEqual(vm.entries.map(\.id), ["item:i1", "item:i2", "item:i3"], "duplicate dropped")
        XCTAssertFalse(vm.canLoadMore)

        // With no cursor, loadMore is a no-op (no request fired).
        MockURLProtocol.handler = { _ in
            XCTFail("should not fetch without a cursor")
            throw APIError.badURL
        }
        await vm.loadMore()
    }

    func testErrorSurfacesMessageAndKeepsOldEntries() async {
        let vm = makeVM()
        TestSupport.stubRoutes([
            (path: "/api/feed", json: "{\"entries\":[\(itemEntryJSON(id: "i1", slug: "a"))],\"nextCursor\":null}")
        ])
        await vm.refresh()
        XCTAssertEqual(vm.entries.count, 1)

        TestSupport.stub(status: 500, json: #"{"error":"boom"}"#)
        await vm.refresh()
        XCTAssertNotNil(vm.errorMessage)
        XCTAssertEqual(vm.entries.count, 1, "stale entries kept on refresh failure")
    }
}

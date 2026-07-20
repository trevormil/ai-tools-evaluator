import XCTest
@testable import AIx

/// APIClient behavior against a stubbed network: correct paths/queries,
/// error mapping, and no auth headers (the API is public read-only).
final class APIClientTests: XCTestCase {
    override func tearDown() {
        MockURLProtocol.handler = nil
        super.tearDown()
    }

    func testItemsQuerySerializesFilters() async throws {
        let recorder = TestSupport.stub(json: #"{"items":[],"count":0}"#)
        var query = ItemQuery()
        query.category = .mcpServer
        query.verdict = .essential
        query.search = "grep"
        query.sort = .top
        _ = try await TestSupport.client().fetchItems(query)

        let url = try XCTUnwrap(recorder.last?.url)
        XCTAssertEqual(url.path, "/api/v1/items")
        let components = try XCTUnwrap(URLComponents(url: url, resolvingAgainstBaseURL: false))
        let params = Dictionary(uniqueKeysWithValues: (components.queryItems ?? []).map { ($0.name, $0.value ?? "") })
        XCTAssertEqual(params["category"], "mcp-server")
        XCTAssertEqual(params["verdict"], "essential")
        XCTAssertEqual(params["q"], "grep")
        XCTAssertEqual(params["sort"], "top")
    }

    func testNoAuthorizationHeaderEver() async throws {
        let recorder = TestSupport.stub(json: #"{"entries":[],"nextCursor":null}"#)
        _ = try await TestSupport.client().fetchFeed(cursor: nil)
        XCTAssertNil(recorder.last?.value(forHTTPHeaderField: "Authorization"))
    }

    func testFeedQueryCarriesCursorAndAllMode() async throws {
        let recorder = TestSupport.stub(json: #"{"entries":[],"nextCursor":null}"#)
        _ = try await TestSupport.client().fetchFeed(cursor: "123:abc")
        let url = try XCTUnwrap(recorder.last?.url)
        let components = try XCTUnwrap(URLComponents(url: url, resolvingAgainstBaseURL: false))
        let params = Dictionary(uniqueKeysWithValues: (components.queryItems ?? []).map { ($0.name, $0.value ?? "") })
        XCTAssertEqual(params["mode"], "all")
        XCTAssertEqual(params["cursor"], "123:abc")
    }

    func test404MapsToNotFound() async {
        TestSupport.stub(status: 404, json: #"{"error":"Not found"}"#)
        do {
            _ = try await TestSupport.client().fetchDailyPick()
            XCTFail("expected throw")
        } catch {
            XCTAssertEqual(error as? APIError, .notFound)
        }
    }

    func testServerErrorMapsToHTTPCode() async {
        TestSupport.stub(status: 503, json: #"{"error":"down"}"#)
        do {
            _ = try await TestSupport.client().fetchLeaderboard()
            XCTFail("expected throw")
        } catch {
            XCTAssertEqual(error as? APIError, .http(503))
        }
    }

    func testGarbageBodyMapsToDecodingError() async {
        TestSupport.stub(json: "not json at all")
        do {
            _ = try await TestSupport.client().fetchLatestRecap()
            XCTFail("expected throw")
        } catch {
            guard case .decoding = error as? APIError else {
                return XCTFail("expected decoding error, got \(error)")
            }
        }
    }

    func testRecapPathsAreCorrect() async throws {
        let recorder = TestSupport.stub(json: #"{"dates":["2026-07-19"]}"#)
        _ = try await TestSupport.client().fetchRecapArchive()
        XCTAssertEqual(recorder.last?.url?.path, "/api/v1/recap/archive")

        let recapJSON = #"{"recap":{"date":"2026-07-19","total":0,"verdictCounts":{},"summary":"","items":[],"leadPick":null,"complexityTrap":null,"topAdopted":[]}}"#
        let dated = TestSupport.stub(json: recapJSON)
        _ = try await TestSupport.client().fetchRecap(date: "2026-07-19")
        XCTAssertEqual(dated.last?.url?.path, "/api/v1/recap/2026-07-19")
    }
}

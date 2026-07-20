import XCTest
@testable import AIx

/// APIClient behavior against a stubbed network: correct paths, bearer
/// headers, JSON bodies, and error mapping — no real network.
final class APIClientTests: XCTestCase {
    override func tearDown() {
        MockURLProtocol.handler = nil
        super.tearDown()
    }

    func testBearerTokenIsAttachedWhenPresent() async throws {
        let recorder = TestSupport.stub(json: #"{"user":{"id":"u1","username":"me","displayName":null,"avatarUrl":null,"bio":null,"role":"user","createdAt":"2026-01-01T00:00:00.000Z"},"unreadNotifications":0,"unreadMessages":0}"#)
        _ = try await TestSupport.client(token: "tok123").fetchMe()
        XCTAssertEqual(recorder.last?.value(forHTTPHeaderField: "Authorization"), "Bearer tok123")
        XCTAssertEqual(recorder.last?.url?.path, "/api/me")
    }

    func testNoAuthorizationHeaderWithoutToken() async throws {
        let recorder = TestSupport.stub(json: #"{"items":[],"count":0}"#)
        _ = try await TestSupport.client().fetchItems(ItemQuery())
        XCTAssertNil(recorder.last?.value(forHTTPHeaderField: "Authorization"))
    }

    func testVotePostsTheExactTogglePayload() async throws {
        let recorder = TestSupport.stub(json: #"{"net":4,"value":1}"#)
        let result = try await TestSupport.client(token: "t").vote(targetType: "item", targetId: "i1", value: 1)
        XCTAssertEqual(result.net, 4)
        XCTAssertEqual(recorder.last?.httpMethod, "POST")
        XCTAssertEqual(recorder.last?.url?.path, "/api/votes")
        let body = recorder.lastBodyJSON
        XCTAssertEqual(body?["targetType"] as? String, "item")
        XCTAssertEqual(body?["targetId"] as? String, "i1")
        XCTAssertEqual(body?["value"] as? Int, 1)
    }

    func testStackUpsertOmitsNilFields() async throws {
        let recorder = TestSupport.stub(json: #"{"entry":{"id":"s1","status":"using","take":null,"rating":null,"toolName":null,"itemId":"i1","updatedAt":1}}"#)
        _ = try await TestSupport.client(token: "t").upsertStack(itemId: "i1", toolName: nil, status: "using", take: nil, rating: nil)
        let body = recorder.lastBodyJSON
        XCTAssertEqual(body?["itemId"] as? String, "i1")
        XCTAssertEqual(body?["status"] as? String, "using")
        XCTAssertNil(body?["toolName"])
        XCTAssertNil(body?["rating"])
    }

    func test401MapsToUnauthorized() async {
        TestSupport.stub(status: 401, json: #"{"error":"Not authenticated"}"#)
        do {
            _ = try await TestSupport.client().fetchMe()
            XCTFail("expected throw")
        } catch {
            XCTAssertEqual(error as? APIError, .unauthorized)
        }
    }

    func test404MapsToNotFound() async {
        TestSupport.stub(status: 404, json: #"{"error":"Not found"}"#)
        do {
            _ = try await TestSupport.client().fetchEvaluation(slug: "nope")
            XCTFail("expected throw")
        } catch {
            XCTAssertEqual(error as? APIError, .notFound)
        }
    }

    func testFeedQueryCarriesModeAndCursor() async throws {
        let recorder = TestSupport.stub(json: #"{"entries":[],"nextCursor":null}"#)
        _ = try await TestSupport.client(token: "t").fetchFeed(mode: "following", cursor: "123:abc")
        let url = try XCTUnwrap(recorder.last?.url)
        let components = try XCTUnwrap(URLComponents(url: url, resolvingAgainstBaseURL: false))
        let params = Dictionary(uniqueKeysWithValues: (components.queryItems ?? []).map { ($0.name, $0.value ?? "") })
        XCTAssertEqual(params["mode"], "following")
        XCTAssertEqual(params["cursor"], "123:abc")
    }

    func testDeleteStackSendsDELETEWithBody() async throws {
        let recorder = TestSupport.stub(json: #"{"ok":true}"#)
        try await TestSupport.client(token: "t").deleteStackEntry(id: "s9")
        XCTAssertEqual(recorder.last?.httpMethod, "DELETE")
        XCTAssertEqual(recorder.lastBodyJSON?["id"] as? String, "s9")
    }
}

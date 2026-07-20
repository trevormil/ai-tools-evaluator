import XCTest
@testable import AIx

@MainActor
final class TrendingViewModelTests: XCTestCase {
    override func tearDown() {
        MockURLProtocol.handler = nil
        super.tearDown()
    }

    private func makeVM() -> TrendingViewModel {
        TrendingViewModel(client: TestSupport.client())
    }

    private let repoJSON = #"{"source":"github","window":"weekly","repos":[{"fullName":"acme/hot","url":"https://github.com/acme/hot","description":"d","stars":42,"language":"Rust","createdAt":null,"avatarUrl":null,"forks":2,"openIssues":1,"topics":[],"homepage":null,"license":"MIT","pushedAt":null}]}"#
    private let productJSON = #"{"source":"producthunt","window":"daily","products":[{"name":"CoolLaunch","tagline":"t","url":"https://producthunt.com/posts/cool","votes":99,"topics":["AI"],"thumbnailUrl":null,"description":"story","commentsCount":4,"website":null,"mediaUrls":[]}]}"#

    func testGithubPaneLoadsWithDefaultWeeklyWindow() async throws {
        let vm = makeVM()
        let recorder = TestSupport.stub(json: repoJSON)
        await vm.loadCurrent()

        guard case .loaded(.repos(let repos)) = vm.currentState else {
            return XCTFail("expected loaded repos, got \(vm.currentState)")
        }
        XCTAssertEqual(repos[0].fullName, "acme/hot")
        let url = try XCTUnwrap(recorder.last?.url)
        XCTAssertEqual(url.path, "/api/v1/trending/github")
        // This Week is the default lens.
        XCTAssertTrue(url.query?.contains("window=weekly") == true)
    }

    func testSourceAndWindowSwitchLoadSeparatePanes() async {
        let vm = makeVM()
        TestSupport.stub(json: repoJSON)
        await vm.loadCurrent()

        vm.source = .producthunt
        vm.window = .daily
        let recorder = TestSupport.stub(json: productJSON)
        await vm.loadCurrent()

        guard case .loaded(.products(let products)) = vm.currentState else {
            return XCTFail("expected loaded products")
        }
        XCTAssertEqual(products[0].votes, 99)
        XCTAssertTrue(recorder.last?.url?.path == "/api/v1/trending/producthunt")
        XCTAssertTrue(recorder.last?.url?.query?.contains("window=daily") == true)

        // Flipping back is instant — the github pane is already loaded.
        vm.source = .github
        vm.window = .weekly
        MockURLProtocol.handler = { _ in
            XCTFail("already-loaded pane must not refetch")
            throw APIError.badURL
        }
        await vm.loadCurrent()
        guard case .loaded(.repos) = vm.currentState else {
            return XCTFail("expected cached repos pane")
        }
    }

    func testCancelledRefreshKeepsTheLoadedPane() async {
        let vm = makeVM()
        TestSupport.stub(json: repoJSON)
        await vm.loadCurrent()

        // Pull-to-refresh torn down mid-flight (URLSession cancels the task):
        // the pane must keep its data instead of flipping to an error.
        MockURLProtocol.handler = { _ in throw URLError(.cancelled) }
        await vm.loadCurrent(force: true)
        guard case .loaded(.repos(let repos)) = vm.currentState else {
            return XCTFail("cancelled refresh must not clear the pane, got \(vm.currentState)")
        }
        XCTAssertEqual(repos[0].fullName, "acme/hot")
    }

    func testUnconfiguredSourceShowsFriendlyMessage() async {
        let vm = makeVM()
        vm.source = .producthunt
        TestSupport.stub(status: 503, json: #"{"error":"Product Hunt trending needs PRODUCTHUNT_API_TOKEN"}"#)
        await vm.loadCurrent()
        guard case .failed(let message) = vm.currentState else {
            return XCTFail("expected failure state")
        }
        XCTAssertTrue(message.contains("isn't configured"))
    }

    func testForceReloadRefetchesLoadedPane() async {
        let vm = makeVM()
        TestSupport.stub(json: repoJSON)
        await vm.loadCurrent()
        let recorder = TestSupport.stub(json: repoJSON)
        await vm.loadCurrent(force: true)
        XCTAssertEqual(recorder.requests.count, 1)
    }
}

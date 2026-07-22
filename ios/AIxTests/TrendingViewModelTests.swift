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

    func testGithubPaneLoadsWithDefaultDailyWindow() async throws {
        let vm = makeVM()
        vm.source = .github // AIx (the feed) is the default source
        let recorder = TestSupport.stub(json: repoJSON)
        await vm.loadCurrent()

        guard case .loaded(.repos(let repos)) = vm.currentState else {
            return XCTFail("expected loaded repos, got \(vm.currentState)")
        }
        XCTAssertEqual(repos[0].fullName, "acme/hot")
        let url = try XCTUnwrap(recorder.last?.url)
        XCTAssertEqual(url.path, "/api/v1/trending/github")
        // Today is the default lens.
        XCTAssertTrue(url.query?.contains("window=daily") == true)
    }

    func testSourceAndWindowSwitchLoadSeparatePanes() async {
        let vm = makeVM()
        vm.source = .github
        vm.window = .weekly
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
        vm.source = .github
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
        vm.source = .github
        TestSupport.stub(json: repoJSON)
        await vm.loadCurrent()
        let recorder = TestSupport.stub(json: repoJSON)
        await vm.loadCurrent(force: true)
        XCTAssertEqual(recorder.requests.count, 1)
    }
}

// MARK: - HN + HF sources (ticket 0071)

extension TrendingViewModelTests {
    func testHackerNewsPaneLoadsStories() async throws {
        let vm = TrendingViewModel(client: TestSupport.client())
        vm.source = .hackernews
        let storiesJSON = #"{"source":"hackernews","window":"weekly","stories":[{"title":"My agent","url":"https://github.com/a/b","hnUrl":"https://news.ycombinator.com/item?id=1","points":99,"comments":12,"author":"pg","createdAt":null,"githubRepo":"a/b"}]}"#
        let recorder = TestSupport.stub(json: storiesJSON)
        await vm.loadCurrent()
        guard case .loaded(.stories(let stories)) = vm.currentState else {
            return XCTFail("expected stories, got \(vm.currentState)")
        }
        XCTAssertEqual(stories[0].githubRepo, "a/b")
        XCTAssertEqual(recorder.last?.url?.path, "/api/v1/trending/hackernews")
    }

    func testHuggingFaceIgnoresTheWindow() async throws {
        let vm = TrendingViewModel(client: TestSupport.client())
        vm.source = .huggingface
        let modelsJSON = #"{"source":"huggingface","window":"weekly","models":[{"id":"acme/mega","url":"https://huggingface.co/acme/mega","likes":10,"downloads":5000,"pipelineTag":"text-generation","tags":["en"],"createdAt":null,"description":"A 7B instruct model.","authorAvatarUrl":"https://cdn-avatars.huggingface.co/acme.png"}]}"#
        TestSupport.stub(json: modelsJSON)
        await vm.loadCurrent()
        guard case .loaded(.models(let models)) = vm.currentState else {
            return XCTFail("expected models")
        }
        XCTAssertEqual(models[0].modelName, "mega")
        XCTAssertEqual(models[0].owner, "acme")
        XCTAssertFalse(vm.source.supportsWindow)

        // Same pane regardless of window — no refetch on window change.
        vm.window = .weekly
        MockURLProtocol.handler = { _ in
            XCTFail("HF pane must not refetch on window change")
            throw APIError.badURL
        }
        await vm.loadCurrent()
        guard case .loaded(.models) = vm.currentState else {
            return XCTFail("expected cached models pane")
        }
    }
}


// MARK: - The AIx pane (combined Browse, no network from this VM)

extension TrendingViewModelTests {
    func testAixSourceIsDefaultAndNeverFetches() async {
        let vm = TrendingViewModel(client: TestSupport.client())
        XCTAssertEqual(vm.source, .aix)
        XCTAssertFalse(vm.source.supportsWindow)
        MockURLProtocol.handler = { _ in
            XCTFail("the AIx pane is FeedViewModel's job — no trending fetch")
            throw APIError.badURL
        }
        await vm.loadCurrent()
    }
}

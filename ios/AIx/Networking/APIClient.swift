import Foundation

/// Typed error surface for the API layer.
enum APIError: LocalizedError, Equatable {
    case badURL
    case notFound
    case http(Int)
    case decoding(String)
    case transport(String)

    var errorDescription: String? {
        switch self {
        case .badURL: return "Invalid request URL."
        case .notFound: return "Not found."
        case .http(let code): return "Server returned HTTP \(code)."
        case .decoding(let msg): return "Couldn't read the response. \(msg)"
        case .transport(let msg): return msg
        }
    }
}

/// Filters for the directory list. All optional; empty ones are omitted.
struct ItemQuery {
    var category: Category?
    var verdict: Verdict?
    var audience: PrimaryAudience?
    var minScore: Int?
    var search: String?
    var sort: ItemSort?
    var limit: Int = 50

    var queryItems: [URLQueryItem] {
        var items: [URLQueryItem] = []
        if let category { items.append(.init(name: "category", value: category.rawValue)) }
        if let verdict { items.append(.init(name: "verdict", value: verdict.rawValue)) }
        if let audience { items.append(.init(name: "audience", value: audience.rawValue)) }
        if let minScore { items.append(.init(name: "minScore", value: String(minScore))) }
        if let search, !search.isEmpty { items.append(.init(name: "q", value: search)) }
        if let sort { items.append(.init(name: "sort", value: sort.rawValue)) }
        items.append(.init(name: "limit", value: String(limit)))
        return items
    }
}

/// Thin async URLSession client for the AIx read-only public API.
struct APIClient {
    var baseURL: URL
    private let session: URLSession
    private let decoder = JSONDecoder()

    init(baseURL: URL = AppConfig.baseURL, session: URLSession = .shared) {
        self.baseURL = baseURL
        self.session = session
    }

    // MARK: Directory + evaluation

    /// GET /api/v1/items with filters.
    func fetchItems(_ query: ItemQuery) async throws -> [PublicItem] {
        let response: ItemsResponse = try await get(path: "/api/v1/items", query: query.queryItems)
        return response.items
    }

    /// GET /api/v1/items/<slug> — full evaluation + repo README.
    func fetchItemDetail(slug: String) async throws -> DetailResponse {
        try await get(path: "/api/v1/items/\(slug)")
    }

    func fetchEvaluation(slug: String) async throws -> Evaluation {
        try await fetchItemDetail(slug: slug).evaluation
    }

    // MARK: Feed (anonymous, read-only)

    /// GET /api/feed — the unified home timeline, cursor-paginated.
    func fetchFeed(cursor: String?, limit: Int = 30) async throws -> FeedPage {
        var query = [
            URLQueryItem(name: "mode", value: "all"),
            URLQueryItem(name: "limit", value: String(limit)),
        ]
        if let cursor { query.append(URLQueryItem(name: "cursor", value: cursor)) }
        return try await get(path: "/api/feed", query: query)
    }

    // MARK: Recap + daily pick

    func fetchLatestRecap() async throws -> Recap {
        let response: RecapResponse = try await get(path: "/api/v1/recap")
        return response.recap
    }

    func fetchRecap(date: String) async throws -> Recap {
        let response: RecapResponse = try await get(path: "/api/v1/recap/\(date)")
        return response.recap
    }

    func fetchRecapArchive() async throws -> [String] {
        let response: RecapArchive = try await get(path: "/api/v1/recap/archive")
        return response.dates
    }

    /// GET /api/v1/daily-pick — 404s (throws .notFound) until a pick exists.
    func fetchDailyPick() async throws -> DailyPick {
        try await get(path: "/api/v1/daily-pick")
    }

    // MARK: Live trending (server-proxied, ticket 0067)

    func fetchGithubTrending(window: TrendingWindow) async throws -> [TrendingRepo] {
        let response: GithubTrendingResponse = try await get(
            path: "/api/v1/trending/github",
            query: [URLQueryItem(name: "window", value: window.rawValue)]
        )
        return response.repos
    }

    func fetchProductHuntTrending(window: TrendingWindow) async throws -> [TrendingProduct] {
        let response: ProductHuntTrendingResponse = try await get(
            path: "/api/v1/trending/producthunt",
            query: [URLQueryItem(name: "window", value: window.rawValue)]
        )
        return response.products
    }

    // MARK: Plumbing

    private func get<T: Decodable>(path: String, query: [URLQueryItem] = []) async throws -> T {
        guard var components = URLComponents(url: baseURL, resolvingAgainstBaseURL: false) else {
            throw APIError.badURL
        }
        components.path = path
        if !query.isEmpty { components.queryItems = query }
        guard let url = components.url else { throw APIError.badURL }

        var request = URLRequest(url: url)
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.timeoutInterval = 20

        let data: Data
        let response: URLResponse
        do {
            (data, response) = try await session.data(for: request)
        } catch {
            throw APIError.transport(error.localizedDescription)
        }

        if let http = response as? HTTPURLResponse {
            if http.statusCode == 404 { throw APIError.notFound }
            guard (200..<300).contains(http.statusCode) else {
                throw APIError.http(http.statusCode)
            }
        }

        do {
            return try decoder.decode(T.self, from: data)
        } catch {
            throw APIError.decoding(String(describing: error))
        }
    }
}

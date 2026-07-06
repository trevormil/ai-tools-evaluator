import Foundation

/// Typed error surface for the API layer.
enum APIError: LocalizedError {
    case badURL
    case notFound
    case http(Int)
    case decoding(String)
    case transport(String)

    var errorDescription: String? {
        switch self {
        case .badURL: return "Invalid request URL."
        case .notFound: return "Item not found."
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

/// Thin async/await URLSession client for the AIx public API.
struct APIClient {
    var baseURL: URL
    private let session: URLSession
    private let decoder = JSONDecoder()

    init(baseURL: URL = AppConfig.baseURL, session: URLSession = .shared) {
        self.baseURL = baseURL
        self.session = session
    }

    /// GET /api/v1/items with filters.
    func fetchItems(_ query: ItemQuery) async throws -> [PublicItem] {
        guard var components = URLComponents(url: baseURL, resolvingAgainstBaseURL: false) else {
            throw APIError.badURL
        }
        components.path = "/api/v1/items"
        components.queryItems = query.queryItems
        guard let url = components.url else { throw APIError.badURL }
        let response: ItemsResponse = try await get(url)
        return response.items
    }

    /// GET /api/v1/items/<slug> — the full evaluation.
    func fetchEvaluation(slug: String) async throws -> Evaluation {
        let url = baseURL
            .appendingPathComponent("api")
            .appendingPathComponent("v1")
            .appendingPathComponent("items")
            .appendingPathComponent(slug)
        let response: DetailResponse = try await get(url)
        return response.evaluation
    }

    private func get<T: Decodable>(_ url: URL) async throws -> T {
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

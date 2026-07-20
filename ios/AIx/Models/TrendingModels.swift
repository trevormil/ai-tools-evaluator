import Foundation

// MARK: - Live trending (GET /api/v1/trending/{source}?window=…, ticket 0067)

enum TrendingWindow: String, CaseIterable, Identifiable {
    case daily, weekly
    var id: String { rawValue }
    var label: String { self == .daily ? "Today" : "This Week" }
}

struct TrendingRepo: Codable, Hashable, Identifiable {
    let fullName: String
    let url: String
    let description: String?
    let stars: Int
    let language: String?
    let createdAt: String?

    var id: String { fullName }
    var pageURL: URL? { URL(string: url) }
}

struct TrendingProduct: Codable, Hashable, Identifiable {
    let name: String
    let tagline: String
    let url: String
    let votes: Int
    let topics: [String]

    var id: String { url }
    var pageURL: URL? { URL(string: url) }
}

struct GithubTrendingResponse: Codable {
    let repos: [TrendingRepo]
}

struct ProductHuntTrendingResponse: Codable {
    let products: [TrendingProduct]
}

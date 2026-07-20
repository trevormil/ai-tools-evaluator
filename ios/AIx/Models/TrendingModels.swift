import Foundation

// MARK: - Live trending (GET /api/v1/trending/{source}?window=…, ticket 0067/0070)

enum TrendingWindow: String, CaseIterable, Identifiable {
    case daily, weekly
    var id: String { rawValue }
    var label: String { self == .daily ? "Today" : "This Week" }
}

/// Enriched fields decode with defaults so the app also works against a
/// server that predates them (deploys and app updates aren't atomic).
struct TrendingRepo: Codable, Hashable, Identifiable {
    let fullName: String
    let url: String
    let description: String?
    let stars: Int
    let language: String?
    let createdAt: String?
    let avatarUrl: String?
    let forks: Int
    let openIssues: Int
    let topics: [String]
    let homepage: String?
    let license: String?
    let pushedAt: String?

    var id: String { fullName }
    var pageURL: URL? { URL(string: url) }
    var avatarURL: URL? { avatarUrl.flatMap(URL.init(string:)) }
    var homepageURL: URL? { homepage.flatMap(URL.init(string:)) }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        fullName = try c.decode(String.self, forKey: .fullName)
        url = try c.decode(String.self, forKey: .url)
        description = try c.decodeIfPresent(String.self, forKey: .description)
        stars = try c.decodeIfPresent(Int.self, forKey: .stars) ?? 0
        language = try c.decodeIfPresent(String.self, forKey: .language)
        createdAt = try c.decodeIfPresent(String.self, forKey: .createdAt)
        avatarUrl = try c.decodeIfPresent(String.self, forKey: .avatarUrl)
        forks = try c.decodeIfPresent(Int.self, forKey: .forks) ?? 0
        openIssues = try c.decodeIfPresent(Int.self, forKey: .openIssues) ?? 0
        topics = try c.decodeIfPresent([String].self, forKey: .topics) ?? []
        homepage = try c.decodeIfPresent(String.self, forKey: .homepage)
        license = try c.decodeIfPresent(String.self, forKey: .license)
        pushedAt = try c.decodeIfPresent(String.self, forKey: .pushedAt)
    }
}

struct TrendingProduct: Codable, Hashable, Identifiable {
    let name: String
    let tagline: String
    let url: String
    let votes: Int
    let topics: [String]
    let thumbnailUrl: String?
    let description: String?
    let commentsCount: Int
    let website: String?
    let mediaUrls: [String]

    var id: String { url }
    var pageURL: URL? { URL(string: url) }
    var thumbnailURL: URL? { thumbnailUrl.flatMap(URL.init(string:)) }
    var websiteURL: URL? { website.flatMap(URL.init(string:)) }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        name = try c.decode(String.self, forKey: .name)
        tagline = try c.decodeIfPresent(String.self, forKey: .tagline) ?? ""
        url = try c.decode(String.self, forKey: .url)
        votes = try c.decodeIfPresent(Int.self, forKey: .votes) ?? 0
        topics = try c.decodeIfPresent([String].self, forKey: .topics) ?? []
        thumbnailUrl = try c.decodeIfPresent(String.self, forKey: .thumbnailUrl)
        description = try c.decodeIfPresent(String.self, forKey: .description)
        commentsCount = try c.decodeIfPresent(Int.self, forKey: .commentsCount) ?? 0
        website = try c.decodeIfPresent(String.self, forKey: .website)
        mediaUrls = try c.decodeIfPresent([String].self, forKey: .mediaUrls) ?? []
    }
}

struct GithubTrendingResponse: Codable {
    let repos: [TrendingRepo]
}

struct ProductHuntTrendingResponse: Codable {
    let products: [TrendingProduct]
}

/// GET /api/v1/trending/github/readme?repo=owner/name — GitHub-rendered HTML.
struct TrendingReadme: Codable {
    let repo: String
    let readmeHtml: String?
}

// MARK: - HackerNews (Show HN) + Hugging Face (ticket 0071)

struct TrendingStory: Codable, Hashable, Identifiable {
    let title: String
    let url: String?
    let hnUrl: String
    let points: Int
    let comments: Int
    let author: String?
    let createdAt: String?
    let githubRepo: String?

    var id: String { hnUrl }
    var pageURL: URL? { url.flatMap(URL.init(string:)) }
    var discussionURL: URL? { URL(string: hnUrl) }
    /// The numeric story id parsed from the discussion URL.
    var storyID: String? {
        URLComponents(string: hnUrl)?.queryItems?.first { $0.name == "id" }?.value
    }
    var domain: String? { pageURL?.host()?.replacingOccurrences(of: "www.", with: "") }
}

struct TrendingModel: Codable, Hashable, Identifiable {
    let id: String // "owner/name"
    let url: String
    let likes: Int
    let downloads: Int
    let pipelineTag: String?
    let tags: [String]
    let createdAt: String?
    /// First prose line of the model card (nil from older servers).
    let description: String?

    var pageURL: URL? { URL(string: url) }
    var owner: String { String(id.split(separator: "/").first ?? "") }
    var modelName: String { String(id.split(separator: "/").last ?? "") }
}

struct HackerNewsTrendingResponse: Codable {
    let stories: [TrendingStory]
}

struct HuggingFaceTrendingResponse: Codable {
    let models: [TrendingModel]
}

/// GET /api/v1/trending/huggingface/readme?model=owner/name
struct ModelCardResponse: Codable {
    let model: String
    let readmeHtml: String?
}

/// GET /api/v1/trending/hackernews/item?id=… — story + top-level comments.
struct HnComment: Codable, Hashable, Identifiable {
    let author: String?
    let text: String
    let createdAt: String?
    let replies: Int

    var id: String { "\(author ?? "?"):\(text.prefix(40))" }
}

struct HnItemDetail: Codable, Hashable {
    let id: Int
    let title: String
    let text: String?
    let points: Int
    let author: String?
    let createdAt: String?
    let comments: [HnComment]
}

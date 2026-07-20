import Foundation

// MARK: - Raw feed rows (lib/home-feed.ts shapes — read-only browsing)

/// User subset as it appears inside feed entries.
struct DBUser: Codable, Hashable, Identifiable {
    let id: String
    let username: String
    let displayName: String?
    let avatarUrl: String?

    var avatarURL: URL? { avatarUrl.flatMap(URL.init(string:)) }
    var name: String { displayName?.isEmpty == false ? displayName! : username }
}

/// Raw item row as it appears in feed entries and embeds.
struct DBItem: Codable, Hashable, Identifiable {
    let id: String
    let slug: String
    let title: String
    let tagline: String
    let category: Category
    let verdict: Verdict
    let overallScore: Int
    let noiseScore: Int
    let coverImageUrl: String?
    let upvotes: Int
    let commentCount: Int
    let createdAt: Int
    let scoreStatus: String?

    var isPending: Bool { scoreStatus == "pending" }
    var coverURL: URL? { coverImageUrl.flatMap(URL.init(string:)) }
}

struct DBPost: Codable, Hashable, Identifiable {
    let id: String
    let authorId: String
    let body: String
    let itemId: String?
    let upvotes: Int
    let commentCount: Int
    let createdAt: Int
}

struct DBActivity: Codable, Hashable, Identifiable {
    let id: String
    let actorId: String
    let verb: String
    let objectType: String?
    let objectId: String?
    let createdAt: Int
}

/// Embedded object inside an activity entry (lib/home-feed.ts FeedEmbed).
enum FeedEmbed: Hashable {
    case post(post: DBPost, author: DBUser, item: DBItem?)
    case item(DBItem)
    case stack(item: DBItem?, toolName: String?, status: String, take: String?)
    case comment(body: String, item: DBItem?, href: String)
    case unknown
}

extension FeedEmbed: Decodable {
    private enum CodingKeys: String, CodingKey {
        case type, post, author, item, toolName, status, take, body, href
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        switch try c.decodeIfPresent(String.self, forKey: .type) {
        case "post":
            self = .post(
                post: try c.decode(DBPost.self, forKey: .post),
                author: try c.decode(DBUser.self, forKey: .author),
                item: try c.decodeIfPresent(DBItem.self, forKey: .item)
            )
        case "item":
            self = .item(try c.decode(DBItem.self, forKey: .item))
        case "stack":
            self = .stack(
                item: try c.decodeIfPresent(DBItem.self, forKey: .item),
                toolName: try c.decodeIfPresent(String.self, forKey: .toolName),
                status: try c.decodeIfPresent(String.self, forKey: .status) ?? "using",
                take: try c.decodeIfPresent(String.self, forKey: .take)
            )
        case "comment":
            self = .comment(
                body: try c.decodeIfPresent(String.self, forKey: .body) ?? "",
                item: try c.decodeIfPresent(DBItem.self, forKey: .item),
                href: try c.decodeIfPresent(String.self, forKey: .href) ?? "/"
            )
        default:
            self = .unknown
        }
    }
}

/// One unified-feed entry (lib/home-feed.ts FeedEntry) — a tagged union on `kind`.
enum FeedEntry: Hashable, Identifiable {
    case post(post: DBPost, author: DBUser, item: DBItem?, createdAt: Int)
    case item(item: DBItem, createdAt: Int)
    case activity(activity: DBActivity, actor: DBUser, label: String, quote: String?, embed: FeedEmbed?, createdAt: Int)
    case unknown

    var id: String {
        switch self {
        case .post(let post, _, _, _): return "post:\(post.id)"
        case .item(let item, _): return "item:\(item.id)"
        case .activity(let activity, _, _, _, _, _): return "act:\(activity.id)"
        case .unknown: return "unknown:\(UUID().uuidString)"
        }
    }
}

extension FeedEntry: Decodable {
    private enum CodingKeys: String, CodingKey {
        case kind, createdAt, post, author, item, activity, actor, label, quote, embed
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        let createdAt = try c.decodeIfPresent(Int.self, forKey: .createdAt) ?? 0
        switch try c.decodeIfPresent(String.self, forKey: .kind) {
        case "post":
            self = .post(
                post: try c.decode(DBPost.self, forKey: .post),
                author: try c.decode(DBUser.self, forKey: .author),
                item: try c.decodeIfPresent(DBItem.self, forKey: .item),
                createdAt: createdAt
            )
        case "item":
            self = .item(
                item: try c.decode(DBItem.self, forKey: .item),
                createdAt: createdAt
            )
        case "activity":
            self = .activity(
                activity: try c.decode(DBActivity.self, forKey: .activity),
                actor: try c.decode(DBUser.self, forKey: .actor),
                label: try c.decodeIfPresent(String.self, forKey: .label) ?? "",
                quote: try c.decodeIfPresent(String.self, forKey: .quote),
                embed: try c.decodeIfPresent(FeedEmbed.self, forKey: .embed),
                createdAt: createdAt
            )
        default:
            self = .unknown
        }
    }
}

struct FeedPage: Decodable {
    let entries: [FeedEntry]
    let nextCursor: String?
}

// MARK: - Recap + daily pick (v1 read APIs)

struct Recap: Codable {
    let date: String // "YYYY-MM-DD"
    let total: Int
    let verdictCounts: [String: Int]
    let summary: String
    let items: [PublicItem]
    let leadPick: PublicItem?
    let complexityTrap: PublicItem?
    let topAdopted: [PublicItem]
}

struct RecapResponse: Codable {
    let recap: Recap
}

struct RecapArchive: Codable {
    let dates: [String]
}

struct DailyPick: Codable {
    let item: PublicItem
    let pickedAt: String // ISO-8601
}

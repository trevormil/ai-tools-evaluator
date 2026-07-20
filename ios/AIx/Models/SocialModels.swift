import Foundation

// MARK: - Users & session (lib/public-api.ts PublicUser, /api/me)

/// Public projection of a user (lib/public-api.ts `toPublicUser`).
struct PublicUser: Codable, Hashable, Identifiable {
    let id: String
    let username: String
    let displayName: String?
    let avatarUrl: String?
    let bio: String?
    let role: String
    let createdAt: String // ISO-8601

    var avatarURL: URL? { avatarUrl.flatMap(URL.init(string:)) }
    var name: String { displayName?.isEmpty == false ? displayName! : username }
}

/// GET /api/me — session bootstrap + tab badge counts.
struct MeResponse: Codable {
    let user: PublicUser
    let unreadNotifications: Int
    let unreadMessages: Int
}

/// Raw user row as it appears inside feed entries (subset of columns).
struct DBUser: Codable, Hashable, Identifiable {
    let id: String
    let username: String
    let displayName: String?
    let avatarUrl: String?

    var avatarURL: URL? { avatarUrl.flatMap(URL.init(string:)) }
    var name: String { displayName?.isEmpty == false ? displayName! : username }
}

// MARK: - Item social (GET /api/v1/items/{slug}/social)

struct ItemTake: Codable, Hashable, Identifiable {
    let id: String
    let status: String
    let rating: Int?
    let take: String
    let updatedAt: Int // epoch seconds
    let followedByViewer: Bool
    let user: PublicUser
}

struct CommentAuthor: Codable, Hashable {
    let username: String
    let displayName: String?
    let avatarUrl: String?

    var avatarURL: URL? { avatarUrl.flatMap(URL.init(string:)) }
}

struct CommentNode: Codable, Hashable, Identifiable {
    let id: String
    let body: String
    let createdAt: Int
    let upvotes: Int
    let parentId: String?
    let author: CommentAuthor
    let children: [CommentNode]
}

struct ItemSocial: Codable, Hashable {
    let takes: [ItemTake]
    let comments: [CommentNode]
    let useCount: Int
    let byStatus: [String: Int]
    let upvotes: Int
    let commentCount: Int
}

/// The viewer's own stack row (raw DB shape from lib/takes.ts).
struct StackEntry: Codable, Hashable, Identifiable {
    let id: String
    let status: String
    let take: String?
    let rating: Int?
    let toolName: String?
    let itemId: String?
    let updatedAt: Int?
}

struct SocialViewer: Codable, Hashable {
    let vote: Int
    let commentVotes: [String: Int]
    let stack: StackEntry?
}

struct SocialResponse: Codable {
    let social: ItemSocial
    let viewer: SocialViewer?
}

// MARK: - Profiles (GET /api/v1/users/{username})

struct ProfileLinkDTO: Codable, Hashable {
    let kind: String
    let url: String
}

struct FollowCounts: Codable, Hashable {
    let followers: Int
    let following: Int
}

/// Compact item reference embedded in takes / stack rows.
struct TakeItemRef: Codable, Hashable {
    let slug: String
    let title: String
    let verdict: Verdict
    let overallScore: Int
    let coverImageUrl: String?
}

struct UserTake: Codable, Hashable, Identifiable {
    let id: String
    let status: String
    let rating: Int?
    let take: String
    let updatedAt: Int
    let toolName: String?
    let item: TakeItemRef?
}

struct ProfileStackEntry: Codable, Hashable, Identifiable {
    let id: String
    let status: String
    let rating: Int?
    let take: String?
    let toolName: String?
    let updatedAt: Int
    let item: TakeItemRef?

    var displayName: String { item?.title ?? toolName ?? "Unknown tool" }
}

struct ProfileViewer: Codable, Hashable {
    let following: Bool
    let isSelf: Bool

    enum CodingKeys: String, CodingKey {
        case following
        case isSelf = "self"
    }
}

struct ProfileResponse: Decodable {
    let user: PublicUser
    let links: [ProfileLinkDTO]
    let counts: FollowCounts
    let takes: [UserTake]
    let stack: [ProfileStackEntry]
    let activity: [FeedEntry]
    let broughtIn: [PublicItem]
    let viewer: ProfileViewer?
}

// MARK: - Leaderboard & recap (GET /api/v1/leaderboard, /api/v1/recap*)

struct LeaderboardResponse: Codable {
    let topRated: [PublicItem]
    let mostDiscussed: [PublicItem]
    let hallOfShame: [PublicItem]
}

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

// MARK: - Feed (GET /api/feed — lib/home-feed.ts shapes, raw DB rows)

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
    case post(post: DBPost, author: DBUser, item: DBItem?, myVote: Int, repostCount: Int, reposted: Bool, createdAt: Int)
    case item(item: DBItem, myVote: Int, repostCount: Int, reposted: Bool, createdAt: Int)
    case activity(activity: DBActivity, actor: DBUser, label: String, href: String, quote: String?, embed: FeedEmbed?, createdAt: Int)
    case unknown

    var id: String {
        switch self {
        case .post(let post, _, _, _, _, _, _): return "post:\(post.id)"
        case .item(let item, _, _, _, _): return "item:\(item.id)"
        case .activity(let activity, _, _, _, _, _, _): return "act:\(activity.id)"
        case .unknown: return "unknown:\(UUID().uuidString)"
        }
    }

    var createdAt: Int {
        switch self {
        case .post(_, _, _, _, _, _, let t), .item(_, _, _, _, let t), .activity(_, _, _, _, _, _, let t):
            return t
        case .unknown:
            return 0
        }
    }
}

extension FeedEntry: Decodable {
    private enum CodingKeys: String, CodingKey {
        case kind, createdAt, post, author, item, myVote, repostCount, reposted
        case activity, actor, label, href, quote, embed
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
                myVote: try c.decodeIfPresent(Int.self, forKey: .myVote) ?? 0,
                repostCount: try c.decodeIfPresent(Int.self, forKey: .repostCount) ?? 0,
                reposted: try c.decodeIfPresent(Bool.self, forKey: .reposted) ?? false,
                createdAt: createdAt
            )
        case "item":
            self = .item(
                item: try c.decode(DBItem.self, forKey: .item),
                myVote: try c.decodeIfPresent(Int.self, forKey: .myVote) ?? 0,
                repostCount: try c.decodeIfPresent(Int.self, forKey: .repostCount) ?? 0,
                reposted: try c.decodeIfPresent(Bool.self, forKey: .reposted) ?? false,
                createdAt: createdAt
            )
        case "activity":
            self = .activity(
                activity: try c.decode(DBActivity.self, forKey: .activity),
                actor: try c.decode(DBUser.self, forKey: .actor),
                label: try c.decodeIfPresent(String.self, forKey: .label) ?? "",
                href: try c.decodeIfPresent(String.self, forKey: .href) ?? "/",
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

// MARK: - Notifications (GET /api/notifications)

struct DBNotification: Codable, Hashable, Identifiable {
    let id: String
    let type: String
    let objectType: String?
    let objectId: String?
    let readAt: Int?
    let createdAt: Int

    var isUnread: Bool { readAt == nil }
}

struct NotificationRow: Codable, Hashable, Identifiable {
    let notification: DBNotification
    let actor: DBUser?
    let label: String
    let href: String

    var id: String { notification.id }
}

struct NotificationsResponse: Codable {
    let notifications: [NotificationRow]
    let unread: Int
}

// MARK: - Messages (GET/POST /api/messages, GET /api/messages/{userId})

struct DBMessage: Codable, Hashable, Identifiable {
    let id: String
    let fromUserId: String
    let toUserId: String
    let body: String
    let readAt: Int?
    let createdAt: Int
}

struct Conversation: Codable, Hashable, Identifiable {
    let correspondent: DBUser
    let lastMessage: DBMessage
    let unread: Int

    var id: String { correspondent.id }
}

struct ConversationsResponse: Codable {
    let conversations: [Conversation]
}

struct ThreadResponse: Codable {
    let messages: [DBMessage]
}

// MARK: - Submissions (GET/POST /api/submissions)

struct Submission: Codable, Hashable, Identifiable {
    let id: String
    let url: String
    let note: String?
    let status: String // queued | processing | published | duplicate | rejected | failed
    let reason: String?
    let itemId: String?
    let createdAt: Int
}

struct SubmissionsResponse: Codable {
    let submissions: [Submission]
}

struct SubmittedItemRef: Codable, Hashable {
    let slug: String
    let title: String
}

struct SubmitResult: Codable {
    let submission: Submission
    let duplicate: Bool
    let item: SubmittedItemRef
}

// MARK: - Mutation results

struct VoteResult: Codable, Hashable {
    let net: Int
    let value: Int
}

struct FollowResult: Codable, Hashable {
    let following: Bool
}

struct RepostResult: Codable, Hashable {
    let reposted: Bool
    let count: Int
}

struct StackUpsertResult: Codable {
    let entry: StackEntry
}

struct CommentResult: Codable {
    let comment: DBComment
}

/// Raw comment row returned by POST /api/comments.
struct DBComment: Codable, Hashable, Identifiable {
    let id: String
    let authorId: String
    let itemId: String?
    let postId: String?
    let parentId: String?
    let body: String
    let createdAt: Int
}

struct RescoreResult: Codable {
    let ok: Bool
    let nextEligibleAt: Int?
}

/// Dev-login JSON (AIX_DEV_LOGIN=1 simulators only).
struct DevLoginResult: Codable {
    let token: String
}

import XCTest
@testable import AIx

/// Decoding contracts against fixture JSON shaped exactly like the server
/// responses (apps/web lib/public-api.ts, home-feed.ts, v1 routes).
final class ModelDecodingTests: XCTestCase {
    private let decoder = JSONDecoder()

    func testPublicItemDecodesBaseAndRankedShapes() throws {
        let base = """
        {"slug":"ripgrep","title":"ripgrep","url":"https://github.com/BurntSushi/ripgrep",
         "kind":"github_repo","category":"cli-tool","integration":"standalone-app",
         "verdict":"essential","overallScore":92,"noiseScore":5,"tagline":"Fast grep.",
         "audience":"both","coverImageUrl":null,"createdAt":"2026-07-01T00:00:00.000Z"}
        """
        let item = try decoder.decode(PublicItem.self, from: Data(base.utf8))
        XCTAssertEqual(item.verdict, .essential)
        XCTAssertNil(item.upvotes)

        let ranked = """
        {"slug":"x","title":"X","url":"https://x","kind":"github_repo","category":"library",
         "integration":"library","verdict":"niche","overallScore":55,"noiseScore":40,
         "tagline":"t","audience":null,"coverImageUrl":null,
         "createdAt":"2026-07-01T00:00:00.000Z","upvotes":3,"commentCount":7,"uses":2}
        """
        let rankedItem = try decoder.decode(PublicItem.self, from: Data(ranked.utf8))
        XCTAssertEqual(rankedItem.commentCount, 7)
        XCTAssertEqual(rankedItem.uses, 2)
    }

    func testUnknownEnumValuesDecodeLeniently() throws {
        let json = """
        {"slug":"x","title":"X","url":"https://x","kind":"github_repo",
         "category":"brand-new-category","integration":"i","verdict":"galaxy-brain",
         "overallScore":10,"noiseScore":10,"tagline":"t","audience":"martian",
         "coverImageUrl":null,"createdAt":"2026-07-01T00:00:00.000Z"}
        """
        let item = try decoder.decode(PublicItem.self, from: Data(json.utf8))
        XCTAssertEqual(item.category, .other)
        XCTAssertEqual(item.verdict, .redundant)
        XCTAssertEqual(item.audience, PrimaryAudience.neither)
    }

    func testEvaluationBodyIsLensAware() throws {
        let json = """
        {"schemaVersion":1,"slug":"paper-x",
         "source":{"kind":"arxiv_paper","externalId":"2501.0001","url":"https://arxiv.org/abs/2501.0001",
                   "title":"Paper X"},
         "category":"paper","integration":"knowledge","tags":[],
         "verdict":"niche","noiseScore":30,
         "audience":{"primary":"ai-engineer","aiEngineerFit":70,"vibeCoderFit":20,"rationale":"r"},
         "scores":{"novelty":{"score":80,"rationale":"r"},"utility":{"score":50,"rationale":"r"},
                   "deltaVsBaseline":{"score":60,"rationale":"r"},"easeOfAdoption":{"score":40,"rationale":"r"},
                   "maturity":{"score":30,"rationale":"r"},"leanness":{"score":70,"rationale":"r"},
                   "traction":{"score":20,"rationale":"r"},"composability":{"score":50,"rationale":"r"},
                   "longevity":{"score":60,"rationale":"r"},"clarity":{"score":80,"rationale":"r"}},
         "overallScore":55,"tagline":"t",
         "body":{"whatItIs":"A paper about X that does Y in a novel-enough way to matter here.",
                 "vsPriorWork":"Beats prior work on Z by a small but real margin across benchmarks.",
                 "devilsAdvocate":"Narrow benchmark; may not transfer to real workloads at all.",
                 "whatWouldMakeItBetter":"Release the training code and an ablation on real tasks."},
         "media":[],"evaluatedBy":"ai","model":null,"evaluatedAt":"2026-07-01T00:00:00.000Z"}
        """
        let eval = try decoder.decode(Evaluation.self, from: Data(json.utf8))
        XCTAssertEqual(eval.lens, .research)
        let sectionKeys = eval.bodySections.map(\.key)
        XCTAssertEqual(sectionKeys, ["whatItIs", "vsPriorWork", "devilsAdvocate", "whatWouldMakeItBetter"])
        XCTAssertEqual(eval.bodySections[1].title, "How it advances prior work")
        XCTAssertNil(eval.body.vsVanilla)
    }

    func testSocialResponseDecodesNestedCommentsAndViewer() throws {
        let json = """
        {"social":{
           "takes":[{"id":"t1","status":"using","rating":5,"take":"Great","updatedAt":1750000000,
                     "followedByViewer":false,
                     "user":{"id":"u1","username":"alice","displayName":"Alice","avatarUrl":null,
                             "bio":null,"role":"user","createdAt":"2026-01-01T00:00:00.000Z"}}],
           "comments":[{"id":"c1","body":"root","createdAt":1750000000,"upvotes":2,"parentId":null,
                        "author":{"username":"alice","displayName":null,"avatarUrl":null},
                        "children":[{"id":"c2","body":"child","createdAt":1750000001,"upvotes":0,
                                     "parentId":"c1",
                                     "author":{"username":"bob","displayName":null,"avatarUrl":null},
                                     "children":[]}]}],
           "useCount":2,"byStatus":{"using":1,"trying":1},"upvotes":5,"commentCount":2},
         "viewer":{"vote":1,"commentVotes":{"c1":1},"stack":{"id":"s1","status":"trying","take":null,
                   "rating":null,"toolName":null,"itemId":"i1","updatedAt":1750000000}}}
        """
        let social = try decoder.decode(SocialResponse.self, from: Data(json.utf8))
        XCTAssertEqual(social.social.comments[0].children[0].body, "child")
        XCTAssertEqual(social.viewer?.vote, 1)
        XCTAssertEqual(social.viewer?.stack?.status, "trying")
    }

    func testFeedPageDecodesTaggedUnionEntries() throws {
        let json = """
        {"entries":[
          {"kind":"item","createdAt":1750000000,
           "item":{"id":"i1","slug":"tool","title":"Tool","tagline":"t","category":"cli-tool",
                   "verdict":"worthwhile","overallScore":70,"noiseScore":10,"coverImageUrl":null,
                   "upvotes":1,"commentCount":0,"createdAt":1750000000,"scoreStatus":"scored"},
           "myVote":1,"repostCount":0,"reposted":false},
          {"kind":"post","createdAt":1750000001,
           "post":{"id":"p1","authorId":"u1","body":"hello","itemId":null,"upvotes":0,
                   "commentCount":0,"createdAt":1750000001},
           "author":{"id":"u1","username":"alice","displayName":null,"avatarUrl":null},
           "item":null,"myVote":0,"repostCount":2,"reposted":true},
          {"kind":"activity","createdAt":1750000002,
           "activity":{"id":"a1","actorId":"u1","verb":"stack_added","objectType":"item",
                       "objectId":"i1","createdAt":1750000002},
           "actor":{"id":"u1","username":"alice","displayName":null,"avatarUrl":null},
           "label":"added Tool to their stack","href":"/item/tool","quote":null,
           "embed":{"type":"stack","item":null,"toolName":"Tool","status":"using","take":"nice"}},
          {"kind":"someday-new-kind","createdAt":1}
         ],
         "nextCursor":"1750000000:i1"}
        """
        let page = try decoder.decode(FeedPage.self, from: Data(json.utf8))
        XCTAssertEqual(page.entries.count, 4)
        guard case .item(let item, let myVote, _, _, _) = page.entries[0] else {
            return XCTFail("expected item entry")
        }
        XCTAssertEqual(item.slug, "tool")
        XCTAssertEqual(myVote, 1)
        guard case .post(_, let author, _, _, let repostCount, let reposted, _) = page.entries[1] else {
            return XCTFail("expected post entry")
        }
        XCTAssertEqual(author.username, "alice")
        XCTAssertEqual(repostCount, 2)
        XCTAssertTrue(reposted)
        guard case .activity(_, _, let label, _, _, let embed, _) = page.entries[2] else {
            return XCTFail("expected activity entry")
        }
        XCTAssertEqual(label, "added Tool to their stack")
        guard case .stack(_, let toolName, let status, let take) = embed else {
            return XCTFail("expected stack embed")
        }
        XCTAssertEqual(toolName, "Tool")
        XCTAssertEqual(status, "using")
        XCTAssertEqual(take, "nice")
        // Unknown kinds decode to .unknown instead of failing the whole page.
        guard case .unknown = page.entries[3] else {
            return XCTFail("expected unknown entry")
        }
        XCTAssertEqual(page.nextCursor, "1750000000:i1")
    }

    func testProfileResponseDecodesSelfKeyword() throws {
        let json = """
        {"user":{"id":"u1","username":"alice","displayName":null,"avatarUrl":null,"bio":null,
                 "role":"user","createdAt":"2026-01-01T00:00:00.000Z"},
         "links":[{"kind":"website","url":"https://alice.dev"}],
         "counts":{"followers":3,"following":1},
         "takes":[],"stack":[],"activity":[],"broughtIn":[],
         "viewer":{"following":true,"self":false}}
        """
        let profile = try decoder.decode(ProfileResponse.self, from: Data(json.utf8))
        XCTAssertEqual(profile.viewer?.following, true)
        XCTAssertEqual(profile.viewer?.isSelf, false)
        XCTAssertEqual(profile.links.first?.kind, "website")
    }

    func testNotificationAndConversationShapes() throws {
        let notif = """
        {"notifications":[{"notification":{"id":"n1","type":"follow","objectType":null,
                                           "objectId":null,"readAt":null,"createdAt":1750000000},
                           "actor":{"id":"u2","username":"bob","displayName":null,"avatarUrl":null},
                           "label":"@bob followed you","href":"/u/bob"}],
         "unread":1}
        """
        let list = try decoder.decode(NotificationsResponse.self, from: Data(notif.utf8))
        XCTAssertTrue(list.notifications[0].notification.isUnread)
        XCTAssertEqual(list.unread, 1)

        let convo = """
        {"conversations":[{"correspondent":{"id":"u2","username":"bob","displayName":null,
                                            "avatarUrl":null},
                           "lastMessage":{"id":"m1","fromUserId":"u2","toUserId":"u1","body":"hey",
                                          "readAt":null,"createdAt":1750000000},
                           "unread":2}]}
        """
        let conversations = try decoder.decode(ConversationsResponse.self, from: Data(convo.utf8))
        XCTAssertEqual(conversations.conversations[0].unread, 2)
        XCTAssertEqual(conversations.conversations[0].id, "u2")
    }

    func testRecapDecodes() throws {
        let json = """
        {"recap":{"date":"2026-07-19","total":2,"verdictCounts":{"essential":1,"complexity-trap":1},
          "summary":"1 essential · 1 complexity trap",
          "items":[],"leadPick":null,"complexityTrap":null,"topAdopted":[]}}
        """
        let recap = try decoder.decode(RecapResponse.self, from: Data(json.utf8)).recap
        XCTAssertEqual(recap.date, "2026-07-19")
        XCTAssertEqual(recap.verdictCounts["complexity-trap"], 1)
    }
}

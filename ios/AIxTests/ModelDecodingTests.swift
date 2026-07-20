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

    func testDetailResponseCarriesReadme() throws {
        let json = """
        {"evaluation":\(Self.evaluationJSON),"readmeMd":"# Hello"}
        """
        let detail = try decoder.decode(DetailResponse.self, from: Data(json.utf8))
        XCTAssertEqual(detail.readmeMd, "# Hello")
        XCTAssertEqual(detail.evaluation.slug, "paper-x")
    }

    func testEvaluationBodyIsLensAware() throws {
        let eval = try decoder.decode(Evaluation.self, from: Data(Self.evaluationJSON.utf8))
        XCTAssertEqual(eval.lens, .research)
        let sectionKeys = eval.bodySections.map(\.key)
        XCTAssertEqual(sectionKeys, ["whatItIs", "vsPriorWork", "devilsAdvocate", "whatWouldMakeItBetter"])
        XCTAssertEqual(eval.bodySections[1].title, "How it advances prior work")
        XCTAssertNil(eval.body.vsVanilla)
    }

    func testFeedPageDecodesTaggedUnionEntries() throws {
        let json = """
        {"entries":[
          {"kind":"item","createdAt":1750000000,
           "item":{"id":"i1","slug":"tool","title":"Tool","tagline":"t","category":"cli-tool",
                   "verdict":"worthwhile","overallScore":70,"noiseScore":10,"coverImageUrl":null,
                   "upvotes":1,"commentCount":0,"createdAt":1750000000,"scoreStatus":"scored"},
           "myVote":0,"repostCount":0,"reposted":false},
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
        guard case .item(let item, let createdAt) = page.entries[0] else {
            return XCTFail("expected item entry")
        }
        XCTAssertEqual(item.slug, "tool")
        XCTAssertEqual(createdAt, 1750000000)
        guard case .post(let post, let author, _, _) = page.entries[1] else {
            return XCTFail("expected post entry")
        }
        XCTAssertEqual(post.body, "hello")
        XCTAssertEqual(author.username, "alice")
        guard case .activity(_, _, let label, _, let embed, _) = page.entries[2] else {
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

    func testPendingFeedItemFlagsItself() throws {
        let json = """
        {"id":"i9","slug":"fresh","title":"Fresh","tagline":"t","category":"cli-tool",
         "verdict":"worthwhile","overallScore":0,"noiseScore":0,"coverImageUrl":null,
         "upvotes":0,"commentCount":0,"createdAt":1,"scoreStatus":"pending"}
        """
        let item = try decoder.decode(DBItem.self, from: Data(json.utf8))
        XCTAssertTrue(item.isPending)
    }

    func testRecapAndDailyPickDecode() throws {
        let recap = """
        {"recap":{"date":"2026-07-19","total":2,"verdictCounts":{"essential":1,"complexity-trap":1},
          "summary":"1 essential · 1 complexity trap",
          "items":[],"leadPick":null,"complexityTrap":null,"topAdopted":[]}}
        """
        let decoded = try decoder.decode(RecapResponse.self, from: Data(recap.utf8)).recap
        XCTAssertEqual(decoded.date, "2026-07-19")
        XCTAssertEqual(decoded.verdictCounts["complexity-trap"], 1)

        let pick = """
        {"item":{"slug":"x","title":"X","url":"https://x","kind":"github_repo",
                 "category":"cli-tool","integration":"i","verdict":"essential",
                 "overallScore":95,"noiseScore":3,"tagline":"t","audience":"both",
                 "coverImageUrl":null,"createdAt":"2026-07-01T00:00:00.000Z",
                 "upvotes":9,"commentCount":4},
         "pickedAt":"2026-07-20T07:00:00.000Z"}
        """
        let dailyPick = try decoder.decode(DailyPick.self, from: Data(pick.utf8))
        XCTAssertEqual(dailyPick.item.slug, "x")
    }

    func testTrendingResponsesDecode() throws {
        let github = """
        {"source":"github","window":"weekly",
         "repos":[{"fullName":"a/b","url":"https://github.com/a/b","description":null,
                   "stars":10,"language":null,"createdAt":"2026-07-18T00:00:00Z",
                   "avatarUrl":"https://avatars.githubusercontent.com/u/1",
                   "forks":3,"openIssues":1,"topics":["ai"],"homepage":null,
                   "license":"MIT","pushedAt":null}]}
        """
        let repos = try decoder.decode(GithubTrendingResponse.self, from: Data(github.utf8)).repos
        XCTAssertEqual(repos[0].fullName, "a/b")
        XCTAssertNil(repos[0].description)
        XCTAssertEqual(repos[0].forks, 3)
        XCTAssertNotNil(repos[0].avatarURL)

        let ph = """
        {"source":"producthunt","window":"daily",
         "products":[{"name":"X","tagline":"t","url":"https://ph/x","votes":5,"topics":[],
                      "thumbnailUrl":"https://ph-files.imgix.net/t.png",
                      "description":"long story","commentsCount":2,
                      "website":"https://x.io","mediaUrls":["https://ph-files.imgix.net/1.png"]}]}
        """
        let products = try decoder.decode(ProductHuntTrendingResponse.self, from: Data(ph.utf8)).products
        XCTAssertEqual(products[0].votes, 5)
        XCTAssertEqual(products[0].mediaUrls.count, 1)
        XCTAssertEqual(products[0].description, "long story")

        let readme = "{\"repo\":\"a/b\",\"readmeMd\":\"# Hi\"}"
        XCTAssertEqual(try decoder.decode(TrendingReadme.self, from: Data(readme.utf8)).readmeMd, "# Hi")

        // Pre-enrichment server payloads (no forks/topics/media keys) must
        // still decode — deploys and app updates aren't atomic.
        let legacy = """
        {"repos":[{"fullName":"a/b","url":"https://github.com/a/b","description":null,
                   "stars":10,"language":null,"createdAt":null}]}
        """
        let legacyRepo = try decoder.decode(GithubTrendingResponse.self, from: Data(legacy.utf8)).repos[0]
        XCTAssertEqual(legacyRepo.forks, 0)
        XCTAssertEqual(legacyRepo.topics, [])
    }

    // Research-lens evaluation fixture shared by two tests.
    private static let evaluationJSON = """
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
}

import Foundation

// MARK: - Enums (mirror packages/core taxonomies exactly)

/// The headline verdict. Mirrors the `Verdict` enum in packages/core/src/schema.ts.
/// Lenient decoding: an unrecognized future verdict decodes to `.redundant`
/// rather than crashing the whole list.
enum Verdict: String, CaseIterable, Codable, Hashable {
    case essential
    case worthwhile
    case niche
    case marginal
    case redundant
    case complexityTrap = "complexity-trap"

    init(from decoder: Decoder) throws {
        let raw = try decoder.singleValueContainer().decode(String.self)
        self = Verdict(rawValue: raw) ?? .redundant
    }

    var label: String {
        switch self {
        case .essential: return "Essential"
        case .worthwhile: return "Worthwhile"
        case .niche: return "Niche"
        case .marginal: return "Marginal"
        case .redundant: return "Redundant"
        case .complexityTrap: return "Complexity Trap"
        }
    }
}

/// Primary audience. Mirrors PRIMARY_AUDIENCES in packages/core/src/audience.ts.
enum PrimaryAudience: String, CaseIterable, Codable, Hashable {
    case aiEngineer = "ai-engineer"
    case vibeCoder = "vibe-coder"
    case both
    case neither

    init(from decoder: Decoder) throws {
        let raw = try decoder.singleValueContainer().decode(String.self)
        self = PrimaryAudience(rawValue: raw) ?? .neither
    }

    var label: String {
        switch self {
        case .aiEngineer: return "AI-first Engineer"
        case .vibeCoder: return "Vibe Coder"
        case .both: return "Both"
        case .neither: return "Neither"
        }
    }
}

/// WHAT the thing is. Mirrors CATEGORIES + CATEGORY_LABELS in categories.ts.
enum Category: String, CaseIterable, Codable, Hashable {
    case agentFramework = "agent-framework"
    case mcpServer = "mcp-server"
    case cliTool = "cli-tool"
    case ideExtension = "ide-extension"
    case library
    case notetaking
    case promptEngineering = "prompt-engineering"
    case rag
    case model
    case dataset
    case paper
    case devtools
    case uiGeneration = "ui-generation"
    case dataPipeline = "data-pipeline"
    case security
    case productivity
    case other

    init(from decoder: Decoder) throws {
        let raw = try decoder.singleValueContainer().decode(String.self)
        self = Category(rawValue: raw) ?? .other
    }

    var label: String {
        switch self {
        case .agentFramework: return "Agent Framework"
        case .mcpServer: return "MCP Server"
        case .cliTool: return "CLI Tool"
        case .ideExtension: return "IDE Extension"
        case .library: return "Library"
        case .notetaking: return "Notetaking"
        case .promptEngineering: return "Prompt Engineering"
        case .rag: return "RAG / Retrieval"
        case .model: return "Model"
        case .dataset: return "Dataset / Benchmark"
        case .paper: return "Paper"
        case .devtools: return "Dev Tools"
        case .uiGeneration: return "UI Generation"
        case .dataPipeline: return "Data Pipeline"
        case .security: return "Security"
        case .productivity: return "Productivity"
        case .other: return "Other"
        }
    }
}

/// List sort options accepted by GET /api/v1/items.
enum ItemSort: String, CaseIterable, Identifiable {
    case hot, new, top
    var id: String { rawValue }
    var label: String {
        switch self {
        case .hot: return "Hot"
        case .new: return "New"
        case .top: return "Top"
        }
    }
}

// MARK: - List shape (lib/public-api.ts `PublicItem`)

/// The clean public projection returned by GET /api/v1/items.
struct PublicItem: Codable, Identifiable, Hashable {
    let slug: String
    let title: String
    let url: String
    let kind: String
    let category: Category
    let integration: String
    let verdict: Verdict
    let overallScore: Int
    let noiseScore: Int
    let tagline: String
    let audience: PrimaryAudience?
    let coverImageUrl: String?
    let createdAt: String // ISO-8601
    // Present on ranked/recap projections only (RankedItem / recap items).
    let upvotes: Int?
    let commentCount: Int?
    let uses: Int?

    var id: String { slug }

    var coverURL: URL? { coverImageUrl.flatMap(URL.init(string:)) }
}

struct ItemsResponse: Codable {
    let items: [PublicItem]
    let count: Int
}

// MARK: - Full Evaluation (packages/core/src/schema.ts)

struct DetailResponse: Codable {
    let evaluation: Evaluation
    let readmeMd: String?
    /// Server-rendered GFM (markdown-it, sanitized). Nil from older servers.
    let readmeHtml: String?

    var hasReadme: Bool {
        !(readmeHtml ?? readmeMd ?? "").isEmpty
    }
}

/// A single scorecard metric: a 0–100 score plus a one-line rationale.
struct MetricScore: Codable, Hashable {
    let score: Int
    let rationale: String
}

/// Who it's for — independent fit scores. Mirrors `AudienceFit`.
struct AudienceFit: Codable, Hashable {
    let primary: PrimaryAudience
    let aiEngineerFit: Int
    let vibeCoderFit: Int
    let rationale: String
}

/// Raw signal captured from the source. Mirrors `ItemSource`.
struct ItemSource: Codable, Hashable {
    let kind: String
    let lens: String?
    let externalId: String
    let url: String
    let title: String
    let author: String?
    let description: String?
    let stars: Int?
    let starsGainedRecently: Int?
    let language: String?
    let license: String?
    let pushedAt: String?
    let publishedAt: String?
    let authors: [String]?
}

/// Decision layer (ticket 0039). Mirrors `Evaluation.quickstart` — optional.
struct Quickstart: Codable, Hashable {
    let install: String
    let requires: [String]?
}

/// Mirrors `Evaluation.decision` — optional. Adopt-or-skip in one look.
struct Decision: Codable, Hashable {
    let adoptIf: [String]
    let skipIf: [String]
    let insteadOf: String?
}

/// The lens-aware write-up. Mirrors `Evaluation.body`: three sections are
/// common to every lens; the rest are lens-specific (see `Lens.sections`).
/// All optional in Swift for decoding resilience on older records.
struct EvaluationBody: Codable, Hashable {
    let whatItIs: String
    let vsVanilla: String?
    let surfaceArea: String?
    let vsAlternatives: String?
    let vsPriorWork: String?
    let reproducibility: String?
    let devilsAdvocate: String?
    let whatWouldMakeItBetter: String?
    let steelman: String?

    subscript(_ key: String) -> String? {
        switch key {
        case "whatItIs": return whatItIs
        case "vsVanilla": return vsVanilla
        case "surfaceArea": return surfaceArea
        case "vsAlternatives": return vsAlternatives
        case "vsPriorWork": return vsPriorWork
        case "reproducibility": return reproducibility
        case "devilsAdvocate": return devilsAdvocate
        case "whatWouldMakeItBetter": return whatWouldMakeItBetter
        case "steelman": return steelman
        default: return nil
        }
    }
}

/// Evaluation lens (packages/core/src/lenses.ts). Decides which body sections
/// exist and how they're titled.
enum Lens: String, Codable, CaseIterable {
    case agentTool = "agent-tool"
    case product
    case research

    /// KIND_LENS mapping: which lens a source kind gets when none is set.
    static func forSource(kind: String, lens: String?) -> Lens {
        if let lens, let explicit = Lens(rawValue: lens) { return explicit }
        switch kind {
        case "arxiv_paper": return .research
        case "producthunt": return .product
        default: return .agentTool
        }
    }

    /// Ordered (key, title) body sections for this lens — mirrors LENS_SECTIONS.
    var sections: [(key: String, title: String)] {
        switch self {
        case .agentTool:
            return [
                ("whatItIs", "What it is"),
                ("vsVanilla", "How it differs from vanilla Claude"),
                ("surfaceArea", "Skill, plugin, or workflow shift?"),
                ("devilsAdvocate", "Devil's advocate — is this just complexity?"),
                ("whatWouldMakeItBetter", "What would make it better"),
                ("steelman", "The honest case for it"),
            ]
        case .product:
            return [
                ("whatItIs", "What it is"),
                ("vsAlternatives", "How it compares to the alternatives"),
                ("devilsAdvocate", "Devil's advocate — do you actually need this?"),
                ("whatWouldMakeItBetter", "What would make it better"),
                ("steelman", "The honest case for it"),
            ]
        case .research:
            return [
                ("whatItIs", "What it is"),
                ("vsPriorWork", "How it advances prior work"),
                ("reproducibility", "Can you actually use it?"),
                ("devilsAdvocate", "Devil's advocate — does this matter?"),
                ("whatWouldMakeItBetter", "What would make it better"),
                ("steelman", "The honest case for it"),
            ]
        }
    }

    var label: String {
        switch self {
        case .agentTool: return "Agent Tool"
        case .product: return "Product"
        case .research: return "Research"
        }
    }
}

struct MediaAsset: Codable, Hashable {
    let type: String
    let url: String
    let cachedUrl: String?
    let alt: String?
    let source: String
}

/// The ten-metric report card. Keys mirror METRIC_KEYS in metrics.ts.
struct Scorecard: Codable, Hashable {
    let novelty: MetricScore
    let utility: MetricScore
    let deltaVsBaseline: MetricScore
    let easeOfAdoption: MetricScore
    let maturity: MetricScore
    let leanness: MetricScore
    let traction: MetricScore
    let composability: MetricScore
    let longevity: MetricScore
    let clarity: MetricScore

    /// Ordered rows for display, using the canonical metric metadata.
    var orderedRows: [(metric: Metric, value: MetricScore)] {
        Metric.all.map { metric in (metric, self[metric.key]) }
    }

    subscript(_ key: String) -> MetricScore {
        switch key {
        case "novelty": return novelty
        case "utility": return utility
        case "deltaVsBaseline": return deltaVsBaseline
        case "easeOfAdoption": return easeOfAdoption
        case "maturity": return maturity
        case "leanness": return leanness
        case "traction": return traction
        case "composability": return composability
        case "longevity": return longevity
        case "clarity": return clarity
        default: return novelty
        }
    }
}

/// THE strict evaluation document. Mirrors `Evaluation`.
struct Evaluation: Codable, Hashable, Identifiable {
    let schemaVersion: Int
    let slug: String
    let source: ItemSource
    let category: Category
    let integration: String
    let tags: [String]
    let verdict: Verdict
    let noiseScore: Int
    let audience: AudienceFit
    let scores: Scorecard
    let overallScore: Int
    let tagline: String
    let body: EvaluationBody
    let quickstart: Quickstart?
    let decision: Decision?
    let media: [MediaAsset]
    let evaluatedBy: String
    let model: String?
    let evaluatedAt: String

    var id: String { slug }

    /// The lens this evaluation was judged under (explicit or derived from kind).
    var lens: Lens { Lens.forSource(kind: source.kind, lens: source.lens) }

    /// Ordered (title, text) body sections present on this evaluation.
    var bodySections: [(key: String, title: String, text: String)] {
        lens.sections.compactMap { section in
            guard let text = body[section.key], !text.isEmpty else { return nil }
            return (section.key, section.title, text)
        }
    }

    /// First usable cover image (prefers a cached/self-hosted copy).
    var coverURL: URL? {
        guard let asset = media.first(where: { $0.type == "image" }) ?? media.first else { return nil }
        let raw = asset.cachedUrl ?? asset.url
        return URL(string: raw)
    }

    var sourceURL: URL? { URL(string: source.url) }
}

// MARK: - Metric metadata (metrics.ts — labels, weights, descriptions, order)

struct Metric: Identifiable, Hashable {
    let key: String
    let label: String
    let weight: Double
    let desc: String
    var id: String { key }

    static let all: [Metric] = [
        Metric(key: "novelty", label: "Novelty", weight: 0.14, desc: "How genuinely new is the capability vs. a repackaging of existing ideas?"),
        Metric(key: "utility", label: "Utility", weight: 0.16, desc: "How useful in real day-to-day work, not in a demo?"),
        Metric(key: "deltaVsBaseline", label: "Δ vs. Baseline", weight: 0.16, desc: "How much better than a capable vanilla agent doing it unaided?"),
        Metric(key: "easeOfAdoption", label: "Ease of Adoption", weight: 0.10, desc: "How cheap to set up and integrate (higher = easier)?"),
        Metric(key: "maturity", label: "Maturity", weight: 0.08, desc: "Stability, docs, tests, release cadence."),
        Metric(key: "leanness", label: "Leanness", weight: 0.10, desc: "How few moving parts it adds (higher = less complexity introduced)."),
        Metric(key: "traction", label: "Traction", weight: 0.07, desc: "Real adoption momentum — stars velocity, usage, citations."),
        Metric(key: "composability", label: "Composability", weight: 0.07, desc: "Plays well alongside your existing tools and workflow."),
        Metric(key: "longevity", label: "Longevity", weight: 0.07, desc: "Will it still matter in 6–12 months, or will the base model absorb it?"),
        Metric(key: "clarity", label: "Clarity", weight: 0.05, desc: "Quality of docs / README / paper — can you actually understand it?"),
    ]
}

/// Coarse band for score coloring. Mirrors `scoreBand` in metrics.ts.
enum ScoreBand {
    case strong, solid, mixed, weak

    init(_ n: Int) {
        if n >= 80 { self = .strong }
        else if n >= 60 { self = .solid }
        else if n >= 40 { self = .mixed }
        else { self = .weak }
    }
}

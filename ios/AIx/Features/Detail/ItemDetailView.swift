import SwiftUI

/// Which pane of the item page is showing (web ContentTabs parity, read-only).
enum DetailTab: String, CaseIterable, Identifiable {
    case evaluation = "Evaluation"
    case scorecard = "Scorecard"
    case readme = "README"
    var id: String { rawValue }
}

struct ItemDetailView: View {
    let slug: String
    @State private var vm: DetailViewModel
    @State private var tab: DetailTab = .evaluation
    @EnvironmentObject private var favorites: FavoritesStore

    init(slug: String) {
        self.slug = slug
        _vm = State(initialValue: DetailViewModel(slug: slug))
    }

    var body: some View {
        Group {
            switch vm.state {
            case .idle, .loading:
                ProgressView("Loading…")
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            case .failed(let message):
                MessageState(
                    systemImage: "exclamationmark.triangle",
                    title: "Couldn't load this item",
                    message: message,
                    retry: { Task { await vm.load() } }
                )
            case .loaded(let detail):
                loaded(detail)
            }
        }
        .navigationTitle(navTitle)
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                if case .loaded(let detail) = vm.state {
                    Button {
                        favorites.toggle(FavoriteItem(evaluation: detail.evaluation))
                    } label: {
                        Image(systemName: favorites.isFavorite(slug: slug) ? "bookmark.fill" : "bookmark")
                    }
                    .accessibilityLabel(favorites.isFavorite(slug: slug) ? "Remove from favorites" : "Save to favorites")
                }
            }
            ToolbarItem(placement: .topBarTrailing) {
                ShareLink(item: AppConfig.baseURL.appending(path: "item/\(slug)")) {
                    Image(systemName: "square.and.arrow.up")
                }
                .accessibilityLabel("Share")
            }
        }
        .task { if case .idle = vm.state { await vm.load() } }
    }

    private var navTitle: String {
        if case .loaded(let d) = vm.state { return d.evaluation.source.title }
        return "Evaluation"
    }

    private func loaded(_ detail: DetailResponse) -> some View {
        let eval = detail.evaluation
        return ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                cover(eval)
                header(eval)

                Picker("Section", selection: $tab) {
                    ForEach(availableTabs(detail)) { t in
                        Text(t.rawValue).tag(t)
                    }
                }
                .pickerStyle(.segmented)

                switch tab {
                case .evaluation:
                    VStack(alignment: .leading, spacing: 20) {
                        if eval.quickstart != nil || eval.decision != nil {
                            makeTheCall(eval)
                            Divider()
                        }
                        bodySections(eval)
                        Divider()
                        audienceFit(eval)
                        sourceLink(eval)
                    }
                case .scorecard:
                    scorecard(eval)
                case .readme:
                    ReadmePane(markdown: detail.readmeMd ?? "")
                }
            }
            .padding()
        }
    }

    private func availableTabs(_ detail: DetailResponse) -> [DetailTab] {
        DetailTab.allCases.filter { tab in
            tab != .readme || !(detail.readmeMd ?? "").isEmpty
        }
    }

    // MARK: Cover

    @ViewBuilder
    private func cover(_ eval: Evaluation) -> some View {
        if let url = eval.coverURL {
            AsyncImage(url: url) { phase in
                switch phase {
                case .success(let image):
                    image.resizable().aspectRatio(contentMode: .fill)
                case .failure:
                    coverPlaceholder(eval)
                case .empty:
                    ZStack { coverPlaceholder(eval); ProgressView() }
                @unknown default:
                    coverPlaceholder(eval)
                }
            }
            .frame(height: 200)
            .frame(maxWidth: .infinity)
            .clipShape(RoundedRectangle(cornerRadius: 12))
        }
    }

    private func coverPlaceholder(_ eval: Evaluation) -> some View {
        Theme.color(for: eval.verdict).opacity(0.18)
            .overlay(
                Image(systemName: "cube.transparent")
                    .font(.system(size: 44))
                    .foregroundStyle(Theme.color(for: eval.verdict))
            )
    }

    // MARK: Header

    private func header(_ eval: Evaluation) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(eval.source.title)
                .font(.title2.weight(.bold))
            HStack(spacing: 10) {
                VerdictBadge(verdict: eval.verdict)
                ScoreChip(score: eval.overallScore, label: "OVERALL")
                ScoreChip(score: eval.noiseScore, label: "NOISE")
            }
            Text(eval.tagline)
                .font(.body)
                .foregroundStyle(.secondary)
            HStack(spacing: 8) {
                Label(eval.category.label, systemImage: "square.grid.2x2")
                Text("·")
                Text(eval.integration)
                Text("·")
                Text(eval.lens.label)
            }
            .font(.caption)
            .foregroundStyle(.secondary)
            if !eval.tags.isEmpty {
                tagCloud(eval.tags)
            }
        }
    }

    private func tagCloud(_ tags: [String]) -> some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 6) {
                ForEach(tags, id: \.self) { tag in
                    Text(tag)
                        .font(.caption2.weight(.medium))
                        .padding(.horizontal, 8)
                        .padding(.vertical, 3)
                        .background(Color.primary.opacity(0.07), in: Capsule())
                }
            }
        }
    }

    // MARK: Decision layer ("Make the call", ticket 0039)

    @ViewBuilder
    private func makeTheCall(_ eval: Evaluation) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Make the call")
                .font(.title3.weight(.bold))

            if let quickstart = eval.quickstart {
                VStack(alignment: .leading, spacing: 6) {
                    HStack {
                        Text(quickstart.install)
                            .font(.system(.footnote, design: .monospaced))
                            .lineLimit(1)
                            .truncationMode(.middle)
                        Spacer()
                        Button {
                            UIPasteboard.general.string = quickstart.install
                        } label: {
                            Image(systemName: "doc.on.doc")
                                .font(.caption)
                        }
                        .accessibilityLabel("Copy install command")
                    }
                    .padding(10)
                    .background(Color.primary.opacity(0.06), in: RoundedRectangle(cornerRadius: 8))
                    if let requires = quickstart.requires, !requires.isEmpty {
                        Text("needs: \(requires.joined(separator: " · "))")
                            .font(.caption2)
                            .foregroundStyle(.secondary)
                    }
                }
            }

            if let decision = eval.decision {
                decisionList("Adopt if", decision.adoptIf, symbol: "plus.circle.fill", tint: .green)
                decisionList("Skip if", decision.skipIf, symbol: "minus.circle.fill", tint: .red)
                if let insteadOf = decision.insteadOf {
                    (Text("Instead of ").foregroundStyle(.secondary) + Text(insteadOf).bold())
                        .font(.footnote)
                }
            }
        }
    }

    private func decisionList(_ title: String, _ lines: [String], symbol: String, tint: Color) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(title.uppercased())
                .font(.caption2.weight(.semibold))
                .foregroundStyle(tint)
            ForEach(lines, id: \.self) { line in
                Label(line, systemImage: symbol)
                    .font(.footnote)
                    .foregroundStyle(.primary)
                    .labelStyle(.titleAndIcon)
                    .imageScale(.small)
                    .tint(tint)
            }
        }
    }

    // MARK: Lens-aware body sections

    private static let sectionIcons: [String: String] = [
        "whatItIs": "doc.text",
        "vsVanilla": "arrow.left.arrow.right",
        "surfaceArea": "puzzlepiece.extension",
        "vsAlternatives": "arrow.left.arrow.right",
        "vsPriorWork": "clock.arrow.circlepath",
        "reproducibility": "hammer",
        "devilsAdvocate": "flame",
        "whatWouldMakeItBetter": "arrow.up.forward",
        "steelman": "shield",
    ]

    private func bodySections(_ eval: Evaluation) -> some View {
        VStack(alignment: .leading, spacing: 18) {
            ForEach(eval.bodySections, id: \.key) { row in
                section(
                    row.title,
                    row.text,
                    icon: Self.sectionIcons[row.key] ?? "doc.text",
                    accent: row.key == "devilsAdvocate" ? .red : row.key == "steelman" ? .green : .accentColor
                )
            }
        }
    }

    private func section(_ title: String, _ text: String, icon: String, accent: Color = .accentColor) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Label(title, systemImage: icon)
                .font(.headline)
                .foregroundStyle(accent)
            Text(text)
                .font(.body)
                .fixedSize(horizontal: false, vertical: true)
        }
    }

    // MARK: Scorecard

    private func scorecard(_ eval: Evaluation) -> some View {
        VStack(alignment: .leading, spacing: 14) {
            Text("Scorecard")
                .font(.title3.weight(.bold))
            ForEach(eval.scores.orderedRows, id: \.metric.id) { row in
                MetricBar(metric: row.metric, value: row.value)
            }
        }
    }

    // MARK: Audience fit

    private func audienceFit(_ eval: Evaluation) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text("Audience Fit").font(.title3.weight(.bold))
                Spacer()
                Text("Primary: \(eval.audience.primary.label)")
                    .font(.caption.weight(.semibold))
                    .padding(.horizontal, 8).padding(.vertical, 4)
                    .background(Theme.color(for: eval.audience.primary).opacity(0.18), in: Capsule())
                    .foregroundStyle(Theme.color(for: eval.audience.primary))
            }
            FitMeter(title: "AI-first Engineer", value: eval.audience.aiEngineerFit,
                     tint: Theme.color(for: .aiEngineer))
            FitMeter(title: "Vibe Coder", value: eval.audience.vibeCoderFit,
                     tint: Theme.color(for: .vibeCoder))
            Text(eval.audience.rationale)
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .fixedSize(horizontal: false, vertical: true)
        }
    }

    // MARK: Source link

    @ViewBuilder
    private func sourceLink(_ eval: Evaluation) -> some View {
        if let url = eval.sourceURL {
            Link(destination: url) {
                Label("View source", systemImage: "arrow.up.right.square")
                    .font(.headline)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 12)
                    .background(Color.accentColor, in: RoundedRectangle(cornerRadius: 12))
                    .foregroundStyle(.white)
            }
            .padding(.top, 4)
        }
    }
}

// MARK: - README

struct ReadmePane: View {
    let markdown: String

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("README").font(.title3.weight(.bold))
            // Basic markdown: AttributedString handles inline styles; block
            // structure is approximated by paragraph splitting.
            ForEach(Array(markdown.components(separatedBy: "\n\n").enumerated()), id: \.offset) { _, block in
                if let attributed = try? AttributedString(
                    markdown: block,
                    options: .init(interpretedSyntax: .inlineOnlyPreservingWhitespace)
                ) {
                    Text(attributed).font(.callout)
                } else {
                    Text(block).font(.callout)
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

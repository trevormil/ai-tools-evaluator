import SwiftUI

/// Color-coded verdict pill.
struct VerdictBadge: View {
    let verdict: Verdict
    var compact: Bool = false

    var body: some View {
        Text(verdict.label.uppercased())
            .font(compact ? .caption2.weight(.bold) : .caption.weight(.bold))
            .tracking(0.5)
            .foregroundStyle(.white)
            .padding(.horizontal, compact ? 6 : 8)
            .padding(.vertical, compact ? 2 : 4)
            .background(Theme.color(for: verdict), in: Capsule())
            .accessibilityLabel("Verdict: \(verdict.label)")
    }
}

/// Overall score chip (0–100) colored by band.
struct ScoreChip: View {
    let score: Int
    var label: String = "SCORE"

    var body: some View {
        HStack(spacing: 4) {
            Text("\(score)")
                .font(.headline.weight(.bold).monospacedDigit())
            Text(label)
                .font(.caption2.weight(.semibold))
                .foregroundStyle(.secondary)
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 4)
        .background(Theme.color(forScore: score).opacity(0.18), in: RoundedRectangle(cornerRadius: 8))
        .foregroundStyle(Theme.color(forScore: score))
        .accessibilityLabel("\(label) \(score) out of 100")
    }
}

/// A labeled horizontal bar for a single metric (0–100), with rationale below.
struct MetricBar: View {
    let metric: Metric
    let value: MetricScore

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack {
                Text(metric.label)
                    .font(.subheadline.weight(.semibold))
                Spacer()
                Text("\(value.score)")
                    .font(.subheadline.weight(.bold).monospacedDigit())
                    .foregroundStyle(Theme.color(forScore: value.score))
            }
            GeometryReader { geo in
                ZStack(alignment: .leading) {
                    Capsule().fill(Color.primary.opacity(0.08))
                    Capsule()
                        .fill(Theme.color(forScore: value.score))
                        .frame(width: max(4, geo.size.width * CGFloat(value.score) / 100))
                }
            }
            .frame(height: 8)
            Text(value.rationale)
                .font(.caption)
                .foregroundStyle(.secondary)
                .fixedSize(horizontal: false, vertical: true)
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(metric.label): \(value.score) out of 100. \(value.rationale)")
    }
}

/// A simple fit meter used for audience-fit rows.
struct FitMeter: View {
    let title: String
    let value: Int
    let tint: Color

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack {
                Text(title).font(.subheadline.weight(.semibold))
                Spacer()
                Text("\(value)")
                    .font(.subheadline.weight(.bold).monospacedDigit())
                    .foregroundStyle(tint)
            }
            GeometryReader { geo in
                ZStack(alignment: .leading) {
                    Capsule().fill(Color.primary.opacity(0.08))
                    Capsule().fill(tint)
                        .frame(width: max(4, geo.size.width * CGFloat(value) / 100))
                }
            }
            .frame(height: 8)
        }
    }
}

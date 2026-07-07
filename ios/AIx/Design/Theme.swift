import SwiftUI

/// Central color/design decisions. All colors are chosen to read in both
/// light and dark mode (SwiftUI system colors adapt automatically; the custom
/// verdict/score hues are mid-saturation so they stay legible on either).
enum Theme {

    /// Color-coded verdict — greener = more worth adopting, redder = noise.
    static func color(for verdict: Verdict) -> Color {
        switch verdict {
        case .essential: return Color(red: 0.13, green: 0.66, blue: 0.35)   // green
        case .worthwhile: return Color(red: 0.30, green: 0.62, blue: 0.30)  // muted green
        case .niche: return Color(red: 0.25, green: 0.55, blue: 0.78)       // blue
        case .marginal: return Color(red: 0.86, green: 0.62, blue: 0.15)    // amber
        case .redundant: return Color(red: 0.82, green: 0.45, blue: 0.16)   // orange
        case .complexityTrap: return Color(red: 0.80, green: 0.26, blue: 0.26) // red
        }
    }

    /// Score → band color. Higher is always better (see metrics.ts convention).
    static func color(forScore n: Int) -> Color {
        switch ScoreBand(n) {
        case .strong: return Color(red: 0.13, green: 0.66, blue: 0.35)
        case .solid: return Color(red: 0.45, green: 0.62, blue: 0.20)
        case .mixed: return Color(red: 0.86, green: 0.62, blue: 0.15)
        case .weak: return Color(red: 0.80, green: 0.30, blue: 0.30)
        }
    }

    /// Audience accent.
    static func color(for audience: PrimaryAudience) -> Color {
        switch audience {
        case .aiEngineer: return Color(red: 0.30, green: 0.50, blue: 0.85)
        case .vibeCoder: return Color(red: 0.66, green: 0.35, blue: 0.75)
        case .both: return Color(red: 0.25, green: 0.60, blue: 0.55)
        case .neither: return .secondary
        }
    }

    static let cardBackground = Color(.secondarySystemBackground)
}

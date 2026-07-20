import SwiftUI

/// The nightly recap, pushed from the feed's recap strip: prev/next
/// navigation + a date archive. Lives inside the feed's NavigationStack, so
/// item links resolve through the stack's existing String destination.
struct RecapScreen: View {
    @State private var vm = RecapViewModel()
    @State private var showArchive = false

    var body: some View {
        Group {
            switch vm.state {
            case .idle, .loading:
                ProgressView("Loading…")
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            case .failed(let message):
                MessageState(
                    systemImage: "moon.stars",
                    title: "No recap",
                    message: message,
                    retry: { Task { await vm.loadLatest() } }
                )
            case .loaded(let recap):
                RecapContent(recap: recap, vm: vm)
            }
        }
        .navigationTitle("Nightly Recap")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button {
                    showArchive = true
                } label: {
                    Image(systemName: "calendar")
                }
                .accessibilityLabel("Archive")
                .disabled(vm.dates.isEmpty)
            }
        }
        .sheet(isPresented: $showArchive) {
            RecapArchiveSheet(dates: vm.dates) { date in
                showArchive = false
                Task { await vm.load(date: date) }
            }
        }
        .task { if case .idle = vm.state { await vm.loadLatest() } }
    }
}

private struct RecapContent: View {
    let recap: Recap
    @Bindable var vm: RecapViewModel

    var body: some View {
        List {
            Section {
                VStack(alignment: .leading, spacing: 6) {
                    HStack {
                        dateArrow(offset: 1, symbol: "chevron.left") // older (newest-first list)
                        Spacer()
                        Text(dateLabel(recap.date)).font(.headline)
                        Spacer()
                        dateArrow(offset: -1, symbol: "chevron.right") // newer
                    }
                    Text("\(recap.total) judged · \(recap.summary)")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                        .frame(maxWidth: .infinity, alignment: .center)
                }
                .listRowSeparator(.hidden)
            }

            if let lead = recap.leadPick {
                Section("Lead pick") {
                    itemLink(lead)
                }
            }
            if let trap = recap.complexityTrap {
                Section("The callout") {
                    itemLink(trap)
                }
            }
            if !recap.topAdopted.isEmpty {
                Section("Actually being run") {
                    ForEach(recap.topAdopted) { item in
                        itemLink(item, subtitle: "\(item.uses ?? 0) engineers run this")
                    }
                }
            }
            Section("Everything judged") {
                ForEach(recap.items) { item in
                    itemLink(item)
                }
            }
        }
        .listStyle(.insetGrouped)
        .refreshable { await vm.loadLatest() }
    }

    private func itemLink(_ item: PublicItem, subtitle: String? = nil) -> some View {
        NavigationLink(value: item.slug) {
            VStack(alignment: .leading, spacing: 2) {
                ItemRow(item: item)
                if let subtitle {
                    Text(subtitle).font(.caption).foregroundStyle(.secondary)
                }
            }
        }
    }

    @ViewBuilder
    private func dateArrow(offset: Int, symbol: String) -> some View {
        let target = vm.neighborDate(of: recap.date, offset: offset)
        Button {
            if let target { Task { await vm.load(date: target) } }
        } label: {
            Image(systemName: symbol)
        }
        .disabled(target == nil)
    }

    private func dateLabel(_ date: String) -> String {
        let parser = DateFormatter()
        parser.dateFormat = "yyyy-MM-dd"
        parser.timeZone = TimeZone(identifier: "UTC")
        guard let parsed = parser.date(from: date) else { return date }
        return parsed.formatted(date: .abbreviated, time: .omitted)
    }
}

private struct RecapArchiveSheet: View {
    let dates: [String]
    let onSelect: (String) -> Void

    var body: some View {
        NavigationStack {
            List(dates, id: \.self) { date in
                Button(date) { onSelect(date) }
            }
            .navigationTitle("Archive")
            .navigationBarTitleDisplayMode(.inline)
        }
        .presentationDetents([.medium, .large])
    }
}

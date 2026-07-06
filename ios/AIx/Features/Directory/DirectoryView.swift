import SwiftUI

struct DirectoryView: View {
    @State private var vm = DirectoryViewModel()
    @State private var showFilters = false

    var body: some View {
        NavigationStack {
            content
                .navigationTitle("Directory")
                .searchable(text: $vm.search, prompt: "Search tools & papers")
                .onSubmit(of: .search) { vm.load() }
                .onChange(of: vm.search) { _, newValue in
                    if newValue.isEmpty { vm.load() }
                }
                .toolbar {
                    ToolbarItem(placement: .topBarLeading) {
                        Picker("Sort", selection: $vm.sort) {
                            ForEach(ItemSort.allCases) { s in Text(s.label).tag(s) }
                        }
                        .pickerStyle(.menu)
                        .onChange(of: vm.sort) { _, _ in vm.load() }
                    }
                    ToolbarItem(placement: .topBarTrailing) {
                        Button {
                            showFilters = true
                        } label: {
                            Image(systemName: vm.hasActiveFilters
                                  ? "line.3.horizontal.decrease.circle.fill"
                                  : "line.3.horizontal.decrease.circle")
                        }
                    }
                }
                .sheet(isPresented: $showFilters) {
                    FilterSheet(vm: vm)
                        .presentationDetents([.medium, .large])
                }
        }
        .task {
            if case .idle = vm.state { vm.load() }
        }
    }

    @ViewBuilder
    private var content: some View {
        switch vm.state {
        case .idle, .loading:
            ProgressView("Loading…")
                .frame(maxWidth: .infinity, maxHeight: .infinity)
        case .failed(let message):
            MessageState(
                systemImage: "wifi.exclamationmark",
                title: "Couldn't load the directory",
                message: message,
                retry: { vm.load() }
            )
        case .loaded(let items):
            if items.isEmpty {
                MessageState(
                    systemImage: "magnifyingglass",
                    title: "No matches",
                    message: "Try clearing filters or a different search."
                )
            } else {
                List {
                    ForEach(items) { item in
                        NavigationLink(value: item.slug) {
                            ItemRow(item: item)
                        }
                    }
                }
                .listStyle(.plain)
                .refreshable { await vm.refresh() }
                .navigationDestination(for: String.self) { slug in
                    ItemDetailView(slug: slug)
                }
            }
        }
    }
}

/// Bottom-sheet filter controls.
private struct FilterSheet: View {
    @Bindable var vm: DirectoryViewModel
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            Form {
                Section("Category") {
                    Picker("Category", selection: $vm.category) {
                        Text("All").tag(Category?.none)
                        ForEach(Category.allCases, id: \.self) { c in
                            Text(c.label).tag(Category?.some(c))
                        }
                    }
                }
                Section("Verdict") {
                    Picker("Verdict", selection: $vm.verdict) {
                        Text("All").tag(Verdict?.none)
                        ForEach(Verdict.allCases, id: \.self) { v in
                            Text(v.label).tag(Verdict?.some(v))
                        }
                    }
                }
                Section("Audience") {
                    Picker("Audience", selection: $vm.audience) {
                        Text("All").tag(PrimaryAudience?.none)
                        ForEach(PrimaryAudience.allCases, id: \.self) { a in
                            Text(a.label).tag(PrimaryAudience?.some(a))
                        }
                    }
                }
                if vm.hasActiveFilters {
                    Section {
                        Button("Clear filters", role: .destructive) {
                            vm.clearFilters()
                            dismiss()
                        }
                    }
                }
            }
            .navigationTitle("Filters")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Apply") {
                        vm.load()
                        dismiss()
                    }
                }
            }
        }
    }
}

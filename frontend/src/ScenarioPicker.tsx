import { useState } from "react"
import type { Scenario } from "../../shared/pitch"
import { Button, Icon, type IconName } from "./design"

const categories: { id: string; name: string; icon: IconName }[] = [
  { id: "all", name: "Explore all", icon: "grid" },
  { id: "career", name: "Career & interviews", icon: "target" },
  { id: "conflict", name: "Difficult conversations", icon: "versus" },
  { id: "money", name: "Money & negotiation", icon: "star" },
  { id: "leadership", name: "Leadership", icon: "trophy" },
  { id: "social", name: "Friends & relationships", icon: "user" },
]

const categoryKey = "pitch.practice-category.v1"
export function practiceCategory() {
  try { const value = sessionStorage.getItem(categoryKey); return categories.some(item => item.id === value) ? value! : "all" } catch { return "all" }
}
export function rememberPracticeCategory(value: string) {
  try { sessionStorage.setItem(categoryKey, value) } catch { /* Navigation still works without storage. */ }
}

export function ScenarioPicker({ scenarios, selected, category, onCategory, onSelect }: {
  scenarios: Scenario[]; selected: string; category: string;
  onCategory: (category: string) => void; onSelect: (scenario: Scenario) => void;
}) {
  const [search, setSearch] = useState("")
  const [limit, setLimit] = useState(6)
  const filtered = scenarios.filter((s) => (category === "all" || category === s.category) && `${s.title} ${s.prompt}`.toLowerCase().includes(search.trim().toLowerCase()))
  return <section className="scenario-library" aria-label="Choose a practice scenario">
    <div><h2 className="heading">What do you want to practice?</h2><p>{scenarios.length} scenarios</p></div>
    <div className="category-chips" role="group" aria-label="Scenario categories">
      {categories.map((item) => <button key={item.id} className={`category-chip ${category === item.id ? "selected" : ""}`} aria-pressed={category === item.id} onClick={() => { onCategory(item.id); setLimit(6); setSearch("") }}><Icon name={item.icon} size={17} />{item.name}<span>{scenarios.filter((s) => item.id === "all" || s.category === item.id).length}</span></button>)}
    </div>
    <label className="scenario-search">Find a scenario<input type="search" value={search} onChange={(event) => { setSearch(event.target.value); setLimit(6) }} placeholder="Try interview, friend, budget…" /></label>
    <div className="scenario-card-grid">
      {filtered.slice(0, limit).map((scenario) => <button key={scenario.id} className={`scenario-card ${selected === scenario.id ? "selected" : ""}`} aria-pressed={selected === scenario.id} onClick={() => onSelect(scenario)}><span className="scenario-card-meta"><span className="capitalize">{scenario.category}</span><span>{selected === scenario.id ? "Selected ✓" : "60 seconds"}</span></span><strong>{scenario.title}</strong><span className="scenario-card-prompt">{scenario.prompt}</span></button>)}
    </div>
    {!filtered.length && <p role="status">No matching scenarios. Try another search or category.</p>}
    {filtered.length > limit && <Button variant="ghost" onClick={() => setLimit((value) => value + 6)}>Show more scenarios ({filtered.length - limit} more)</Button>}
  </section>
}

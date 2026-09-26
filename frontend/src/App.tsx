import { useEffect, useState } from "react"
import {
  Button,
  Home,
  Icon,
  Logo,
  Sidebar,
  cosmeticItems,
  type EquippedItems,
  type Page,
} from "./design"
import {
  Auth,
  Character,
  Coach,
  Dashboard,
  Leaderboard,
  Practice,
  Profile,
} from "./screens"
import { Match } from "./Match"
import { Pricing } from "./Pricing"
import { initials } from "./model"
import { usePitch } from "./usePitch"
import "./integration.css"

const pages: Page[] = [
  "Home",
  "Dashboard",
  "Practice",
  "Head-to-Head",
  "AI Coach",
  "Leaderboard",
  "Profile",
  "Character",
  "Avatar Shop",
  "Plans",
]
const defaultLook: EquippedItems = {
  outfit: "Varsity Pitch",
  accessory: "Round Glasses",
  background: "Midnight Arena",
}
function currentPage(): Page {
  try {
    const hash = decodeURIComponent(location.hash.slice(1))
    return pages.includes(hash as Page) ? hash as Page : "Home"
  } catch {
    return "Home"
  }
}
function storedLook(): EquippedItems {
  try {
    const look = JSON.parse(
      localStorage.getItem("pitch.character.v1") || "null",
    )
    if (
      look &&
      Object.values(look).every((name) =>
        cosmeticItems.some((i) => i.name === name),
      ) &&
      ["outfit", "accessory", "background"].every(
        (k) => typeof look[k] === "string",
      )
    )
      return look
  } catch {
    /* Device-local appearance is optional. */
  }
  return defaultLook
}
export default function App() {
  const p = usePitch()
  const [page, setPage] = useState<Page>(currentPage)
  const [menuOpen, setMenuOpen] = useState(false)
  const [auth, setAuth] = useState(false)
  const [equipped, updateLook] = useState<EquippedItems>(storedLook)
  const profile = {
    name: p.me?.player.name || "Welcome to PITCH",
    avatar: initials(p.me?.player.name || "PITCH"),
    schoolMajor: "",
    locationBio: "",
  }
  function navigate(next: Page) {
    setPage(next)
    location.hash = encodeURIComponent(next)
    setMenuOpen(false)
    if (next !== "Home" && next !== "Plans" && !p.session) setAuth(true)
    else setAuth(false)
  }
  function setEquipped(look: EquippedItems) {
    updateLook(look)
    try {
      localStorage.setItem("pitch.character.v1", JSON.stringify(look))
    } catch {
      /* Preview still works for this visit. */
    }
  }
  useEffect(() => {
    const change = () => setPage(currentPage())
    window.addEventListener("hashchange", change)
    return () => window.removeEventListener("hashchange", change)
  }, [])
  useEffect(() => {
    if (p.me && p.config) {
      setAuth(false)
      if (currentPage() === "Home") {
        setPage("Dashboard")
        location.hash = "Dashboard"
      }
    }
  }, [p.me?.player.id, p.config])
  useEffect(() => {
    if (p.room?.code) {
      setPage("Head-to-Head")
      location.hash = "Head-to-Head"
    }
  }, [p.room?.code])
  const active = p.room?.status === "active" && !p.room.left
  let content
  if (p.booting)
    content = (
      <div className="panel" role="status">
        Restoring your session…
      </div>
    )
  else if (page === "Plans" && !auth)
    content = <Pricing navigate={navigate} />
  else if (!p.session)
    content =
      auth || page !== "Home" ? <Auth p={p} /> : <Home onNavigate={navigate} />
  else if (!p.me || !p.config)
    content = (
      <div className="panel">
        <p>Loading your account and game rules…</p>
        <Button disabled={p.busy} onClick={() => location.reload()}>
          Retry
        </Button>
      </div>
    )
  else {
    switch (page) {
      case "Home":
        content = <Home onNavigate={navigate} />
        break
      case "Dashboard":
        content = <Dashboard p={p} navigate={navigate} equipped={equipped} />
        break
      case "Practice":
        content = <Practice p={p} />
        break
      case "Head-to-Head":
        content = <Match p={p} />
        break
      case "AI Coach":
        content = <Coach navigate={navigate} />
        break
      case "Leaderboard":
        content = <Leaderboard p={p} />
        break
      case "Profile":
        content = <Profile p={p} navigate={navigate} equipped={equipped} />
        break
      case "Character":
      case "Avatar Shop":
        content = (
          <Character
            equipped={equipped}
            setEquipped={setEquipped}
            shop={page === "Avatar Shop"}
          />
        )
        break
    }
  }
  return (
    <div className="app-shell">
      <Sidebar
        page={page}
        onNavigate={navigate}
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        profile={profile}
      />
      {menuOpen && (
        <button
          className="backdrop"
          aria-label="Close navigation"
          onClick={() => setMenuOpen(false)}
        />
      )}
      <main className="main" id="main-content">
        <header className="topbar">
          <button
            className="icon-button mobile-only"
            onClick={() => setMenuOpen(true)}
            aria-label="Open menu"
          >
            <Icon name="menu" />
          </button>
          <div className="mobile-only">
            <Logo />
          </div>
          <div className="topbar-right">
            <Button variant="ghost" onClick={() => navigate("Plans")}>View plans</Button>
            {p.me && (
              <>
                <button
                  className="topbar-coins"
                  onClick={() => navigate("Profile")}
                >
                  <Icon name="trophy" size={16} />
                  <strong>{p.me.rating.value}</strong>
                  <span>ELO</span>
                </button>
                <button
                  className="avatar avatar-small"
                  aria-label="Open profile"
                  onClick={() => navigate("Profile")}
                >
                  {profile.avatar}
                </button>
              </>
            )}
            {p.session ? (
              <Button
                variant="ghost"
                disabled={p.busy || active}
                title={
                  active
                    ? "Leave or finish your round before signing out."
                    : undefined
                }
                onClick={() => {
                  void p.logout()
                }}
              >
                Sign out
              </Button>
            ) : (
              <Button variant="secondary" onClick={() => setAuth(true)}>
                Sign in
              </Button>
            )}
          </div>
        </header>
        <div className="page-content">
          {(active || p.queue.status === "waiting") &&
            page !== "Head-to-Head" && (
              <div className="session-banner">
                <span>
                  {active
                    ? "Your round is still running."
                    : "You are waiting for a round."}
                </span>
                <Button onClick={() => navigate("Head-to-Head")}>
                  Return to round
                  <Icon name="arrow" />
                </Button>
              </div>
            )}
          {p.error && (
            <div className="alert error" role="alert">
              <span>{p.error}</span>
              <button aria-label="Dismiss error" onClick={() => p.setError("")}>
                <Icon name="close" />
              </button>
            </div>
          )}
          {p.notice && (
            <div className="alert" role="status">
              <span>{p.notice}</span>
              <button
                aria-label="Dismiss message"
                onClick={() => p.setNotice("")}
              >
                <Icon name="close" />
              </button>
            </div>
          )}
          {content}
        </div>
      </main>
    </div>
  )
}

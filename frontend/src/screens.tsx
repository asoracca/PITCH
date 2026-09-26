import { useEffect, useState, type FormEvent } from "react"
import {
  Button,
  SectionTitle,
  Stat,
  Icon,
  AvatarCharacter,
  cosmeticItems,
  type Page,
  type EquippedItems,
} from "./design"
import { countdown, initials, signed, skills } from "./model"
import type { Pitch } from "./usePitch"
import type { FeedbackRating, Scenario, Reports } from "../../shared/pitch"

export function Auth({ p }: { p: Pitch }) {
  const [signup, setSignup] = useState(false)
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const d = new FormData(e.currentTarget)
    const base = {
      email: String(d.get("email")),
      password: String(d.get("password")),
    }
    void p.authenticate(
      signup
        ? {
            ...base,
            name: String(d.get("name")),
            birthDate: String(d.get("birthDate")),
            acceptedConduct: true,
          }
        : base,
    )
  }
  return (
    <section className="panel auth-panel">
      <div className="eyebrow">YOUR NEXT CHAPTER STARTS HERE</div>
      <h1 className="display">{signup ? "Join PITCH." : "Welcome back."}</h1>
      <p>Practice with peers, get useful feedback and track your growth.</p>
      <form onSubmit={submit} className="form-stack">
        {signup && (
          <label>
            Display name
            <input
              name="name"
              required
              maxLength={24}
              autoComplete="nickname"
            />
          </label>
        )}
        <label>
          Email
          <input
            name="email"
            type="email"
            required
            maxLength={254}
            autoComplete="email"
          />
        </label>
        <label>
          Password
          <input
            name="password"
            type="password"
            required
            minLength={signup ? 12 : 1}
            maxLength={128}
            autoComplete={signup ? "new-password" : "current-password"}
          />
        </label>
        {signup && (
          <>
            <label>
              Birth date
              <input
                name="birthDate"
                type="date"
                required
                max={new Date().toISOString().slice(0, 10)}
              />
            </label>
            <p className="muted">
              We match ages 14–17, 18–22 and 23+ separately. Your birth date and
              email stay private.
            </p>
            <label className="check-label">
              <input type="checkbox" required />I agree to the conduct and
              privacy information below.
            </label>
            <Rules compact />
          </>
        )}
        <Button type="submit" disabled={p.busy || !p.config}>
          {p.busy ? "Please wait…" : signup ? "Create account" : "Sign in"}
          <Icon name="arrow" />
        </Button>
      </form>
      <Button variant="ghost" onClick={() => setSignup(!signup)}>
        {signup
          ? "Already have an account? Sign in"
          : "New here? Create an account"}
      </Button>
      <p className="muted">
        Email verification and password recovery are not available in this
        prototype. Use a unique password of at least 12 characters.
      </p>
    </section>
  )
}

export function Rules({ compact = false }: { compact?: boolean }) {
  return (
    <details className="panel rules-panel" open={!compact}>
      <summary>How PITCH works · Conduct & privacy</summary>
      <div className="form-stack">
        <p>
          Quick play matches two contestants and three peer judges in the same
          age band. Topics and positions are assigned by the server. Read for 20
          seconds; each contestant gets a 60-second opening and a 20-second
          response. Judges then have 60 seconds to vote and give feedback.
        </p>
        <p>
          Judges score clarity, persuasiveness and composure from 1–5 and give
          each contestant a constructive tip. A majority wins; two tied ballots
          use total rubric scores, then a draw. Fewer than two ballots cancels
          the rating update.
        </p>
        <p>
          Elo starts at 1000. Your first 10 rated rounds use K=32, then K=16.
          Every two completed judged rounds earns one contestant priority
          credit. Priority cannot create missing players. Queues expire after
          two minutes.
        </p>
        <p>
          Leaving an active round or disconnecting for 60 seconds triggers a
          five-minute queue break, or ten minutes after a repeat within 24
          hours. Contestants forfeit; the winner receives a reduced Elo gain.
          Judges lose 10 reliability points.
        </p>
        <p>
          Respect people, critique the response, and avoid contact details,
          harassment and coordinated voting. Report or block inappropriate
          behavior. Feedback has a basic text filter; reports need a configured
          human moderator. This prototype has no staffed live moderation.
        </p>
        <p>
          We store your display name, email, birth date, password hash, game
          results, submitted text, peer feedback, blocks and reports. Other
          players see your display name and age band. Audio travels between
          browsers and is not recorded; peer connections can reveal network
          addresses. Some networks need the text fallback.
        </p>
        <p>
          Your session token stays in this tab until sign-out or expiry. Solo
          practice drafts stay on the current screen and are not submitted or
          scored. Character previews save only on this device. Contact the
          person who invited you to request deletion of prototype records.
          Scores are peer opinions, not predictions of career outcomes. Use this
          prototype for a supervised team playtest.
        </p>
      </div>
    </details>
  )
}

export function Dashboard({
  p,
  navigate,
  equipped,
}: {
  p: Pitch
  navigate: (page: Page) => void
  equipped: EquippedItems
}) {
  const me = p.me!
  const rounds = p.history?.history || []
  const ownRank =
    p.leaders?.players.findIndex((v) => v.playerId === me.player.id) ?? -1
  const scenarios =
    p.config?.scenarios.filter((s) => s.band === me.ageBand) || []
  const daily =
    scenarios[Math.floor(Date.now() / 86400000) % (scenarios.length || 1)]
  const tips = rounds
    .flatMap((r) => r.feedback)
    .filter((f) => f.rating !== "abusive")
  return (
    <>
      <section className="welcome">
        <div>
          <div className="eyebrow">
            {new Date().toLocaleDateString(undefined, {
              weekday: "long",
              month: "long",
              day: "numeric",
            })}
          </div>
          <h1 className="display">Ready to step up, {me.player.name}?</h1>
          <p className="subcopy">
            Your next opportunity won’t wait. Let’s sharpen your edge.
          </p>
        </div>
        <div className="stats">
          <Stat
            icon="bolt"
            value={String(me.rating.value)}
            label="PITCH Elo"
            tone="lime"
          />
          <Stat
            icon="gavel"
            value={String(me.judge.roundsCompleted)}
            label="Rounds judged"
            tone="orange"
          />
          <Stat
            icon="trophy"
            value={ownRank >= 0 ? `#${ownRank + 1}` : "—"}
            label="Weekly rank · top 30"
            tone="purple"
          />
        </div>
      </section>
      <section className="daily-card">
        <div className="daily-glow" />
        <div className="daily-content">
          <div className="daily-top">
            <span className="live-pill">TODAY’S PRACTICE</span>
            <span className="time-left">
              <Icon name="clock" size={17} />
              60-second warm-up
            </span>
          </div>
          <div className="daily-body">
            <div className="daily-copy">
              <div className="challenge-label">YOUR DAILY PROMPT</div>
              <h2 className="daily-title">
                {daily?.title || "Warm up for your next round"}
              </h2>
              <p>{daily?.prompt}</p>
              <div className="skill-tags">
                <span>{daily?.category}</span>
                <span>SOLO · UNRATED</span>
              </div>
            </div>
            <div className="pitch-action">
              <div className="timer-ring">
                <div className="timer-inner">
                  <span>60</span>
                  <small>SEC</small>
                </div>
              </div>
              <Button onClick={() => navigate("Practice")}>
                Start Today’s PITCH
                <Icon name="arrow" />
              </Button>
              <span className="reward">
                Then put it into practice with peers.
              </span>
            </div>
          </div>
        </div>
      </section>
      <section className="avatar-reward-card">
        <div className="avatar-card-character">
          <AvatarCharacter compact {...equipped} />
        </div>
        <div className="avatar-reward-copy">
          <div className="eyebrow">YOUR PITCH CHARACTER</div>
          <h2 className="heading">Make it yours.</h2>
          <p>
            Try your team’s character designs. Your look never changes your
            score.
          </p>
        </div>
        <Button variant="secondary" onClick={() => navigate("Character")}>
          Customize
          <Icon name="arrow" />
        </Button>
      </section>
      <section className="content-section">
        <SectionTitle
          eyebrow="CHOOSE YOUR ARENA"
          title="Practice by category"
          action={
            <Button variant="ghost" onClick={() => navigate("Practice")}>
              View all
              <Icon name="arrow" />
            </Button>
          }
        />
        <div className="category-grid">
          {[...new Set(scenarios.map((s) => s.category))].map((category, i) => (
            <button
              className="category-card"
              key={category}
              onClick={() => navigate("Practice")}
            >
              <div
                className={`category-icon ${["purple", "cyan", "green", "orange", "pink"][i % 5]}`}
              >
                <Icon name="target" />
              </div>
              <div className="category-title capitalize">{category}</div>
              <p>Practice a real-world conversation.</p>
              <div className="category-meta">
                <span>
                  {scenarios.filter((s) => s.category === category).length}{" "}
                  scenarios
                </span>
                <Icon name="arrow" />
              </div>
            </button>
          ))}
        </div>
      </section>
      <section className="lower-grid">
        <div className="panel">
          <SectionTitle
            eyebrow="YOUR PROGRESS"
            title="Ready for a live round?"
          />
          <p>
            Two contestants. Three judges. One scenario. Your opening and
            response are scored by peers.
          </p>
          <Button onClick={() => navigate("Head-to-Head")}>
            Quick play
            <Icon name="versus" />
          </Button>
          <p>
            {me.priorityCredits} priority credits · {me.judge.progressToCredit}
            /2 judged rounds toward your next credit.
          </p>
        </div>
        <div className="panel">
          <SectionTitle eyebrow="RECENT FEEDBACK" title="Your peers say" />
          {tips[0] ? (
            <>
              <p className="feedback-quote">“{tips[0].tip}”</p>
              <div className="score-row">
                {skills.map((k) => (
                  <span key={k} className="capitalize">
                    {k} {tips[0][k]}/5
                  </span>
                ))}
              </div>
            </>
          ) : (
            <p>Complete a contestant round to receive your first scorecard.</p>
          )}
        </div>
      </section>
    </>
  )
}

export function Practice({ p }: { p: Pitch }) {
  const scenarios = p.config!.scenarios.filter((s) => s.band === p.me!.ageBand)
  const [category, setCategory] = useState("all")
  const [selected, setSelected] = useState(
    () =>
      scenarios[Math.floor(Date.now() / 86400000) % scenarios.length]?.id || "",
  )
  const [deadline, setDeadline] = useState(0)
  const [now, setNow] = useState(Date.now())
  const [done, setDone] = useState(false)
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [notice, setNotice] = useState("")
  const scenario = scenarios.find((s) => s.id === selected) || scenarios[0]
  const response = drafts[scenario?.id] || ""
  const eligible = scenarios.filter((s) => category === "all" || s.category === category)
  const alternatives = eligible.filter((s) => s.id !== scenario?.id)
  useEffect(() => {
    if (!deadline || done) return
    const id = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(id)
  }, [deadline, done])
  const finished = done || (deadline > 0 && now >= deadline)
  function choose(s: Scenario) {
    setSelected(s.id)
    setDeadline(0)
    setDone(false)
    setNotice("")
  }
  if (!scenario) return <p>No scenarios are available for this age band.</p>
  return (
    <div className="page-stack">
      <SectionTitle
        eyebrow="SOLO TRAINING · UNRATED"
        title="Practice Arena"
        action={<Button variant="secondary" disabled={!alternatives.length} onClick={() => {
          const next = alternatives[Math.floor(Math.random() * alternatives.length)]
          if (!next) return
          choose(next)
          setNotice(`New scenario: ${next.title}. The timer is reset; your previous draft is kept for this visit.`)
        }}>Random scenario <Icon name="spark" /></Button>}
      />
      <div className="scenario-controls">
        <label>
          Category
          <select
            value={category}
            onChange={(e) => {
              const next = e.target.value
              setCategory(next)
              const matching = scenarios.find((s) => next === "all" || s.category === next)
              if (matching && next !== "all" && scenario.category !== next) choose(matching)
              else setNotice("")
            }}
          >
            <option value="all">All categories</option>
            {[...new Set(scenarios.map((s) => s.category))].map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        <label>
          Scenario
          <select
            value={scenario.id}
            onChange={(e) =>
              choose(scenarios.find((s) => s.id === e.target.value)!)
            }
          >
            {eligible
              .map((s) => (
                <option value={s.id} key={s.id}>
                  {s.title}
                </option>
              ))}
          </select>
        </label>
      </div>
      <p className="practice-random-hint">Random picks stay in your age group and selected category. Switching scenarios resets the timer and keeps your drafts for this visit.</p>
      {notice && <p role="status">{notice}</p>}
      {!alternatives.length && <p>Choose another category for more random scenarios.</p>}
      <div className="arena">
        <div className="arena-top">
          <span className="live-pill capitalize">{scenario.category}</span>
          <span className="countdown">
            <Icon name="clock" />
            {deadline ? countdown(deadline, now) : "1:00"}
          </span>
        </div>
        <h2 className="heading">{scenario.title}</h2>
        <div className="arena-prompt">{scenario.prompt}</div>
        <p className="arena-hint">{scenario.goal}</p>
        {scenario.positions && (
          <div className="skill-tags">
            {scenario.positions.map((v) => (
              <span key={v}>{v}</span>
            ))}
          </div>
        )}
        <label className="form-stack">
          Your practice response
          <textarea
            className="match-response-input"
            value={response}
            maxLength={1200}
            readOnly={finished}
            onChange={(e) => setDrafts((current) => ({ ...current, [scenario.id]: e.target.value }))}
            placeholder="Draft your response here, or practice speaking aloud."
          />
        </label>
        <div className="response-submit">
          <span>{response.length}/1200 · This draft is not uploaded.</span>
          {!deadline ? (
            <Button
              onClick={() => {
                setNow(Date.now())
                setDeadline(Date.now() + 60000)
              }}
            >
              Start 60-second practice
              <Icon name="play" />
            </Button>
          ) : finished ? (
            <Button
              onClick={() => {
                setDone(false)
                setDeadline(0)
              }}
            >
              Try again
              <Icon name="arrow" />
            </Button>
          ) : (
            <Button onClick={() => setDone(true)}>
              Finish practice
              <Icon name="check" />
            </Button>
          )}
        </div>
      </div>
      {finished && (
        <div className="panel">
          <SectionTitle title="Reflect before your next round" />
          <p>
            Did you state your point clearly, give a concrete reason and stay
            composed? Choose one thing to improve.
          </p>
          <p>
            Solo practice is not scored and does not award Elo, XP or coins.
            Play a live round for peer feedback.
          </p>
        </div>
      )}
    </div>
  )
}

export function Leaderboard({ p }: { p: Pitch }) {
  const leaders = p.leaders
  if (!leaders) return <p>Loading leaderboard…</p>
  return (
    <div className="page-stack">
      <SectionTitle
        eyebrow={`WEEKLY LEAGUE · AGES ${leaders.band}`}
        title="Leaderboard"
        action={
          <Button
            variant="ghost"
            disabled={p.busy}
            onClick={() => {
              void p.act(p.refresh)
            }}
          >
            Refresh
          </Button>
        }
      />
      <p>
        Ranked by Elo gained since{" "}
        {new Date(leaders.weekStartsAt).toLocaleDateString()}. Resets each
        Monday at 00:00 UTC.
      </p>
      {leaders.players.length > 0 ? (
        <>
          <div className="podium">
            {leaders.players.slice(0, 3).map((v, i) => (
              <div
                className={`podium-player ${["first", "second", "third"][i]}`}
                key={v.playerId}
              >
                <div className="avatar avatar-xl">{initials(v.name)}</div>
                <strong>{v.name}</strong>
                <span>{signed(v.weeklyGain)} Elo this week</span>
                <div>{i + 1}</div>
              </div>
            ))}
          </div>
          <div className="leader-list">
            {leaders.players.map((v, i) => (
              <div
                className={`leader-row ${
                  v.playerId === p.me!.player.id ? "you" : ""
                }`}
                key={v.playerId}
              >
                <strong>#{i + 1}</strong>
                <div className="avatar avatar-small">{initials(v.name)}</div>
                <span className="grow">
                  {v.name}
                  {v.playerId === p.me!.player.id && <small>YOU</small>}
                </span>
                <span>{v.rating} Elo</span>
                <b>{signed(v.weeklyGain)}</b>
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="panel">
          <h2 className="heading">A fresh week starts here.</h2>
          <p>
            No rated rounds in your age band yet. Complete a live contestant
            round to join the leaderboard.
          </p>
        </div>
      )}
    </div>
  )
}

export function FeedbackButtons({
  p,
  id,
  rating,
}: {
  p: Pitch
  id: string
  rating: string | null
}) {
  const values: FeedbackRating[] = ["helpful", "unhelpful", "abusive"]
  return (
    <div className="feedback-actions">
      {values.map((value) => (
        <Button
          key={value}
          variant="ghost"
          disabled={p.busy || !!rating}
          onClick={() => {
            void p.act(async () => {
              await p.api.rateFeedback(id, value)
              await p.refresh()
              if (p.room) p.acceptRoom(await p.api.room(p.room.code))
              p.setNotice("Feedback rating saved.")
            })
          }}
        >
          {rating === value ? "✓ " : ""}
          {value === "abusive" ? "Hide abusive tip" : value}
        </Button>
      ))}
    </div>
  )
}

export function Profile({
  p,
  navigate,
  equipped,
}: {
  p: Pitch
  navigate: (page: Page) => void
  equipped: EquippedItems
}) {
  const me = p.me!
  const history = p.history
  return (
    <div className="page-stack">
      <div className="profile-hero">
        <div className="profile-character">
          <AvatarCharacter compact {...equipped} />
        </div>
        <div>
          <div className="eyebrow">
            AGES {me.ageBand} ·{" "}
            {me.rating.provisional ? "PLACEMENT ROUNDS" : "RATED CONTESTANT"}
          </div>
          <h1 className="display">{me.player.name}</h1>
          <p>
            {me.rating.value} PITCH Elo · {me.rating.games} rated rounds
          </p>
        </div>
        <Button onClick={() => navigate("Character")}>
          Customize Character
          <Icon name="arrow" />
        </Button>
      </div>
      <div className="profile-grid">
        <div className="panel">
          <SectionTitle eyebrow="PEER SCORECARDS" title="Your strengths" />
          {skills.map((k) => (
            <div className="skill-row" key={k}>
              <span className="capitalize">{k}</span>
              <div>
                <i style={{ width: `${(history?.averages[k] || 0) * 20}%` }} />
              </div>
              <strong>{history?.averages[k] ?? "—"}/5</strong>
            </div>
          ))}
          <p>Based on feedback from your recent rated rounds.</p>
        </div>
        <div className="panel">
          <SectionTitle
            eyebrow="GIVE FEEDBACK. GET BETTER."
            title="Your judging"
          />
          <p>
            {me.judge.roundsCompleted} rounds judged · Reliability{" "}
            {me.judge.reliability}/100.
          </p>
          <p>
            {me.judge.progressToCredit}/2 rounds toward your next priority
            credit.
          </p>
          <Button onClick={() => navigate("Head-to-Head")}>
            Join a round
            <Icon name="gavel" />
          </Button>
        </div>
      </div>
      <SectionTitle eyebrow="YOUR LAST 50 RATED ROUNDS" title="Round history" />
      {history?.history.length ? (
        history.history.map((r) => (
          <details className="panel" key={r.code}>
            <summary>
              <span>{r.scenario.title}</span>
              <strong className={r.delta >= 0 ? "positive" : "negative"}>
                {signed(r.delta)} Elo · {r.result}
              </strong>
            </summary>
            <p>
              {r.finishedAt ? new Date(r.finishedAt).toLocaleString() : ""} ·{" "}
              {r.before} → {r.after}
            </p>
            {r.feedback.map((f) => (
              <div className="feedback-card" key={f.ballotId}>
                <p>{f.tip}</p>
                <div className="score-row">
                  {skills.map((k) => (
                    <span key={k} className="capitalize">
                      {k} {f[k]}/5
                    </span>
                  ))}
                </div>
                <FeedbackButtons p={p} id={f.ballotId} rating={f.rating} />
              </div>
            ))}
          </details>
        ))
      ) : (
        <div className="panel">
          <p>Your first rated round and peer feedback will appear here.</p>
        </div>
      )}
      <Rules />
      {me.moderator && <Moderator p={p} />}
    </div>
  )
}

export function Character({
  equipped,
  setEquipped,
  shop = false,
}: {
  equipped: EquippedItems
  setEquipped: (v: EquippedItems) => void
  shop?: boolean
}) {
  const [tab, setTab] = useState("Outfit")
  return (
    <div className="page-stack">
      <SectionTitle
        eyebrow="PITCH LOCKER · DESIGN PREVIEW"
        title={shop ? "Explore the collection." : "Make it yours."}
      />
      <p>
        Try the team’s outfits, accessories and backgrounds for free. Your
        selection stays on this device. Coins, purchases, earned unlocks and XP
        are not enabled.
      </p>
      <div className="character-layout">
        <div
          className={`character-preview preview-${equipped.background.toLowerCase().replaceAll(" ", "-")}`}
        >
          <AvatarCharacter {...equipped} />
          <div className="character-identity">
            <strong>Your PITCH character</strong>
            <p>Cosmetic preview only.</p>
          </div>
        </div>
        <div className="inventory-panel">
          <div className="inventory-tabs">
            {["Outfit", "Accessories", "Background"].map((t) => (
              <button
                className={tab === t ? "inventory-tab-active" : ""}
                key={t}
                onClick={() => setTab(t)}
              >
                {t}
              </button>
            ))}
          </div>
          <div className="cosmetic-grid">
            {cosmeticItems
              .filter((i) => i.category === tab)
              .map((item) => {
                const key =
                  tab === "Outfit"
                    ? "outfit"
                    : tab === "Accessories"
                      ? "accessory"
                      : "background"
                return (
                  <button
                    className={`cosmetic-tile ${
                      equipped[key] === item.name ? "cosmetic-equipped" : ""
                    }`}
                    key={item.id}
                    onClick={() =>
                      setEquipped({ ...equipped, [key]: item.name })
                    }
                  >
                    <div className="item-state">
                      {equipped[key] === item.name ? "SELECTED" : "TRY ON"}
                    </div>
                    <div className={`item-art item-${item.id}`}>
                      <Icon
                        name={tab === "Outfit" ? "user" : "spark"}
                        size={34}
                      />
                    </div>
                    <strong>{item.name}</strong>
                    <span>Free preview</span>
                  </button>
                )
              })}
          </div>
        </div>
      </div>
    </div>
  )
}

export function Coach({ navigate }: { navigate: (page: Page) => void }) {
  return (
    <div className="page-stack">
      <SectionTitle
        eyebrow="AI COACH · NOT ENABLED"
        title="Practice is still free."
      />
      <div className="panel">
        <div className="category-icon cyan">
          <Icon name="spark" />
        </div>
        <h2 className="heading">Get feedback from people.</h2>
        <p>
          This prototype does not use a paid AI service. AI conversations and
          automated scoring are unavailable.
        </p>
        <div className="hero-actions">
          <Button onClick={() => navigate("Practice")}>Solo practice</Button>
          <Button variant="secondary" onClick={() => navigate("Head-to-Head")}>
            Get peer feedback
            <Icon name="arrow" />
          </Button>
        </div>
      </div>
    </div>
  )
}

function Moderator({ p }: { p: Pitch }) {
  const [reports, setReports] = useState<Reports | null>(null)
  return (
    <section className="panel form-stack">
      <SectionTitle title="Moderation reports" />
      <Button
        disabled={p.busy}
        onClick={() => {
          void p.act(async () => setReports(await p.api.reports()))
        }}
      >
        Load pending reports
      </Button>
      {reports?.reports.length === 0 && <p>No pending reports.</p>}
      {reports?.reports.map((r) => (
        <article key={r.id} className="feedback-card">
          <strong>
            {r.targetName} · {r.reason} · Room {r.roomCode}
          </strong>
          <p>{r.details}</p>
          <div className="hero-actions">
            {(["upheld", "dismissed"] as const).map((decision) => (
              <Button
                key={decision}
                variant="secondary"
                disabled={p.busy}
                onClick={() => {
                  void p.act(async () =>
                    setReports(await p.api.reviewReport(r.id, decision)),
                  )
                }}
              >
                {decision}
              </Button>
            ))}
          </div>
        </article>
      ))}
    </section>
  )
}

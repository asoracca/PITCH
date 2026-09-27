import { RoundHistory } from "./RoundHistory"
import { Wardrobe } from "./Wardrobe"
import { PlayerLink, FriendsPanel } from './PlayerProfiles'
import { PracticeLogs } from './PracticeLogs'
import { useEffect, useState, type FormEvent } from "react"
import {
  Button,
  SectionTitle,
  Stat,
  Icon,
  AvatarCharacter,
  AvatarBadge,
  type Page,
  type EquippedItems,
} from "./design"
import { countdown, initials, signed, skills } from "./model"
import { PracticeMicrophone } from "./PracticeMicrophone"
import { demoPlayers } from "./demo"
import { ScenarioPicker, practiceCategory, rememberPracticeCategory } from "./ScenarioPicker"
import { DemoProfile } from "./DemoProfile"
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
              Players aged 14+ share one pool. Your age band appears on your profile; your birth date and
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
          Quick play matches two contestants and one or three peer judges in the shared
          player pool. Topic choice and skill guide matching; age is profile information. Topics and positions are assigned by the server. Read for 20
          seconds; each contestant gets a 60-second opening and a 20-second
          response. Judges then have 60 seconds to vote and give feedback.
          If both contestants allow it and wait 30 seconds without a judge, they can play
          an unrated duel with one automated text-rubric judge and exchange opponent feedback.
        </p>
        <p>
          Judges score clarity, persuasiveness and composure from 1–5 and give
          each contestant a constructive tip. A majority wins; two tied ballots
          use total rubric scores, then a draw. A single-judge round needs that judge’s
          ballot; a three-judge round needs at least two. Otherwise no rating changes.
        </p>
        <p>
          Elo starts at 1000. Your first 10 rated rounds use K=32, then K=16.
          Every two completed judged rounds earns one contestant priority
          credit. Priority cannot create missing players. Queues expire after
          2½ minutes if no opponent is available.
        </p>
        <p>
          Leaving a rated round or disconnecting for 60 seconds triggers a
          five-minute queue break, or ten minutes after a repeat within 24
          hours. Contestants forfeit; the winner receives a reduced Elo gain.
          Judges lose 10 reliability points. Leaving an unrated practice duel simply
          ends it without a rating penalty or queue break.
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
          players see your display name and age band. Live audio and optional camera
          video travel between browsers and are not recorded by PITCH; peer connections can reveal network
          addresses. Some networks need the text fallback.
        </p>
        <p>
          Your session token stays in this tab until sign-out or expiry. Solo
          practice drafts stay on the current screen and are not submitted or
          scored. Solo voice recordings stay in memory for playback and are discarded
          on navigation or deletion. Character previews save only on this device. Contact the
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
            Your look won’t affect your score.
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
            <Button variant="ghost" onClick={() => { rememberPracticeCategory("all"); navigate("Practice") }}>
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
              onClick={() => { rememberPracticeCategory(category); navigate("Practice") }}
            >
              <div
                className={`category-icon ${["purple", "cyan", "green", "orange", "pink"][i % 5]}`}
              >
                <Icon name="target" />
              </div>
              <div className="category-title capitalize">{category}</div>
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
            Two contestants. One scenario. One or three judges.
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
  const [category, setCategory] = useState(practiceCategory)
  const [selected, setSelected] = useState(
    () => {
      const matching = scenarios.filter(s => category === "all" || s.category === category)
      return matching[Math.floor(Date.now() / 86400000) % matching.length]?.id || scenarios[0]?.id || ""
    },
  )
  const [deadline, setDeadline] = useState(0)
  const [now, setNow] = useState(Date.now())
  const [done, setDone] = useState(false)
  const [attempt, setAttempt] = useState(0)
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
          setNotice(`New scenario: ${next.title}.`)
        }}>Random scenario <Icon name="spark" /></Button>}
      />
      <ScenarioPicker scenarios={scenarios} selected={scenario.id} category={category}
        onCategory={(next) => {
          setCategory(next); rememberPracticeCategory(next)
          const matching = scenarios.find((s) => next === "all" || s.category === next)
          if (matching && next !== "all" && scenario.category !== next) choose(matching)
          else setNotice("")
        }} onSelect={choose} />
      <details className="review-details"><summary>Practice details</summary><p>Random picks use your category. Drafts last for this visit.</p></details>
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
        <PracticeMicrophone
          key={`${scenario.id}:${attempt}`}
          draft={response} onDraftChange={text=>setDrafts(current=>({...current,[scenario.id]:text}))}
          onSave={async snapshot=>{await p.api.savePractice({...snapshot,scenarioId:scenario.id});await p.refresh()}}
          coaching prompt={scenario.prompt} goal={scenario.goal}
          deadline={deadline}
          finished={finished}
          onStarted={() => {
            if (!deadline || finished) {
              setDone(false)
              setNow(Date.now())
              setDeadline(Date.now() + 60000)
            }
          }}
        />
        <div className="response-submit">
          <span>60-second practice · Unrated</span>
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
                setAttempt(value=>value+1)
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
    </div>
  )
}

export function Leaderboard({ p }: { p: Pitch }) {
  const leaders = p.leaders
  const [mode, setMode] = useState<"live" | "demo" | null>(null)
  if (!leaders) return <p>Loading leaderboard…</p>
  const demo = mode === "demo" || (mode === null && !leaders.players.length)
  const players = demo ? demoPlayers : leaders.players
  return (
    <div className="page-stack">
      <SectionTitle
        eyebrow="WEEKLY LEAGUE · ALL PLAYERS"
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
      <div className="hero-actions" role="group" aria-label="Leaderboard view">
        <Button variant={demo ? "ghost" : "secondary"} aria-pressed={!demo} onClick={() => setMode("live")}>Real players</Button>
        <Button variant={demo ? "secondary" : "ghost"} aria-pressed={demo} onClick={() => setMode("demo")}>Demo players</Button>
      </div>
      {demo && <div className="pricing-preview-note"><Icon name="spark" /><div><strong>Demo leaderboard</strong><p>Fictional players and scores. Real rankings are unchanged.</p></div></div>}
      <p>
        Elo gained since{" "}
        {new Date(leaders.weekStartsAt).toLocaleDateString()}. Resets Mondays, 00:00 UTC.
      </p>
      {players.length > 0 ? (
        <>
          <div className="podium">
            {players.slice(0, 3).map((v, i) => (
              <div
                className={`podium-player ${["first", "second", "third"][i]}`}
                key={v.playerId}
              >
                <PlayerLink player={{id:v.playerId,name:v.name,avatar:v.avatar}} className="player-link-stack"><AvatarBadge name={v.name} look={v.avatar} size="xl" /><strong>{v.name}</strong></PlayerLink>
                {demo && <small className="demo-badge">DEMO</small>}
                <span>{signed(v.weeklyGain)} Elo this week</span>
                <div>{i + 1}</div>
              </div>
            ))}
          </div>
          <div className="leader-list">
            {players.map((v, i) => (
              <div
                className={`leader-row ${
                  v.playerId === p.me!.player.id ? "you" : ""
                }`}
                key={v.playerId}
              >
                <strong>#{i + 1}</strong>
                <PlayerLink player={{id:v.playerId,name:v.name,avatar:v.avatar}} className="grow"><AvatarBadge name={v.name} look={v.avatar} /><span>{v.name}</span>
                  {demo && <small className="demo-badge">DEMO</small>}
                  {v.playerId === p.me!.player.id && <small>YOU</small>}
                </PlayerLink>
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
            No rated rounds yet. Complete a live contestant
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
  equipped, demoProfile: controlledDemo, setDemoProfile: changeDemo,
}: {
  p: Pitch
  navigate: (page: Page) => void
  equipped: EquippedItems
  demoProfile?: boolean
  setDemoProfile?: (value:boolean) => void
}) {
  const me = p.me!
  const history = p.history
  const [localDemo, setLocalDemo] = useState(true)
  const demoProfile=controlledDemo ?? localDemo, setDemoProfile=changeDemo ?? setLocalDemo
  const profileToggle = <div className="hero-actions" role="group" aria-label="Profile activity view"><Button variant={demoProfile ? "secondary" : "ghost"} aria-pressed={demoProfile} onClick={() => setDemoProfile(true)}>Demo profile</Button><Button variant={demoProfile ? "ghost" : "secondary"} aria-pressed={!demoProfile} onClick={() => setDemoProfile(false)}>Real activity</Button></div>
  if (demoProfile) return <div className="page-stack">{profileToggle}<DemoProfile p={p} equipped={equipped} navigate={navigate} /><FriendsPanel /></div>
  return (
    <div className="page-stack">
      {profileToggle}
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
      <PracticeLogs entries={history?.practices || []} onDelete={async id=>{await p.api.deletePractice(id);await p.refresh()}} />
      <RoundHistory p={p} navigate={navigate} />
      <FriendsPanel />
      <Rules />
      {me.moderator && <Moderator p={p} />}
    </div>
  )
}

export function Character({
  equipped,
  setEquipped,
  shop = false,
  onSave, saving = false,
}: {
  equipped: EquippedItems
  setEquipped: (v: EquippedItems) => void
  shop?: boolean
  onSave?: () => void
  saving?: boolean
}) {
  return <Wardrobe equipped={equipped} setEquipped={setEquipped} shop={shop} onSave={onSave} saving={saving} />
}

export { Coach } from "./RoleplayCoach"

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

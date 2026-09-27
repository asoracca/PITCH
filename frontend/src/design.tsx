import type { AvatarLook } from "../../shared/avatar"
import { type ReactNode, type ButtonHTMLAttributes } from "react"

export type Page = "Home" | "Dashboard" | "Practice" | "Head-to-Head" | "AI Coach" | "Leaderboard" | "Profile" | "Character" | "Avatar Shop" | "Plans"

export type EquippedItems = {
  outfit: string
  accessory: string
  background: string
  skinTone?: string
  hairColor?: string
  avatarEnabled?: boolean
}

export const skinTones = [
  { id: "light", name: "Light", color: "#f2d3bd", shade: "#dfb39a" },
  { id: "warm", name: "Warm beige", color: "#deb08c", shade: "#c9946e" },
  { id: "tan", name: "Tan", color: "#c48b61", shade: "#a9714e" },
  { id: "brown", name: "Medium brown", color: "#9d654b", shade: "#8c563f" },
  { id: "deep", name: "Deep brown", color: "#754933", shade: "#603822" },
  { id: "rich", name: "Rich brown", color: "#4b3026", shade: "#382219" },
]
export const hairColors = [
  { id: "black", name: "Black", color: "#1a1720" },
  { id: "brown", name: "Brown", color: "#593726" },
  { id: "auburn", name: "Auburn", color: "#914c36" },
  { id: "blond", name: "Blond", color: "#d9b55e" },
  { id: "silver", name: "Silver", color: "#b8beca" },
  { id: "violet", name: "Violet", color: "#8b72ed" },
]

export type ProfileData = {
  name: string
  avatar: string
  avatarLook?: EquippedItems | null
  schoolMajor: string
  locationBio: string
}

export type IconName = "home" | "grid" | "play" | "versus" | "spark" | "trophy" | "user" | "gavel" | "bolt" | "fire" | "clock" | "arrow" | "check" | "mic" | "video" | "text" | "target" | "star" | "menu" | "bell" | "close"

const navItems: { label: Page; icon: IconName }[] = [
  { label: "Home", icon: "home" },
  { label: "Dashboard", icon: "grid" },
  { label: "Practice", icon: "play" },
  { label: "Head-to-Head", icon: "versus" },
  { label: "AI Coach", icon: "spark" },
  { label: "Leaderboard", icon: "trophy" },
  { label: "Profile", icon: "user" },
  { label: "Plans", icon: "star" },
]

const iconPaths: Record<IconName, ReactNode> = {
  home: (
    <>
      <path d="m3 10 9-7 9 7" />
      <path d="M5 9v11h14V9M9 20v-7h6v7" />
    </>
  ),
  grid: (
    <>
      <rect x="3" y="3" width="7" height="7" rx="2" />
      <rect x="14" y="3" width="7" height="7" rx="2" />
      <rect x="3" y="14" width="7" height="7" rx="2" />
      <rect x="14" y="14" width="7" height="7" rx="2" />
    </>
  ),
  play: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="m10 8 6 4-6 4Z" />
    </>
  ),
  versus: (
    <>
      <path d="M8 8h8M8 16h8M5 5l3 3-3 3M19 13l-3 3 3 3" />
    </>
  ),
  spark: (
    <>
      <path d="m12 3 1.4 4.2L18 9l-4.6 1.8L12 15l-1.4-4.2L6 9l4.6-1.8Z" />
      <path d="m18.5 15 .8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8Z" />
    </>
  ),
  trophy: (
    <>
      <path d="M8 4h8v5a4 4 0 0 1-8 0Z" />
      <path d="M12 13v4M8 21h8M9 17h6M8 6H4v2a4 4 0 0 0 4 4M16 6h4v2a4 4 0 0 1-4 4" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0" />
    </>
  ),
  gavel: (
    <>
      <path d="m14 5 5 5M12 7l5 5M15.5 3.5l-5 5 6 6 5-5ZM12 12 4 20M2 21h8" />
    </>
  ),
  bolt: <path d="m13 2-8 12h7l-1 8 8-12h-7Z" />,
  fire: (
    <path d="M12 22c4 0 7-3 7-7 0-3-2-6-5-9 0 3-2 5-3 6 0-4-2-7-4-9 0 5-3 7-3 12 0 4 3 7 8 7Z" />
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  arrow: (
    <>
      <path d="M5 12h14M14 7l5 5-5 5" />
    </>
  ),
  check: <path d="m5 12 4 4L19 6" />,
  mic: (
    <>
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0M12 18v3M9 21h6" />
    </>
  ),
  video: (
    <>
      <rect x="3" y="6" width="13" height="12" rx="2" />
      <path d="m16 10 5-3v10l-5-3Z" />
    </>
  ),
  text: (
    <>
      <path d="M5 5h14M12 5v14M8 19h8" />
    </>
  ),
  target: (
    <>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="5" />
      <circle cx="12" cy="12" r="1" />
    </>
  ),
  star: (
    <path d="m12 3 2.7 5.5 6 .9-4.4 4.2 1 6-5.3-2.8-5.3 2.8 1-6-4.4-4.2 6-.9Z" />
  ),
  menu: (
    <>
      <path d="M4 7h16M4 12h16M4 17h16" />
    </>
  ),
  bell: (
    <>
      <path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" />
    </>
  ),
  close: (
    <>
      <path d="m6 6 12 12M18 6 6 18" />
    </>
  ),
}

export function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {iconPaths[name]}
    </svg>
  )
}

export function Button({
  children,
  variant = "primary",
  onClick,
  className = "",
  ...props
}: {
  children: ReactNode
  variant?: "primary" | "secondary" | "ghost"
  onClick?: () => void
  className?: string
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      {...props}
      className={`btn btn-${variant} ${className}`}
      onClick={onClick}
    >
      {children}
    </button>
  )
}

export function Logo({ onHome }: { onHome?: () => void }) {
  return (
    <a className="logo" href="#Home" aria-label="PITCH home" onClick={(event) => { if (onHome) { event.preventDefault(); onHome() } }}>
      <img className="pitch-logo-mark" src="/pitch-mark.svg" width="64" height="64" alt="" aria-hidden="true" />
      <span>PITCH</span>
    </a>
  )
}

export function Sidebar({
  page,
  onNavigate,
  open,
  onClose,
  profile,
}: {
  page: Page
  onNavigate: (page: Page) => void
  open: boolean
  onClose: () => void
  profile: ProfileData
}) {
  return (
    <aside className={`sidebar ${open ? "sidebar-open" : ""}`}>
      <div className="sidebar-head">
        <Logo onHome={() => onNavigate("Home")} />
        <button
          className="icon-button mobile-only"
          onClick={onClose}
          aria-label="Close menu"
        >
          <Icon name="close" />
        </button>
      </div>
      <nav className="nav-list" aria-label="Main navigation">
        {navItems.map((item) => (
          <button
            key={item.label}
            className={`nav-item ${page === item.label ? "nav-active" : ""}`}
            aria-current={page === item.label ? "page" : undefined}
            onClick={() => {
              onNavigate(item.label)
              onClose()
            }}
          >
            <Icon name={item.icon} />
            <span>{item.label}</span>
          </button>
        ))}
      </nav>
      <div className="sidebar-footer">
        <div className="mini-level">
          <AvatarBadge name={profile.name} look={profile.avatarLook} />
          <div className="grow">
            <div className="mini-name">{profile.name}</div>
            <div className="mini-label">Career skills in practice</div>
          </div>
          <Icon name="arrow" size={16} />
        </div>
      </div>
    </aside>
  )
}

export function Stat({
  icon,
  value,
  label,
  tone,
}: {
  icon: IconName
  value: string
  label: string
  tone: string
}) {
  return (
    <div className="stat-card">
      <div className={`stat-icon ${tone}`}>
        <Icon name={icon} />
      </div>
      <div>
        <div className="stat-value">{value}</div>
        <div className="muted">{label}</div>
      </div>
    </div>
  )
}

export function SectionTitle({
  eyebrow,
  title,
  action,
}: {
  eyebrow?: string
  title: string
  action?: ReactNode
}) {
  return (
    <div className="section-title">
      <div>
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h2 className="heading">{title}</h2>
      </div>
      {action}
    </div>
  )
}

export const cosmeticItems = [
  {
    id: "pitch",
    name: "Varsity Pitch",
    category: "Outfit",
    price: 0,
    rarity: "OWNED",
    requirement: "",
  },
  {
    id: "casual",
    name: "Smart Casual",
    category: "Outfit",
    price: 350,
    rarity: "NEW",
    requirement: "",
  },
  {
    id: "formal",
    name: "The Closer",
    category: "Outfit",
    price: 700,
    rarity: "RARE",
    requirement: "Reach Level 10",
  },
  {
    id: "show",
    name: "Game Show Glow",
    category: "Outfit",
    price: 900,
    rarity: "LIMITED",
    requirement: "",
  },
  {
    id: "glasses",
    name: "Round Glasses",
    category: "Accessories",
    price: 0,
    rarity: "OWNED",
    requirement: "",
  },
  {
    id: "phones",
    name: "Focus Headphones",
    category: "Accessories",
    price: 280,
    rarity: "NEW",
    requirement: "",
  },
  {
    id: "pin",
    name: "Great Communicator",
    category: "Accessories",
    price: 0,
    rarity: "ACHIEVEMENT",
    requirement: "Earn Great Communicator badge",
  },
  {
    id: "pack",
    name: "Day One Backpack",
    category: "Accessories",
    price: 420,
    rarity: "RARE",
    requirement: "",
  },
  {
    id: "navy",
    name: "Midnight Arena",
    category: "Background",
    price: 0,
    rarity: "OWNED",
    requirement: "",
  },
  {
    id: "violet",
    name: "Violet Voltage",
    category: "Background",
    price: 500,
    rarity: "NEW",
    requirement: "",
  },
  {
    id: "streak",
    name: "Flame Streak",
    category: "Background",
    price: 0,
    rarity: "STREAK",
    requirement: "Reach a 30-day streak",
  },
  {
    id: "elite",
    name: "Leaderboard Elite",
    category: "Background",
    price: 0,
    rarity: "RANKED",
    requirement: "Finish in the weekly top 10",
  },
]

export function AvatarCharacter({
  outfit = "Varsity Pitch",
  accessory = "Round Glasses",
  background = "Midnight Arena",
  compact = false,
  portrait = false,
  skinTone = "brown",
  hairColor = "black",
  avatarEnabled = false,
}: {
  outfit?: string
  accessory?: string
  background?: string
  compact?: boolean
  portrait?: boolean
  skinTone?: string
  hairColor?: string
  avatarEnabled?: boolean
}) {
  const skin = skinTones.find((tone) => tone.id === skinTone) || skinTones[3]
  const hair = hairColors.find((color) => color.id === hairColor) || hairColors[0]
  if (!avatarEnabled) return <span className={`avatar-placeholder ${compact || portrait ? "avatar-placeholder-compact" : ""}`} role="img" aria-label="No avatar selected"><Icon name="user" size={96} /></span>
  const jacket =
    outfit === "Game Show Glow"
      ? "#88f4f5"
      : outfit === "The Closer"
        ? "#6e5bd4"
        : outfit === "Smart Casual"
          ? "#279ba7"
          : "#8b72ed"
  const backdrop =
    background === "Violet Voltage"
      ? "#2f235c"
      : background === "Flame Streak"
        ? "#51251d"
        : background === "Leaderboard Elite"
          ? "#3c3516"
          : "#111a2e"
  return (
    <svg
      className={`pitch-character ${compact ? "character-compact" : ""}`}
      viewBox={portrait ? "75 45 130 155" : "0 0 280 400"}
      role="img"
      aria-label="Customizable PITCH character"
    >
      <rect width="280" height="400" rx="30" fill={backdrop} />
      <path
        d="M0 310Q70 270 140 310T280 310V400H0Z"
        fill="#0a0f20"
        opacity=".65"
      />
      <circle cx="140" cy="115" r="54" fill={skin.color} />
      <path
        d="M87 112Q86 46 145 48Q205 50 193 123L178 90Q135 103 99 80Z"
        fill={hair.color}
      />
      <path
        d="M109 135q12 10 24 0M151 135q12 10 24 0"
        fill="none"
        stroke="#21161a"
        strokeWidth="4"
        strokeLinecap="round"
      />
      <path
        d="M132 154q10 8 20 0"
        fill="none"
        stroke="#6b342d"
        strokeWidth="4"
        strokeLinecap="round"
      />
      <path d="M112 181h56v30h-56z" fill={skin.shade} />
      <path
        d="M63 263Q68 198 112 190h56q45 10 50 73l-20 83H82Z"
        fill={jacket}
      />
      <path d="m112 190 28 42 28-42-8 88h-40Z" fill="#f5f3ee" />
      <path d="m132 207 8 25 8-25-8-8Z" fill="#88f4f5" />
      <path
        d="M82 250 56 340M198 250l26 90"
        stroke={jacket}
        strokeWidth="30"
        strokeLinecap="round"
      />
      <path d="M92 344h38v45H76ZM150 344h38l16 45h-54Z" fill="#171d2e" />
      {accessory === "Round Glasses" && (
        <>
          <circle
            cx="116"
            cy="126"
            r="19"
            fill="none"
            stroke="#88f4f5"
            strokeWidth="5"
          />
          <circle
            cx="164"
            cy="126"
            r="19"
            fill="none"
            stroke="#88f4f5"
            strokeWidth="5"
          />
          <path d="M135 126h10" stroke="#88f4f5" strokeWidth="5" />
        </>
      )}
      {accessory === "Focus Headphones" && (
        <>
          <path
            d="M88 118q0-58 52-58t52 58"
            fill="none"
            stroke="#88f4f5"
            strokeWidth="9"
          />
          <rect x="80" y="108" width="18" height="45" rx="9" fill="#88f4f5" />
          <rect x="182" y="108" width="18" height="45" rx="9" fill="#88f4f5" />
        </>
      )}
      {accessory === "Great Communicator" && (
        <circle cx="187" cy="235" r="11" fill="#88f4f5" />
      )}
      {accessory === "Day One Backpack" && (
        <path d="M75 218q-24 8-19 82h24l8-76Z" fill="#ea874d" />
      )}
    </svg>
  )
}

export function ItemTile({
  item,
  owned,
  equipped,
  onSelect,
}: {
  item: typeof cosmeticItems[number]
  owned: boolean
  equipped: boolean
  onSelect: () => void
}) {
  const locked = Boolean(item.requirement)
  return (
    <button
      className={`cosmetic-tile ${locked ? "cosmetic-locked" : ""} ${
        equipped ? "cosmetic-equipped" : ""
      }`}
      onClick={onSelect}
    >
      <div className="item-state">{equipped ? "EQUIPPED" : item.rarity}</div>
      <div className={`item-art item-${item.id}`}>
        {item.category === "Outfit" ? (
          <Icon name="user" size={34} />
        ) : item.category === "Accessories" ? (
          <Icon name={item.id === "phones" ? "mic" : "star"} size={34} />
        ) : (
          <Icon name="spark" size={34} />
        )}
      </div>
      <strong>{item.name}</strong>
      {locked ? (
        <span className="lock-reason">
          <Icon name="clock" size={13} /> {item.requirement}
        </span>
      ) : owned ? (
        <span className="owned-label">
          <Icon name="check" size={13} /> Owned
        </span>
      ) : (
        <span className="item-price">
          <Icon name="bolt" size={13} /> {item.price}
        </span>
      )}
    </button>
  )
}

export function AvatarBadge({name,look,size='small'}:{name:string;look?:Partial<AvatarLook>|null;size?:'small'|'xl'}) {
  return <span className={`avatar avatar-${size} avatar-character-badge ${!look?.avatarEnabled?'avatar-blank':''}`} role="img" aria-label={look?.avatarEnabled?`${name}’s avatar`:`${name} has no avatar`}><AvatarCharacter {...look} portrait /></span>
}

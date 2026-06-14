import type { ReactNode } from "react";

export type IconName =
  | "activity"
  | "arrow-down"
  | "arrow-right"
  | "arrow-up"
  | "briefcase"
  | "camera"
  | "chart"
  | "clock"
  | "code"
  | "dashboard"
  | "eye"
  | "file"
  | "megaphone"
  | "menu"
  | "message"
  | "palette"
  | "play"
  | "plus"
  | "settings"
  | "target"
  | "user"
  | "ai"
  | "x";

type AppIconProps = {
  name: IconName;
  className?: string;
  title?: string;
  strokeWidth?: number;
};

export default function AppIcon({ name, className = "size-4", title, strokeWidth = 2 }: AppIconProps) {
  const common = {
    className,
    fill: "none",
    stroke: "currentColor",
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    strokeWidth,
    viewBox: "0 0 24 24",
    "aria-hidden": title ? undefined : true,
    role: title ? "img" : undefined,
  };

  return (
    <svg {...common}>
      {title && <title>{title}</title>}
      {renderIconPath(name)}
    </svg>
  );
}

function renderIconPath(name: IconName): ReactNode {
  switch (name) {
    case "ai":
      return (
        <>
          <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" />
          <path d="M20 3v4" />
          <path d="M22 5h-4" />
          <path d="M4 17v2" />
          <path d="M5 18H3" />
        </>
      );
    case "activity":
      return <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />;
    case "arrow-down":
      return (
        <>
          <path d="M12 5v14" />
          <path d="m19 12-7 7-7-7" />
        </>
      );
    case "arrow-right":
      return (
        <>
          <path d="M5 12h14" />
          <path d="m12 5 7 7-7 7" />
        </>
      );
    case "arrow-up":
      return (
        <>
          <path d="M12 19V5" />
          <path d="m5 12 7-7 7 7" />
        </>
      );
    case "briefcase":
      return (
        <>
          <rect x="3" y="7" width="18" height="13" rx="2" />
          <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
          <path d="M3 13h18" />
        </>
      );
    case "camera":
      return (
        <>
          <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
          <circle cx="12" cy="13" r="4" />
        </>
      );
    case "chart":
      return (
        <>
          <path d="M3 3v18h18" />
          <rect x="7" y="12" width="3" height="5" />
          <rect x="12" y="8" width="3" height="9" />
          <rect x="17" y="5" width="3" height="12" />
        </>
      );
    case "clock":
      return (
        <>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3 2" />
        </>
      );
    case "code":
      return (
        <>
          <path d="m8 9-4 3 4 3" />
          <path d="m16 9 4 3-4 3" />
          <path d="m14 4-4 16" />
        </>
      );
    case "dashboard":
      return (
        <>
          <rect x="3" y="3" width="7" height="7" />
          <rect x="14" y="3" width="7" height="7" />
          <rect x="3" y="14" width="7" height="7" />
          <rect x="14" y="14" width="7" height="7" />
        </>
      );
    case "eye":
      return (
        <>
          <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
          <circle cx="12" cy="12" r="3" />
        </>
      );
    case "file":
      return (
        <>
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
          <path d="M14 2v6h6" />
        </>
      );
    case "megaphone":
      return (
        <>
          <path d="m3 11 18-5v12L3 13v-2Z" />
          <path d="M7 14v4a2 2 0 0 0 2 2h1" />
        </>
      );
    case "menu":
      return (
        <>
          <path d="M4 6h16" />
          <path d="M4 12h16" />
          <path d="M4 18h16" />
        </>
      );
    case "message":
      return (
        <>
          <path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4v8Z" />
          <path d="M8 9h8" />
          <path d="M8 13h5" />
        </>
      );
    case "palette":
      return (
        <>
          <path d="M12 3a9 9 0 0 0 0 18h1.5a2 2 0 0 0 1.4-3.4 1.5 1.5 0 0 1 1.1-2.6H18a6 6 0 0 0 0-12h-6Z" />
          <circle cx="7.5" cy="10.5" r=".75" fill="currentColor" />
          <circle cx="10.5" cy="7.5" r=".75" fill="currentColor" />
          <circle cx="14.5" cy="7.5" r=".75" fill="currentColor" />
        </>
      );
    case "play":
      return <polygon points="8 5 19 12 8 19 8 5" />;
    case "plus":
      return (
        <>
          <path d="M12 5v14" />
          <path d="M5 12h14" />
        </>
      );
    case "settings":
      return (
        <>
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 1.55V21a2 2 0 1 1-4 0v-.08a1.7 1.7 0 0 0-1-1.55 1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.55-1H3a2 2 0 1 1 0-4h.08a1.7 1.7 0 0 0 1.55-1 1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-1.55V3a2 2 0 1 1 4 0v.08a1.7 1.7 0 0 0 1 1.55 1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.7 1.7 0 0 0 19.4 9c.2.6.78 1 1.55 1H21a2 2 0 1 1 0 4h-.08a1.7 1.7 0 0 0-1.52 1Z" />
        </>
      );
    case "target":
      return (
        <>
          <circle cx="12" cy="12" r="9" />
          <circle cx="12" cy="12" r="5" />
          <circle cx="12" cy="12" r="1" />
        </>
      );
    case "user":
      return (
        <>
          <circle cx="12" cy="8" r="4" />
          <path d="M4 21a8 8 0 0 1 16 0" />
        </>
      );
    case "x":
      return (
        <>
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </>
      );
  }
}

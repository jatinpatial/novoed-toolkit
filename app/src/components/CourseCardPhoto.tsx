import type { MouseEvent } from "react";
import { Link } from "react-router-dom";

/**
 * CourseCardPhoto — recent-course tile for the dashboard's course
 * strip (Phase 2 #2 A6).
 *
 * Two visual branches off a single shape:
 *
 *   1. Photo branch (`imageUrl` set) — full-bleed photograph behind a
 *      tinted gradient overlay. Default tint is bright BCG green
 *      (rgba(0,107,63,0.85)) → deep green (rgba(0,59,34,0.92)) so the
 *      photo carries through but the title still sits on a confident
 *      branded surface. Override per-card via `tintFrom`/`tintTo`.
 *
 *   2. Fallback branch (no `imageUrl`) — pure gradient cover from
 *      green-700 to ink-900. Used for placeholder courses, internal
 *      tooling, anything without a hero image.
 *
 * Cover decoration: a slow-rotating 130px ring + a counter-rotating
 * 80px rounded square float on top, plus a sheen sweep that runs
 * left → right when the card is hovered. All chrome lives inside the
 * cover; the body is plain title + meta row.
 *
 * Element selection — exactly one of `to` / `onClick` should be set:
 *   - `to` set                → renders `<Link>` (router navigation)
 *   - `onClick` set           → renders `<button>` (callback)
 *   - neither                 → renders `<div>` (presentational only)
 *
 * Why three render shapes instead of always-Link: the recent-courses
 * strip sometimes navigates by route, sometimes opens an inline drawer
 * (B2d), sometimes is shown as a static demo (Components catalog
 * preview). Keeping the choice at the prop level beats forcing every
 * caller to wrap.
 *
 * Mockup anchors: docs/vision-mockup.html lines 825–911 (CSS) and
 * 1553–1599 (DOM examples).
 */
interface CourseCardPhotoProps {
  title: string;
  /** Meta segments joined with "·" inside the body row. */
  meta: string[];
  /** Optional tag chip in the cover's top-left corner. */
  tag?: string;
  /** When set, the cover renders the photo branch with gradient overlay. */
  imageUrl?: string;
  /** Top-left overlay color. Default `rgba(0,107,63,0.85)`. */
  tintFrom?: string;
  /** Bottom-right overlay color. Default `rgba(0,59,34,0.92)`. */
  tintTo?: string;
  /** Router href — when set, the card renders as a `<Link>`. */
  to?: string;
  /** Click callback — when set (and `to` isn't), the card renders as a `<button>`. */
  onClick?: (e: MouseEvent<HTMLButtonElement>) => void;
}

const DEFAULT_TINT_FROM = "rgba(0,107,63,0.85)";
const DEFAULT_TINT_TO = "rgba(0,59,34,0.92)";

export function CourseCardPhoto({
  title,
  meta,
  tag,
  imageUrl,
  tintFrom = DEFAULT_TINT_FROM,
  tintTo = DEFAULT_TINT_TO,
  to,
  onClick,
}: CourseCardPhotoProps) {
  const coverStyle = imageUrl
    ? {
        backgroundImage: `linear-gradient(135deg, ${tintFrom}, ${tintTo}), url(${imageUrl})`,
      }
    : {
        // Fallback gradient — ink-900 hex matches Tailwind config so a
        // CSS-var lookup isn't needed inline.
        backgroundImage: "linear-gradient(135deg, var(--green-700), #121318)",
      };

  const inner = (
    <>
      <div
        className={imageUrl ? "course-cover course-cover-photo bcg-editorial-image-tint" : "course-cover"}
        style={coverStyle}
      >
        <div className="course-cover-shape" />
        <div className="course-cover-shape-2" />
        {tag && <div className="course-tag">{tag}</div>}
      </div>
      <div className="course-body">
        <h3 className="course-title">{title}</h3>
        <div className="course-meta">
          {meta.map((segment, i) => (
            <span key={i}>
              {segment}
              {i < meta.length - 1 && <span aria-hidden="true"> · </span>}
            </span>
          ))}
        </div>
      </div>
    </>
  );

  if (to) {
    return (
      <Link to={to} className="course-card">
        {inner}
      </Link>
    );
  }
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className="course-card text-left">
        {inner}
      </button>
    );
  }
  return <div className="course-card">{inner}</div>;
}

/**
 * Microinteraction: when the user stars a session, a ghost clone of the card
 * flies in a small arc to the My List counter pill. Counter pulse is handled
 * separately by `pages/program/index.vue` (watch on the count).
 *
 * Skips silently when the counter isn't in the DOM (e.g. user not checked in)
 * or when the user prefers reduced motion.
 */

const ANIMATION_DURATION_MS = 750;
const COUNTER_SELECTOR = '[data-testid="mylist-counter"]';

export interface FlyContent {
  title: string;
  subtitle: string;
}

export function useMyListFlyAnimation() {
  function flyToCounter(sourceEl: HTMLElement, content: FlyContent) {
    if (typeof window === "undefined") return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;

    const counter = document.querySelector(COUNTER_SELECTOR);
    if (!counter) return;

    const cardRect = sourceEl.getBoundingClientRect();
    const counterRect = counter.getBoundingClientRect();

    const ghost = buildGhost(cardRect, content);
    document.body.appendChild(ghost);

    const targetX = counterRect.left + counterRect.width / 2;
    const targetY = counterRect.top + counterRect.height / 2;
    const deltaX = targetX - (cardRect.left + cardRect.width / 2);
    const deltaY = targetY - (cardRect.top + cardRect.height / 2);

    const anim = ghost.animate(
      [
        { transform: "translate(0, 0) scale(1)", opacity: 1 },
        {
          transform: `translate(${deltaX * 0.5}px, ${deltaY * 0.5 - 20}px) scale(0.5)`,
          opacity: 0.9,
          offset: 0.5,
        },
        {
          transform: `translate(${deltaX}px, ${deltaY}px) scale(0.1)`,
          opacity: 0,
        },
      ],
      {
        duration: ANIMATION_DURATION_MS,
        easing: "cubic-bezier(0.5, 0, 0.6, 1)",
        fill: "forwards",
      },
    );

    function landed() {
      ghost.remove();
      window.dispatchEvent(new CustomEvent("mylist:landed"));
    }
    anim.onfinish = landed;
    anim.oncancel = landed;
  }

  return { flyToCounter };
}

function buildGhost(rect: DOMRect, content: FlyContent): HTMLDivElement {
  const ghost = document.createElement("div");
  Object.assign(ghost.style, {
    position: "fixed",
    left: `${rect.left}px`,
    top: `${rect.top}px`,
    width: `${rect.width}px`,
    height: `${rect.height}px`,
    pointerEvents: "none",
    zIndex: "200",
    background: "var(--color-surface-2, #1f1f1f)",
    color: "var(--color-text-primary, #fafaf9)",
    borderRadius: "12px",
    padding: "12px",
    boxShadow: "0 8px 32px rgba(0, 0, 0, 0.5)",
    overflow: "hidden",
    willChange: "transform, opacity",
  } as CSSStyleDeclaration);

  const titleEl = document.createElement("div");
  Object.assign(titleEl.style, {
    fontSize: "14px",
    fontWeight: "500",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  } as CSSStyleDeclaration);
  titleEl.textContent = content.title;

  const subtitleEl = document.createElement("div");
  Object.assign(subtitleEl.style, {
    fontSize: "12px",
    color: "var(--color-text-muted, #a8a29e)",
    marginTop: "4px",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  } as CSSStyleDeclaration);
  subtitleEl.textContent = content.subtitle;

  ghost.append(titleEl, subtitleEl);
  return ghost;
}

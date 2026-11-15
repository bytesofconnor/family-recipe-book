function visibleChromeBottom(targetTop: number): number {
  const view = window.visualViewport;
  const viewBottom = (view?.offsetTop ?? 0) + (view?.height ?? window.innerHeight);
  let limit = viewBottom;
  const dock = document.querySelector(".book-dock");
  if (dock instanceof HTMLElement && getComputedStyle(dock).display !== "none") {
    const dockTop = dock.getBoundingClientRect().top;
    if (dockTop > 0) {
      limit = Math.min(limit, dockTop);
    }
  }
  const bar = document.querySelector(".write-desk-savebar");
  if (bar instanceof HTMLElement) {
    const barTop = bar.getBoundingClientRect().top;
    // Only the stuck bar covers the field. Once it sits lower in the page,
    // the field is already above it.
    if (barTop > targetTop && barTop < limit) {
      limit = barTop;
    }
  }
  return limit;
}

export function fieldIsCovered(target: HTMLElement): boolean {
  const rect = target.getBoundingClientRect();
  if (rect.width === 0 && rect.height === 0) {
    return false;
  }
  const viewTop = (window.visualViewport?.offsetTop ?? 0) + 8;
  const limit = visibleChromeBottom(rect.top) - 12;
  return rect.top < viewTop || rect.bottom > limit;
}

export function keepFocusedFieldVisible(target: HTMLElement): void {
  const rect = target.getBoundingClientRect();
  if (rect.width === 0 && rect.height === 0) {
    return;
  }
  const viewTop = (window.visualViewport?.offsetTop ?? 0) + 8;
  const limit = visibleChromeBottom(rect.top) - 12;
  if (rect.top >= viewTop && rect.bottom <= limit) {
    return;
  }
  // Move just enough that the field clears the save row. Centering leaves
  // the bottom of a field under the sticky bar when the page cannot scroll
  // far enough to put that field in the middle.
  const delta = rect.bottom > limit ? rect.bottom - limit : rect.top - viewTop;
  const scroller = document.scrollingElement;
  if (scroller) {
    scroller.scrollTop += delta;
    return;
  }
  window.scrollBy({ top: delta, left: 0, behavior: "auto" });
}

export function watchWriteDeskFields(): () => void {
  function relevant(target: EventTarget | null): HTMLElement | null {
    if (!(target instanceof HTMLElement)) {
      return null;
    }
    if (!target.closest(".write-desk")) {
      return null;
    }
    if (!target.matches("input, textarea, select")) {
      return null;
    }
    return target;
  }

  function onFocusIn(event: Event) {
    const target = relevant(event.target);
    if (!target) {
      return;
    }
    keepFocusedFieldVisible(target);
    window.setTimeout(() => keepFocusedFieldVisible(target), 320);
  }

  function onResize() {
    const target = relevant(document.activeElement);
    if (!target) {
      return;
    }
    keepFocusedFieldVisible(target);
  }

  document.addEventListener("focusin", onFocusIn);
  window.visualViewport?.addEventListener("resize", onResize);
  return () => {
    document.removeEventListener("focusin", onFocusIn);
    window.visualViewport?.removeEventListener("resize", onResize);
  };
}

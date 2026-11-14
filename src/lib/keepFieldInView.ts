export function fieldIsCovered(target: HTMLElement): boolean {
  const rect = target.getBoundingClientRect();
  if (rect.width === 0 && rect.height === 0) {
    return false;
  }
  const view = window.visualViewport;
  const viewTop = view?.offsetTop ?? 0;
  const viewBottom = viewTop + (view?.height ?? window.innerHeight);
  const dock = document.querySelector(".book-dock");
  const dockTop =
    dock instanceof HTMLElement ? dock.getBoundingClientRect().top : viewBottom;
  let limit = Math.min(dockTop, viewBottom);
  const bar = document.querySelector(".write-desk-savebar");
  if (bar instanceof HTMLElement) {
    const barTop = bar.getBoundingClientRect().top;
    if (barTop > rect.top && barTop < limit) {
      limit = barTop;
    }
  }
  return rect.top < viewTop + 8 || rect.bottom > limit - 8;
}

export function keepFocusedFieldVisible(target: HTMLElement): void {
  if (!fieldIsCovered(target)) {
    return;
  }
  target.scrollIntoView({ block: "center", inline: "nearest" });
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

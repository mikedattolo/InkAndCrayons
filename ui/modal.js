/**
 * ui/modal.js — Accessible modal utility
 *
 * Features:
 *   - role="dialog", aria-modal="true", aria-labelledby
 *   - Focus trap while open (Tab / Shift+Tab cycle)
 *   - ESC closes modal
 *   - Backdrop click closes modal
 *   - Returns focus to the triggering element on close
 */

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function createModal({ modalEl, titleEl, descriptionEl, bodyEl, onClose }) {
  let triggerEl = null; // element that opened the modal

  /* ── ARIA setup ─────────────────────────── */
  modalEl.setAttribute("role", "dialog");
  modalEl.setAttribute("aria-modal", "true");
  if (titleEl?.id) {
    modalEl.setAttribute("aria-labelledby", titleEl.id);
  }

  /* ── Open / Close ───────────────────────── */
  function setOpen(isOpen) {
    modalEl.setAttribute("aria-hidden", String(!isOpen));
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
  }

  function clearBody() {
    while (bodyEl.firstChild) {
      bodyEl.removeChild(bodyEl.firstChild);
    }
  }

  function open({ title, description, contentNodes }) {
    triggerEl = document.activeElement; // remember who opened us
    titleEl.textContent = title || "";
    descriptionEl.textContent = description || "";
    clearBody();
    contentNodes.forEach((node) => bodyEl.appendChild(node));
    setOpen(true);
    // Move focus into the modal
    requestAnimationFrame(() => {
      const first = modalEl.querySelector(FOCUSABLE);
      if (first) first.focus();
    });
  }

  function close() {
    setOpen(false);
    if (onClose) onClose();
    // Return focus to triggering element
    if (triggerEl && typeof triggerEl.focus === "function") {
      triggerEl.focus();
    }
    triggerEl = null;
  }

  /* ── Click handler (close button + backdrop) ── */
  modalEl.addEventListener("click", (event) => {
    const action = event.target.getAttribute("data-action");
    if (action === "close") {
      close();
    }
  });

  /* ── ESC to close ──────────────────────── */
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && modalEl.getAttribute("aria-hidden") === "false") {
      close();
    }
  });

  /* ── Focus trap ────────────────────────── */
  modalEl.addEventListener("keydown", (event) => {
    if (event.key !== "Tab") return;
    if (modalEl.getAttribute("aria-hidden") === "true") return;

    const focusable = Array.from(modalEl.querySelectorAll(FOCUSABLE));
    if (focusable.length === 0) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (event.shiftKey) {
      // Shift+Tab: wrap from first → last
      if (document.activeElement === first) {
        event.preventDefault();
        last.focus();
      }
    } else {
      // Tab: wrap from last → first
      if (document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
  });

  return { open, close, setOpen };
}

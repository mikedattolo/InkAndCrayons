export function createModal({ modalEl, titleEl, descriptionEl, bodyEl, onClose }) {
  function setOpen(isOpen) {
    modalEl.setAttribute("aria-hidden", String(!isOpen));
  }

  function clearBody() {
    while (bodyEl.firstChild) {
      bodyEl.removeChild(bodyEl.firstChild);
    }
  }

  function open({ title, description, contentNodes }) {
    titleEl.textContent = title || "";
    descriptionEl.textContent = description || "";
    clearBody();
    contentNodes.forEach((node) => bodyEl.appendChild(node));
    setOpen(true);
  }

  function close() {
    setOpen(false);
    if (onClose) onClose();
  }

  modalEl.addEventListener("click", (event) => {
    const action = event.target.getAttribute("data-action");
    if (action === "close") {
      close();
    }
  });

  return { open, close, setOpen };
}

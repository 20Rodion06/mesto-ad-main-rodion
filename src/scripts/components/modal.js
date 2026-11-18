let lastFocusedElement = null;

const onEscape = (event) => {
  if (event.key === "Escape") {
    const openedModal = document.querySelector(".popup_is-opened");
    if (openedModal) closeModalWindow(openedModal);
  }
};

export const openModalWindow = (modalWindow) => {
  const previous = document.querySelector(".popup_is-opened");
  if (previous) closeModalWindow(previous);
  lastFocusedElement = document.activeElement;
  modalWindow.classList.add("popup_is-opened");
  document.body.style.overflow = "hidden";
  document.addEventListener("keydown", onEscape);
  const firstFocusable = modalWindow.querySelector(".popup__input, .popup__close, .popup__button");
  firstFocusable?.focus({ preventScroll: true });
};

export const closeModalWindow = (modalWindow) => {
  if (!modalWindow) return;
  modalWindow.classList.remove("popup_is-opened");
  document.body.style.overflow = "";
  document.removeEventListener("keydown", onEscape);
  if (lastFocusedElement?.isConnected) lastFocusedElement.focus({ preventScroll: true });
  lastFocusedElement = null;
};

export const setCloseModalWindowEventListeners = (modalWindow) => {
  modalWindow.querySelector(".popup__close").addEventListener("click", () => closeModalWindow(modalWindow));
  modalWindow.addEventListener("mousedown", (event) => {
    if (event.target === modalWindow) closeModalWindow(modalWindow);
  });
};

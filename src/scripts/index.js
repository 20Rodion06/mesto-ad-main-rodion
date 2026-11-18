import "../pages/index.css";

import { createCardElement, deleteCard, updateLikeView } from "./components/card.js";
import { openModalWindow, closeModalWindow, setCloseModalWindowEventListeners } from "./components/modal.js";
import { enableValidation, clearValidation } from "./components/validation.js";
import {
  addNewCard, changeLikeCardStatus, getCardList, getUserInfo, removeCard,
  setUserAvatar, setUserInfo, enableDemoMode, isDemoMode,
} from "./components/api.js";

const validationSettings = {
  formSelector: ".popup__form",
  inputSelector: ".popup__input",
  submitButtonSelector: ".popup__button",
  inactiveButtonClass: "popup__button_disabled",
  inputErrorClass: "popup__input_type_error",
  errorClass: "-error",
  errorVisibleClass: "popup__error_visible",
};

const $ = (selector, context = document) => context.querySelector(selector);
const placesWrap = $(".places__list");
const placesCount = $(".places__count");
const placesEmpty = $(".places__empty");
const placesSearch = $(".places__search");
const filterButtons = Array.from(document.querySelectorAll(".places__filter"));
const notice = $(".page__notice");

const profileModal = $(".popup_type_edit");
const profileForm = $(".popup__form", profileModal);
const profileTitleInput = $(".popup__input_type_name", profileForm);
const profileDescriptionInput = $(".popup__input_type_description", profileForm);

const cardModal = $(".popup_type_new-card");
const cardForm = $(".popup__form", cardModal);
const cardNameInput = $(".popup__input_type_card-name", cardForm);
const cardLinkInput = $(".popup__input_type_url", cardForm);

const imageModal = $(".popup_type_image");
const imageElement = $(".popup__image", imageModal);
const imageCaption = $(".popup__caption", imageModal);

const avatarModal = $(".popup_type_edit-avatar");
const avatarForm = $(".popup__form", avatarModal);
const avatarInput = $(".popup__input_type_avatar", avatarForm);

const removeModal = $(".popup_type_remove-card");
const removeForm = $(".popup__form", removeModal);

const infoModal = $(".popup_type_info");
const infoTitle = $(".popup__title", infoModal);
const infoRows = $(".popup__info", infoModal);
const infoLikedTitle = $(".popup__text", infoModal);
const infoLikedList = $(".popup__list", infoModal);

const profileTitle = $(".profile__title");
const profileDescription = $(".profile__description");
const profileAvatar = $(".profile__image");

let currentUserId = "";
let cardToDelete = null;
let activeFilter = "all";
const cardDataById = new Map();
let noticeTimeout;

const showNotice = (message) => {
  notice.textContent = message;
  notice.hidden = false;
  window.clearTimeout(noticeTimeout);
  noticeTimeout = window.setTimeout(() => { notice.hidden = true; }, 5000);
};

const setLoading = (form, isLoading, message) => {
  const button = $(".popup__button", form);
  if (!button.dataset.defaultLabel) button.dataset.defaultLabel = button.textContent.trim();
  button.textContent = isLoading ? message : button.dataset.defaultLabel;
  button.disabled = isLoading;
  if (!isLoading) clearValidation(form, validationSettings);
};

const saveForm = (form, loadingText, request, onSuccess) => {
  setLoading(form, true, loadingText);
  request()
    .then(onSuccess)
    .catch((error) => {
      console.error(error);
      showNotice("Не удалось сохранить изменения. Проверьте соединение и повторите попытку.");
    })
    .finally(() => setLoading(form, false, loadingText));
};

const renderUserInfo = ({ name, about, avatar, _id }) => {
  profileTitle.textContent = name || "Путешественник";
  profileDescription.textContent = about || "Моя коллекция мест";
  if (avatar) profileAvatar.style.backgroundImage = `url(${JSON.stringify(avatar)}), url('./src/images/avatar.jpg')`;
  if (_id) currentUserId = _id;
};

const renderCollection = () => {
  const search = placesSearch.value.trim().toLocaleLowerCase("ru");
  const cards = Array.from(placesWrap.children);
  let visible = 0;
  cards.forEach((card) => {
    const matchesSearch = card.dataset.name.includes(search);
    const matchesFilter = activeFilter === "all" ||
      (activeFilter === "mine" && card.dataset.ownerId === currentUserId) ||
      (activeFilter === "liked" && card.dataset.liked === "true");
    card.hidden = !(matchesSearch && matchesFilter);
    if (!card.hidden) visible++;
  });
  placesCount.textContent = String(cards.length).padStart(2, "0");
  placesEmpty.hidden = visible !== 0;
  placesEmpty.textContent = cards.length === 0
    ? "Пока нет карточек. Добавьте первое место кнопкой выше."
    : "По этому запросу мест не найдено. Попробуйте другой фильтр.";
};

const formatDate = (value) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Не указана"
    : date.toLocaleDateString("ru-RU", { year: "numeric", month: "long", day: "numeric" });
};

const createInfoRow = (term, value) => {
  const row = $(".popup__info-item", $("#popup-info-definition-template").content).cloneNode(true);
  $(".popup__info-term", row).textContent = term;
  $(".popup__info-description", row).textContent = String(value);
  return row;
};
const createUserBadge = (name) => {
  const badge = $(".popup__list-item", $("#popup-info-user-preview-template").content).cloneNode(true);
  badge.textContent = name;
  return badge;
};

const previewImage = ({ name, link }) => {
  imageElement.src = link;
  imageElement.alt = `Фотография места «${name}»`;
  imageCaption.textContent = name;
  openModalWindow(imageModal);
};

const handleLike = (cardId, isLiked, cardElement) => {
  changeLikeCardStatus(cardId, isLiked)
    .then((updated) => {
      cardDataById.set(cardId, updated);
      updateLikeView(cardElement, updated.likes, currentUserId);
      renderCollection();
    })
    .catch((error) => { console.error(error); showNotice("Не удалось обновить лайк."); });
};

const confirmDelete = (cardId, cardElement) => {
  cardToDelete = { id: cardId, element: cardElement };
  openModalWindow(removeModal);
};

const showInfo = (cardId) => {
  const cardData = cardDataById.get(cardId);
  if (!cardData) return;
  infoTitle.textContent = cardData.name;
  infoRows.replaceChildren(
    createInfoRow("Автор", cardData.owner?.name || "Неизвестен"),
    createInfoRow("Добавлено", formatDate(cardData.createdAt)),
    createInfoRow("Лайков", (cardData.likes || []).length)
  );
  const likes = cardData.likes || [];
  infoLikedTitle.textContent = "Понравилось пользователям:";
  infoLikedList.replaceChildren(...(likes.length
    ? likes.map((user) => createUserBadge(user.name || "Пользователь"))
    : [createUserBadge("Пока никто не оценил")]));
  openModalWindow(infoModal);
};

const createCard = (data) => {
  cardDataById.set(data._id, data);
  return createCardElement(data, currentUserId, {
    onPreviewPicture: previewImage,
    onLikeIcon: handleLike,
    onDeleteCard: confirmDelete,
    onInfoClick: showInfo,
  });
};

profileForm.addEventListener("submit", (event) => {
  event.preventDefault();
  saveForm(profileForm, "Сохраняем...", () => setUserInfo({
    name: profileTitleInput.value.trim(), about: profileDescriptionInput.value.trim(),
  }), (user) => {
    renderUserInfo(user);
    closeModalWindow(profileModal);
    for (const card of placesWrap.children) if (card.dataset.ownerId === currentUserId) {
      const data = cardDataById.get(card.dataset.cardId);
      if (data) data.owner.name = user.name;
    }
    showNotice("Профиль обновлён");
  });
});

avatarForm.addEventListener("submit", (event) => {
  event.preventDefault();
  saveForm(avatarForm, "Обновляем...", () => setUserAvatar({ avatar: avatarInput.value.trim() }), (user) => {
    renderUserInfo(user);
    closeModalWindow(avatarModal);
    showNotice("Фотография обновлена");
  });
});

cardForm.addEventListener("submit", (event) => {
  event.preventDefault();
  saveForm(cardForm, "Добавляем...", () => addNewCard({
    name: cardNameInput.value.trim(), link: cardLinkInput.value.trim(),
  }), (card) => {
    placesWrap.prepend(createCard(card));
    closeModalWindow(cardModal);
    cardForm.reset();
    activeFilter = "all";
    filterButtons.forEach((button) => {
      const pressed = button.dataset.filter === "all";
      button.classList.toggle("places__filter_is-active", pressed);
      button.setAttribute("aria-pressed", String(pressed));
    });
    placesSearch.value = "";
    renderCollection();
    showNotice("Новое место добавлено");
  });
});

removeForm.addEventListener("submit", (event) => {
  event.preventDefault();
  if (!cardToDelete) return;
  const { id, element } = cardToDelete;
  saveForm(removeForm, "Удаляем...", () => removeCard(id), () => {
    deleteCard(element);
    cardDataById.delete(id);
    cardToDelete = null;
    closeModalWindow(removeModal);
    renderCollection();
    showNotice("Карточка удалена");
  });
});

$(".profile__edit-button").addEventListener("click", () => {
  profileTitleInput.value = profileTitle.textContent;
  profileDescriptionInput.value = profileDescription.textContent;
  clearValidation(profileForm, validationSettings);
  openModalWindow(profileModal);
});
const openAvatarEditor = () => {
  avatarForm.reset();
  clearValidation(avatarForm, validationSettings);
  openModalWindow(avatarModal);
};
profileAvatar.addEventListener("click", openAvatarEditor);
profileAvatar.addEventListener("keydown", (event) => {
  if (event.key === "Enter" || event.key === " ") { event.preventDefault(); openAvatarEditor(); }
});
$(".profile__add-button").addEventListener("click", () => {
  cardForm.reset();
  clearValidation(cardForm, validationSettings);
  openModalWindow(cardModal);
});

placesSearch.addEventListener("input", renderCollection);
filterButtons.forEach((button) => button.addEventListener("click", () => {
  activeFilter = button.dataset.filter;
  filterButtons.forEach((item) => {
    const pressed = item === button;
    item.classList.toggle("places__filter_is-active", pressed);
    item.setAttribute("aria-pressed", String(pressed));
  });
  renderCollection();
}));

enableValidation(validationSettings);
document.querySelectorAll(".popup").forEach((popup) => {
  popup.classList.add("popup_is-animated");
  setCloseModalWindowEventListeners(popup);
});

if (new URLSearchParams(window.location.search).get("demo") === "1") {
  enableDemoMode();
}
const loadCollection = () => Promise.all([getCardList(), getUserInfo()]);
loadCollection()
  .then(([cards, user]) => {
    renderUserInfo(user);
    placesWrap.replaceChildren(...cards.map(createCard));
    renderCollection();
    if (isDemoMode()) {
      document.documentElement.dataset.mode = "demo";
    } else {
      document.documentElement.dataset.mode = "supabase";
      if (cards.length === 0) showNotice("Supabase подключён. База пока пустая — добавьте первое место.");
    }
  })
  .catch((error) => {
    console.error("Не удалось загрузить коллекцию:", error);
    showNotice("Не удалось подключиться к Supabase. Подробности — в консоли (F12). Для автономной проверки откройте ?demo=1.");
    renderCollection();
  });

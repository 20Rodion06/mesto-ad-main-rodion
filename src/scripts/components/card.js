const getTemplate = () => document.querySelector("#card-template").content.querySelector(".card").cloneNode(true);

export const deleteCard = (cardElement) => { cardElement.remove(); };

export const updateLikeView = (cardElement, likes, currentUserId) => {
  const isLiked = likes.some((user) => user._id === currentUserId);
  const button = cardElement.querySelector(".card__like-button");
  button.classList.toggle("card__like-button_is-active", isLiked);
  button.setAttribute("aria-pressed", String(isLiked));
  button.setAttribute("aria-label", isLiked ? "Убрать из избранного" : "Добавить в избранное");
  cardElement.querySelector(".card__like-count").textContent = likes.length;
  cardElement.dataset.liked = String(isLiked);
};

export const createCardElement = (
  data,
  currentUserId,
  { onPreviewPicture, onLikeIcon, onDeleteCard, onInfoClick }
) => {
  const card = getTemplate();
  const image = card.querySelector(".card__image");
  const title = card.querySelector(".card__title");
  const likeButton = card.querySelector(".card__like-button");
  const deleteButton = card.querySelector(".card__control-button_type_delete");
  const infoButton = card.querySelector(".card__control-button_type_info");

  image.src = data.link;
  image.alt = `Фотография места «${data.name}»`;
  title.textContent = data.name;
  card.dataset.cardId = data._id;
  card.dataset.ownerId = data.owner._id;
  card.dataset.name = data.name.toLocaleLowerCase("ru");
  updateLikeView(card, data.likes || [], currentUserId);

  // Только автор карточки может её удалить.
  if (data.owner._id === currentUserId) {
    deleteButton.addEventListener("click", () => onDeleteCard(data._id, card));
  } else {
    deleteButton.remove();
  }

  likeButton.addEventListener("click", () => {
    const isLiked = likeButton.classList.contains("card__like-button_is-active");
    onLikeIcon(data._id, isLiked, card);
  });
  infoButton.addEventListener("click", () => onInfoClick(data._id));
  image.addEventListener("click", () => onPreviewPicture({ name: data.name, link: data.link }));
  image.addEventListener("error", () => {
    if (image.dataset.fallback) return;
    image.dataset.fallback = "true";
    image.src = 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600"><rect width="800" height="600" fill="#dce9df"/><path d="M0 470L210 250L350 390L540 190L800 500V600H0" fill="#84ab97"/><circle cx="615" cy="138" r="70" fill="#f5e2b4"/></svg>'
    );
  });
  return card;
};

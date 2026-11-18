const namePattern = /^[a-zA-Zа-яА-ЯёЁ\s-]+$/;
const nameErrorMessage = "Допустимы только буквы, пробелы и дефис";

const findErrorElement = (form, input, config) => form.querySelector(`.${input.id}${config.errorClass}`);

export const showInputError = (form, input, message, config) => {
  const error = findErrorElement(form, input, config);
  if (!error) return;
  input.classList.add(config.inputErrorClass);
  error.textContent = message;
  error.classList.add(config.errorVisibleClass);
};

export const hideInputError = (form, input, config) => {
  const error = findErrorElement(form, input, config);
  if (!error) return;
  input.classList.remove(config.inputErrorClass);
  error.textContent = "";
  error.classList.remove(config.errorVisibleClass);
};

export const checkInputValidity = (form, input, config) => {
  const validateLetters = input.classList.contains("popup__input_type_name") ||
    input.classList.contains("popup__input_type_card-name");
  input.setCustomValidity(validateLetters && input.value.length && !namePattern.test(input.value)
    ? nameErrorMessage : "");
  if (input.validity.valid) hideInputError(form, input, config);
  else showInputError(form, input, input.validationMessage, config);
};

export const hasInvalidInput = (inputs) => inputs.some((input) => !input.validity.valid);

export const disableSubmitButton = (button, config) => {
  button.disabled = true;
  button.classList.add(config.inactiveButtonClass);
};
export const enableSubmitButton = (button, config) => {
  button.disabled = false;
  button.classList.remove(config.inactiveButtonClass);
};
export const toggleButtonState = (inputs, button, config) => {
  if (hasInvalidInput(inputs)) disableSubmitButton(button, config);
  else enableSubmitButton(button, config);
};

export const setEventListeners = (form, config) => {
  const inputs = Array.from(form.querySelectorAll(config.inputSelector));
  const button = form.querySelector(config.submitButtonSelector);
  toggleButtonState(inputs, button, config);
  inputs.forEach((input) => input.addEventListener("input", () => {
    checkInputValidity(form, input, config);
    toggleButtonState(inputs, button, config);
  }));
};

export const clearValidation = (form, config) => {
  const inputs = Array.from(form.querySelectorAll(config.inputSelector));
  const button = form.querySelector(config.submitButtonSelector);
  inputs.forEach((input) => {
    input.setCustomValidity("");
    hideInputError(form, input, config);
  });
  toggleButtonState(inputs, button, config);
};

export const enableValidation = (config) => document.querySelectorAll(config.formSelector).forEach((form) => {
  form.noValidate = true;
  setEventListeners(form, config);
});

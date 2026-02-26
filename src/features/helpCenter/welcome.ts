export const SHOW_WELCOME_MODAL_EVENT = 'help:center:show-welcome';

export const requestShowWelcomeModal = (): void => {
  window.dispatchEvent(new CustomEvent(SHOW_WELCOME_MODAL_EVENT));
};

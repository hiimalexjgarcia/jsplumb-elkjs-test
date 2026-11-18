/// <reference types="vite/client" />

declare module 'bootstrap/js/dist/modal' {
  export default class Modal {
    static getOrCreateInstance(element: Element): Modal
    show(): void
  }
}

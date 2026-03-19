// Global type declarations for .ui.ts component files
// Actual imports are injected by framework/plugin.ts at build time

/** Tagged template for CSS strings. Enables IDE CSS highlighting */
declare function css(strings: TemplateStringsArray, ...values: unknown[]): string;

/** Tagged template for HTML strings. Compiled to DOM operations at build time */
declare function html(strings: TemplateStringsArray, ...values: unknown[]): HTMLElement;

/** Reactive signal. Auto-imported in .ui.ts files */
declare function signal<T>(initial: T): import("./signal").Signal<T>;

/** Base class for components. Auto-imported in .ui.ts files */
declare const BaseComponent: typeof import("./base").BaseComponent;

/** Shared reactive store factory. Auto-imported in .ui.ts files */
declare function store<T extends Record<string, unknown>>(init: T): import("./store").Store<T>;

declare const __UINSPY_VERSION__: string;
declare const __UINSPY_BUILD_TIME__: string;
declare const __UINSPY_SCREENSAVER__: boolean;
declare const __UINSPY_TITLE__: string;
declare const __UINSPY_LOGO__: string;

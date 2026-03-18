// Global type declarations for .ui.ts component files
// Actual imports are injected by framework/plugin.ts at build time

/** Tagged template for CSS strings. Enables IDE CSS highlighting */
declare function css(strings: TemplateStringsArray, ...values: unknown[]): string;

/** Reactive signal. Auto-imported in .ui.ts files */
declare function signal<T>(initial: T): import("./signal").Signal<T>;

/** Base class for components. Auto-imported in .ui.ts files */
declare const BaseComponent: typeof import("./base").BaseComponent;

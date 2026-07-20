// Minimal declaration so TypeScript modules (the paid-features gate) can
// import the JS Pinia store. The store stays JS per the gradual-TS plan;
// consumers get an untyped handle rather than per-field typings.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export declare function useMainStore(): any

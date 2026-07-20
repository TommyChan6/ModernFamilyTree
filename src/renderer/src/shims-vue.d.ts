// Lets TypeScript modules import .vue single-file components (the paid gate
// module does). Vite/vue-loader provide the real types at build time.
declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const component: DefineComponent<Record<string, any>, Record<string, any>, any>
  export default component
}

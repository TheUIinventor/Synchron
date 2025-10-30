// Minimal ambient module to satisfy TypeScript when cheerio types are not installed locally
declare module 'cheerio' {
  const anyExport: any
  export = anyExport
}

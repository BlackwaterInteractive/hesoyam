export function getURL() {
  let url =
    process.env.NEXT_PUBLIC_SITE_URL ??
    process.env.NEXT_PUBLIC_VERCEL_URL ??
    'http://localhost:3000'

  // Ensure protocol prefix
  url = url.startsWith('http') ? url : `https://${url}`
  // Ensure trailing slash
  url = url.endsWith('/') ? url : `${url}/`

  return url
}

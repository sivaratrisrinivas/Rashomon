// Full page navigation, so middleware sees the fresh session cookies. Kept in its own module so tests can stub it.
export const navigate = (url: string) => window.location.assign(url)

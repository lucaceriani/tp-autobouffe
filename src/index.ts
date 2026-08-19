import { getMenu } from './menu'
import { Env } from './types'
import tlcQrPng from './assets/tlc-twint.png'
import tlcTwintHtml from './assets/tlc-twint.html'

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))

const renderSection = (emoji: string, title: string, text: string) => {
  const content = text
    .split('\n')
    .map(l => l.trim())
    .filter(Boolean)
    .map(l => (l.startsWith('- ') ? `<li>${escapeHtml(l.slice(2))}</li>` : `<p>${escapeHtml(l)}</p>`))
    .join('\n')

  return `<section>
    <h2>${emoji} ${escapeHtml(title)}</h2>
    <ul>${content}</ul>
  </section>`
}

const renderMenuPage = (menu: Awaited<ReturnType<typeof getMenu>>) => {
  const today = new Date().toLocaleDateString('fr-CH', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'Europe/Zurich',
  })

  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Autobouffe 🍽️</title>
<style>
  :root { color-scheme: light dark; }
  body {
    font-family: system-ui, sans-serif;
    max-width: 42rem;
    margin: 2rem auto;
    padding: 0 1rem;
    line-height: 1.5;
  }
  header h1 { margin-bottom: 0; }
  header p { margin-top: 0.25rem; opacity: 0.7; text-transform: capitalize; }
  section {
    border: 1px solid light-dark(#ddd, #444);
    border-radius: 0.75rem;
    padding: 0.25rem 1.25rem 0.75rem;
    margin: 1rem 0;
  }
  h2 { font-size: 1.1rem; }
  ul { padding-left: 1.25rem; margin: 0.5rem 0; }
  li { margin: 0.25rem 0; }
  ul p { margin: 0.25rem 0 0.25rem -1.25rem; }
  .banner {
    background: light-dark(#fff3cd, #4d3d00);
    border-radius: 0.75rem;
    padding: 0.75rem 1.25rem;
    text-align: center;
    font-weight: bold;
  }
</style>
</head>
<body>
<header>
  <h1>Autobouffe 🍽️</h1>
  <p>${escapeHtml(today)}</p>
</header>
${menu.school_holiday ? `<div class="banner">${escapeHtml(menu.school_holiday)}</div>` : ''}
${renderSection('🥘', 'Quai 14', menu.quai14)}
${renderSection('🚚', 'Food Trucks', menu.food_trucks)}
${renderSection('🎭', 'Arsenic', menu.arsenic)}
${renderSection('🥡', 'The Lunch Club', menu.the_lunch_club)}
</body>
</html>`
}

export default {
  async fetch(request: Request, env: Env, ctx: EventContext<Env, string, any>) {
    const url = new URL(request.url)

    if (env.WORKER_ENV === 'dev' && url.pathname === '/') {
      return new Response(renderMenuPage(await getMenu(env)), {
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      })
    }

    if (url.pathname === '/tlc-twint') {
      return new Response(tlcTwintHtml, {
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      })
    }

    if (url.pathname === '/assets/tlc-twint.png') {
      return new Response(tlcQrPng, {
        headers: {
          'Content-Type': 'image/png',
          'Cache-Control': 'public, max-age=86400',
        },
      })
    }

    return new Response('', { status: 404 })
  },

  async scheduled(event: ScheduledEvent, env: Env, ctx: EventContext<Env, string, any>) {
    // we are called every day every hour, we have to check that it's 9:00 in Zurich (UTC+1 / UTC+2)
    // getHours always return the 24h time
    const h = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Zurich' })).getHours()

    if (h === 9) {
      ctx.waitUntil(
        fetch(env.WEBHOOK_URL, {
          method: 'POST',
          body: JSON.stringify(await getMenu(env)),
          headers: { 'Content-Type': 'application/json' },
        })
      )
    }
  },
}

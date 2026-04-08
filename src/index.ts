import { getMenu } from './menu'
import { Env } from './types'
import tlcQrPng from './assets/tlc-twint.png'
import tlcTwintHtml from './assets/tlc-twint.html'

export default {
  async fetch(request: Request, env: Env, ctx: EventContext<Env, string, any>) {
    const url = new URL(request.url)

    if (env.WORKER_ENV === 'dev' && url.pathname === '/') {
      return new Response(JSON.stringify(await getMenu()))
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
          body: JSON.stringify(await getMenu()),
          headers: { 'Content-Type': 'application/json' },
        })
      )
    }
  },
}

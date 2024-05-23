import { getMenu } from './menu'
import { Env } from './types'

export default {
  async fetch(request: Request, env: Env, ctx: EventContext<Env, string, any>) {
    if (env.WORKER_ENV === 'dev' && new URL(request.url).pathname === '/') {
      return new Response(JSON.stringify(await getMenu()))
    } else {
      return new Response('', { status: 404 })
    }
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

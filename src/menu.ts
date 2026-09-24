import { load as CheerioLoad } from 'cheerio'
import { Env } from './types'

const UA = 'tp-autobouffe/1.0 (+https://github.com/lucaceriani/tp-autobouffe; tp-autobouffe@luca.gg)'

const ERROR_MSG = "J'arrive pas à récupérer le menu, désolé 🤷 je ferai mieux demain 💤"

export const getMenu = async (env: Env) => {
  const [quai14, food_trucks, arsenic, the_lunch_club, school_holiday] = (
    await Promise.allSettled([getQuai14(), getFoodTrucks(), getArsenic(env), getTheLunchClub(), getSchoolHoliday()])
  ).map(p => (p.status === 'fulfilled' ? p.value : ERROR_MSG))

  return { quai14, food_trucks, arsenic, the_lunch_club, school_holiday }
}

async function getTheLunchClub() {
  const html = await getHtml('https://thelunchclub.ch/a/loop_subscriptions/bundle/cdce97a61ed74f998f7c749a8393f399')
  if (!html) return ERROR_MSG

  const dayOfWeek = new Date().getDay() // 1=monday, 7=sunday

  if (dayOfWeek === 1) {
    return "Les commandes arrivent aujourd'hui 🎉"
  }

  if (dayOfWeek >= 5) {
    return 'À la semaine prochaine ! 👋\n'
  }

  const $ = CheerioLoad(html)

  const nextData = JSON.parse($('#__NEXT_DATA__').html() || '{}')

  const products = nextData?.props?.pageProps?.bundle?.products as { productTitle: string }[] | undefined
  if (!products || products.length === 0) return ERROR_MSG

  const todaysDishes = products.map(p => '- ' + p.productTitle)

  if (dayOfWeek === 4) {
    todaysDishes.unshift("⚠️ Dernier jour pour commander, aujourd'hui jusqu'à 21:00 ⚠️\n")
  }

  return todaysDishes.join('\n')
}

async function getQuai14() {
  const html = await getHtml('https://accueil.emploilausanne.ch/menu-de-la-semaine/menu-de-la-semaine/')
  if (!html) return ERROR_MSG

  const $ = CheerioLoad(html)

  const dayOfWeek = new Date().getDay() - 1
  const todaysDish = $('.plat-du-jour')[dayOfWeek]
  if (!todaysDish) return ERROR_MSG

  return $(todaysDish)
    .find('p')
    .not('.provenance, :contains(CHF)')
    .toArray()
    .map(dish => '- ' + $(dish).text().trim())
    .join('\n')
}

async function getFoodTrucks() {
  const html = await getHtml(
    'https://web.archive.org/web/https://www.lausanne.ch/vie-pratique/economie-et-commerces/marches-et-commerce-itinerant/food-trucks/food-trucks-sevelin.html'
  )
  if (!html) return ERROR_MSG

  const dayOfWeek = new Date().getDay() - 1

  const $ = CheerioLoad(html)
  return $('article .texte-image.encadre, article h2')
    .toArray()
    .reduce((acc, el) => {
      if (el.tagName.toUpperCase() == 'H2') {
        acc.push([]) // new day of the week
      } else {
        const name = $(el).find('h4').first().text().trim()
        const menu = $(el).find('p').first().text().trim()
        acc[acc.length - 1].push(`- ${name.trim()} (${menu.trim().toLowerCase().replace(' (', ', ').replace(')', '')})`)
      }
      return acc
    }, [] as string[][])
    .map(trucks => trucks.join('\n'))[dayOfWeek]
}

async function getArsenic(env: Env) {
  const html = await getHtml('https://arsenic.ch/cafe-restaurant/')
  if (!html) return ERROR_MSG

  const day = new Date().getDate().toString().padStart(2, '0')
  const month = (new Date().getMonth() + 1).toString().padStart(2, '0')
  const weekDayFr = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'][new Date().getDay()]
  const monthFr = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'][
    new Date().getMonth()
  ]

  const $ = CheerioLoad(html)
  const pageText = $('.page-text').text().trim()
  if (!pageText) return ERROR_MSG

  const result = await env.AI.run('@cf/meta/llama-3.1-8b-instruct-fp8-fast', {
    messages: [
      {
        role: 'system',
        content: [
          'You extract the dish of the day from the text of a restaurant web page written in French.',
          'The page lists one dish per weekday. The entry format changes often, for example:',
          '- "LUNDI 17.08 : Risotto au citron" (date with or without zero-padding: 17.8, 17.08, 5.4, 05.04)',
          '- "lun 17 août : Risotto au citron" (weekday and month possibly abbreviated: lun, mar, mer, jeu, ven / aoû, sep, ...)',
          '- "Lundi : Risotto au citron" (weekday name only, no date)',
          'The entries may be glued together without spaces or line breaks: a dish description ends where the next weekday name begins.',
          "Reply with ONLY the dish description for the requested day, copied verbatim from the page, in French, without the weekday name, the date, the colon, or any other text.",
          'If you cannot find a dish for the requested day, reply exactly: NOT_FOUND',
        ].join('\n'),
      },
      {
        role: 'user',
        content: `Requested day: ${weekDayFr} ${day}.${month} (${weekDayFr} ${Number(day)} ${monthFr})\n\nPage text:\n${pageText}`,
      },
    ],
    temperature: 0,
  })

  const dish = typeof result.response === 'string' ? result.response.trim() : ''
  if (!dish || dish.includes('NOT_FOUND')) return ERROR_MSG

  return '- ' + dish.charAt(0).toUpperCase() + dish.slice(1)
}

async function getSchoolHoliday() {
  const todayIso = new Date().toISOString().slice(0, 10)
  const res = (await getJson(
    `https://openholidaysapi.org/SchoolHolidays?countryIsoCode=CH&subdivisionCode=CH-VD&languageIsoCode=FR&validFrom=${todayIso}&validTo=${todayIso}`
  )) as unknown[] | null

  if (!res || res.length === 0) return ''
  return '⚠️ Vacances scolaires ⚠️'
}

const getHtml = async (url: string) => {
  try {
    return await fetch(url, { headers: { 'User-Agent': UA } }).then(r => r.text())
  } catch (error) {
    console.error(`Error fetching ${url}`, error)
    return null
  }
}

const getJson = async (url: string) => {
  try {
    return await fetch(url, { headers: { 'User-Agent': UA } }).then(r => r.json())
  } catch (error) {
    console.error(`Error fetching ${url}`, error)
    return null
  }
}

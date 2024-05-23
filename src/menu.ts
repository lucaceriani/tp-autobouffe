import { load as CheerioLoad } from 'cheerio'

const UA = 'Mozilla/5.0'
const ERROR_MSG = "J'arrive pas à récupérer le menu, désolé 😢. J'essaierai mieux demain ..."

export const getMenu = async () => {
  const [quai14, food_trucks, arsenic, school_holiday] = (
    await Promise.allSettled([getQuai14(), getFoodTrucks(), getArsenic(), getSchoolHoliday()])
  ).map(p => (p.status === 'fulfilled' ? p.value : ERROR_MSG))

  return { quai14, food_trucks, arsenic, school_holiday }
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
    .map(dish => '- ' + $(dish).text())
    .join('\n')
}

async function getFoodTrucks() {
  const html = await getHtml(
    'https://www.lausanne.ch/vie-pratique/economie-et-commerces/marches-et-commerce-itinerant/food-trucks/food-trucks-sevelin.html'
  )
  if (!html) return ERROR_MSG

  const dayOfWeek = new Date().getDay() - 1

  const $ = CheerioLoad(html)
  return $('article .texte-image.encadre, article h2')
    .toArray()
    .reduce((acc, el) => {
      if (el.tagName.toUpperCase() == 'H2') {
        acc.push([])
      } else {
        const [name, menu] = $(el).text().trim().replace(/\n+/g, '\n').split('\n').slice(0, 2)
        acc[acc.length - 1].push(`- ${name.trim()} (${menu.trim().toLowerCase().replace(' (', ', ').replace(')', '')})`)
      }
      return acc
    }, [] as string[][])
    .map(trucks => trucks.join('\n'))[dayOfWeek]
}

async function getArsenic() {
  const html = await getHtml('https://arsenic.ch/cafe-restaurant/')
  if (!html) return ERROR_MSG

  const day = new Date().getDate().toString()
  const month = (new Date().getMonth() + 1).toString()
  const weekDayFr = ['dim', 'lun', 'mar', 'mer', 'jeu', 'ven', 'sam'][new Date().getDay()]
  const monthFr = ['jan', 'fév', 'mar', 'avr', 'mai', 'juin', 'juil', 'aoû', 'sep', 'oct', 'nov', 'déc'][
    new Date().getMonth()
  ]

  const $ = CheerioLoad(html)

  return (
    ($(`.page-text p:contains("MIDI")`).first().next().html() || '')
      .replace('\n', '') // not really necessary
      .replace(/\s*<\s*br\s*\/?>\s*/gi, '\n')
      .split('\n')
      .find(S => {
        const s = S.toLowerCase()
        return (
          // 5.4 or 5.04 or 05.04
          new RegExp(String.raw`\b${day}\.(0?${month})\b`).test(s) ||
          // ven 5 avr
          (s.includes(weekDayFr) && s.includes(monthFr))
        )
      }) || ERROR_MSG
  ).replace(/^.+?:\s*/i, '') // remove everything before the first ':', including the ':'
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
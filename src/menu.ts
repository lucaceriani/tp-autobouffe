import { load as CheerioLoad } from 'cheerio'

const sample = (arr: any[]) => arr[Math.floor(Math.random() * arr.length)]

const UA = [
  'Mozilla/5.0',
  sample([
    'Windows NT 10.0; Win64; x64',
    'Macintosh; Intel Mac OS X 10_15_7',
    'X11; Linux x86_64',
    'iPhone; CPU iPhone OS 14_0 like Mac OS X',
    'iPad; CPU OS 14_0 like Mac OS X',
    'Android 12; Mobile; rv:97.0',
  ]),
  'AppleWebKit/537.36 (KHTML, like Gecko)',
  sample(
    [
      // adding some random versions to avoid being blocked by the server
      'Chrome/105.0.0',
      'Firefox/106.0',
      'Edge/130.0.',
      'SamsungBrowser/16.0',
      'Safari/537.36',
    ].map(b => b + '.' + Math.floor(Math.random() * 1000))
  ),
  'Safari/537.36',
].join(' ')

const ERROR_MSG = "J'arrive pas à récupérer le menu, désolé 🤷 je ferai mieux demain 💤"

export const getMenu = async () => {
  const [quai14, food_trucks, arsenic, alter_start_food, school_holiday] = (
    await Promise.allSettled([getQuai14(), getFoodTrucks(), getArsenic(), getAlterStartFood(), getSchoolHoliday()])
  ).map(p => (p.status === 'fulfilled' ? p.value : ERROR_MSG))

  return { quai14, food_trucks, arsenic, alter_start_food, school_holiday }
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
    (
      $(`.page-text p:contains("MIDI"), .page-text p:contains("MIDI") ~ p`)
        .toArray()
        .map(p => $(p).html())
        .join('') || ''
    )
      .replace('\n', '') // not really necessary
      .replace(/\s*<\s*br\s*\/?>\s*/gi, '\n')
      .split('\n')
      .find(S => {
        const s = S.toLowerCase()
        return (
          // 5.4 or 5.04 or 05.04
          new RegExp(String.raw`\b0?${day}\.0?${month}\b`).test(s) ||
          // ven 5 avr
          (s.includes(weekDayFr) && s.includes(monthFr))
        )
      }) || ERROR_MSG
  ).replace(/^.+?:\s*/i, '') // remove everything before the first ':', including the ':'
}

async function getAlterStartFood() {
  const isMonday = new Date().getDay() === 1
  const isWednesday = new Date().getDay() === 3

  if (isWednesday) return "C'est mercredi, les commandes arrivent à ~12h00 ! 🚚"
  if (!isMonday) return "Oupsi, c'est pas lundi..."

  const html = await getHtml('https://alterstartfood.ch/lunch-box-lausanne/')
  if (!html) return ERROR_MSG

  const $ = CheerioLoad(html)

  const todaysDish = $('.woocommerce-loop-product__title')
  if (!todaysDish) return ERROR_MSG

  const asf = $(todaysDish)
    .toArray()
    .filter(dish => $(dish).text().trim() !== '')
    .map(dish => '- ' + $(dish).text().trim())

  if (asf.length !== 0) {
    asf.push('\nCommandez ici avec le code "tipee10" ➡️ https://alterstartfood.ch/lunch-box-lausanne/')
  }

  return asf.join('\n') || ERROR_MSG
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

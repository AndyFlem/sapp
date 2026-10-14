const { DateTime, Interval } = require("luxon")
const puppeteer = require('puppeteer-extra')
const StealthPlugin = require('puppeteer-extra-plugin-stealth')
puppeteer.use(StealthPlugin())
const fs = require('fs');
const cats=[5,18,19,5]

// const market = 1
const types = ['flow','price']
const markets = [1]//,2,3,4]

const MIN_DELAY = 1000          // ~15 requests/min; tune down only if the server tolerates it
const MAX_CONSECUTIVE_FAILS = 3
const DEFAULT_BLOCK_PAUSE = 30 * 60 // seconds to pause on 403/429 without a Retry-After header
const PERIOD_OFFSET = 11        // periodId = hour index + 11

const CHALLENGE_TIMEOUT = 2 * 60 * 1000 // ms to wait for a challenge to be solved manually

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))

async function fetchJson(page, url) {
  const res = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 })
  const status = res ? res.status() : 0
  const isJson = (res?.headers()['content-type'] || '').includes('json')
  if (status === 200 && isJson) {
    return res.json()
  }

  // Not JSON: probably a challenge page. Give the user time to solve it in the
  // browser window; once solved, the site redirects to the JSON, rendered in a <pre>.
  console.log(`HTTP ${status}, waiting up to ${CHALLENGE_TIMEOUT / 60000} min for the challenge to be solved in the browser...`)
  try {
    await page.waitForSelector('pre', { timeout: CHALLENGE_TIMEOUT })
  } catch {
    const err = new Error(`HTTP ${status} (challenge not solved)`)
    err.status = status
    err.retryAfter = Number(res?.headers()['retry-after']) || null
    throw err
  }
  return JSON.parse(await page.$eval('pre', el => el.textContent))
}

// Returns false if the run should stop (too many consecutive failures)
async function runner(page, type, market) {
  const folder = '../input/raw_' + type
  const baseurl = 'https://www.sappmarket.com/Home/' // ?deliveryDate=2023/05/01&periodId=13&categoryId=5&marketId=1'
  // const baseurl = 'http://localhost:3000/GetFlow' //?deliveryDate=2023/05/01&periodId=13&categoryId=5&marketId=1'

  const startDate = DateTime.fromISO('2023-05-01')
  const endDate = DateTime.fromISO('2024-01-01').minus({day: 1})//now().minus({day: 1})

  console.log('Type: ', type)
  console.log('Market: ', market)
  console.log('Start date: ', startDate.toISODate())
  console.log('End date: ', endDate.toISODate())

  let requests = []
  const days = Interval.fromDateTimes(startDate, endDate.plus({day: 1})).splitBy({ days: 1 }).map((d) => d.start)
  days.forEach(day => {
    const dir = folder + '/' + market + '/' + day.toFormat('yyyy_LL') + '/' + day.toISODate()
    fs.mkdirSync(dir, { recursive: true })

    for (let hour = 0; hour < 24; hour++) {
      const fil = dir + '/' + hour + '.json'
      if (!fs.existsSync(fil)) {
        requests.push({ sortKey: Math.random(), day, hour, fil })
      }
    }
  })

  requests.sort((a,b) => a.sortKey - b.sortKey)
  console.log('Requests: ' + requests.length)

  let no = 0
  let fails = 0
  for (const { day, hour, fil } of requests) {
    no += 1
    console.log('No: ', no, ' of: ' , requests.length)

    const deliveryDate = day.toFormat('yyyy/LL/dd')
    const periodId = hour + PERIOD_OFFSET
    let url
    if (type=='flow') {
      url = baseurl + `GetFlow?deliveryDate=${deliveryDate}&periodId=${periodId}&categoryId=${cats[market-1]}&marketId=${market}`
    } else {
      url = baseurl + `GetAreaPrice?deliveryDate=${deliveryDate}&periodId=${periodId}&currencyId=1&marketId=${market}`
    }

    console.log(url)

    try {
      const data = await fetchJson(page, url)
      if (data === null || typeof data !== 'object') {
        throw new Error('Unexpected response payload')
      }
      console.log(fil)
      fs.writeFileSync(fil, JSON.stringify(data))
      fails = 0
    } catch (e) {
      fails += 1
      console.error(`${url} -> ${e.message}`)
      if (fails >= MAX_CONSECUTIVE_FAILS) {
        console.log('Too many consecutive failures; stopping. Re-run later to resume.')
        return false
      }
      if (e.status === 403 || e.status === 429) {
        const pauseMs = (e.retryAfter ?? DEFAULT_BLOCK_PAUSE) * 1000
        console.log(`Rate limited (${e.status}); pausing ${Math.round(pauseMs / 60000)} min`)
        await sleep(pauseMs)
      }
    }

    await sleep(MIN_DELAY + Math.random() * MIN_DELAY)
  }
  return true
}

puppeteer.launch({ headless: false }).then(async browser => {
  const page = await browser.newPage()

  try {
    outer:
    for (const type of types) {
      for (const market of markets) {
        if (!await runner(page, type, market)) break outer
      }
    }
  } finally {
    await browser.close()
  }
})

const { DateTime, Interval } = require("luxon")
const puppeteer = require('puppeteer-extra')
const StealthPlugin = require('puppeteer-extra-plugin-stealth')
puppeteer.use(StealthPlugin())
const fs = require('fs');
const cats=[5,18,19,5]

// const market = 1
const types = ['flow','price']
const markets = [1]//,2,3,4]

const WORKERS = 10              // browser windows running in parallel, each with its own proxy IP
const LAUNCH_STAGGER = 1000     // ms between starting each worker (± JITTER)
const MIN_DELAY = 500           // ms between a worker's requests (± JITTER)
const JITTER = 0.5              // random variation applied to delays, as a fraction (0.5 = ±50%)
const MAX_CONSECUTIVE_FAILS = 3 // a worker stops after this many failures in a row
const MAX_ATTEMPTS = 3          // a failed request is requeued until it has been tried this many times
const REQUESTS_PER_SESSION = 5  // start a fresh session (new proxy IP) after this many requests
const PERIOD_OFFSET = 11        // periodId = hour index + 11

// Rotating residential proxy (webshare.io); override with the PROXY_URL env var.
// Chromium ignores credentials in --proxy-server, so they're supplied via page.authenticate().
process.env.PROXY_URL ??= 'http://xchovvmu-rotate:uec09iostq9i@p.webshare.io:80'
const proxy = new URL(process.env.PROXY_URL)

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))
const jitter = ms => ms * (1 + JITTER * (2 * Math.random() - 1))

async function fetchJson(page, url) {
  const res = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 })
  const status = res ? res.status() : 0
  const isJson = (res?.headers()['content-type'] || '').includes('json')
  if (status === 200 && isJson) {
    return res.json()
  }

  // Not JSON (probably a challenge page): fail so the caller starts a fresh session
  throw new Error(`HTTP ${status} (non-JSON response)`)
}

// Builds the list of missing files for one type/market
function buildRequests(type, market) {
  const folder = '../input/raw_' + type
  const baseurl = 'https://www.sappmarket.com/Home/' // ?deliveryDate=2023/05/01&periodId=13&categoryId=5&marketId=1'
  // const baseurl = 'http://localhost:3000/GetFlow' //?deliveryDate=2023/05/01&periodId=13&categoryId=5&marketId=1'

  const startDate = DateTime.fromISO('2023-05-01')
  const endDate = DateTime.fromISO('2026-10-01').minus({day: 1})//now().minus({day: 1})

  let requests = []
  const days = Interval.fromDateTimes(startDate, endDate.plus({day: 1})).splitBy({ days: 1 }).map((d) => d.start)
  days.forEach(day => {
    const dir = folder + '/' + market + '/' + day.toFormat('yyyy_LL') + '/' + day.toISODate()
    fs.mkdirSync(dir, { recursive: true })

    for (let hour = 0; hour < 24; hour++) {
      const fil = dir + '/' + hour + '.json'
      if (fs.existsSync(fil)) continue

      const deliveryDate = day.toFormat('yyyy/LL/dd')
      const periodId = hour + PERIOD_OFFSET
      let url
      if (type=='flow') {
        url = baseurl + `GetFlow?deliveryDate=${deliveryDate}&periodId=${periodId}&categoryId=${cats[market-1]}&marketId=${market}`
      } else {
        url = baseurl + `GetAreaPrice?deliveryDate=${deliveryDate}&periodId=${periodId}&currencyId=1&marketId=${market}`
      }
      requests.push({ sortKey: Math.random(), url, fil, attempts: 0 })
    }
  })

  console.log(`${type} market ${market} (${startDate.toISODate()} to ${endDate.toISODate()}): ${requests.length} requests`)
  return requests
}

// Each session is a separate browser context (its own window and connection pool),
// so a reset forces new proxy connections and therefore a new exit IP.
function makeSession(browser, id) {
  return {
    context: null,
    page: null,
    requests: 0,
    async reset() {
      this.requests = 0
      // Open the new context before closing the old one so a window always exists
      const old = this.context
      this.context = await browser.createBrowserContext()
      this.page = await this.context.newPage()
      if (old) await old.close().catch(() => {})
      await this.page.authenticate({
        username: decodeURIComponent(proxy.username),
        password: decodeURIComponent(proxy.password),
      })
      console.log(`[w${id}] New proxy session`)
    },
  }
}

puppeteer.launch({
  headless: false,
  args: [`--proxy-server=${proxy.protocol}//${proxy.host}`],
}).then(async browser => {
  const queue = []
  for (const type of types) {
    for (const market of markets) {
      queue.push(...buildRequests(type, market))
    }
  }
  queue.sort((a,b) => a.sortKey - b.sortKey)
  const total = queue.length
  console.log('Total requests: ' + total)

  let done = 0
  let gaveUp = 0
  let defaultClosed = false

  async function worker(id) {
    if (queue.length === 0) return

    const session = makeSession(browser, id)
    await session.reset()
    if (!defaultClosed) {
      // Close the unused startup window from the default context
      defaultClosed = true
      for (const p of await browser.defaultBrowserContext().pages()) await p.close()
    }

    let fails = 0
    try {
      while (queue.length > 0) {
        const req = queue.shift()
        req.attempts += 1

        if (session.requests >= REQUESTS_PER_SESSION) await session.reset()
        session.requests += 1

        try {
          const data = await fetchJson(session.page, req.url)
          if (data === null || typeof data !== 'object') {
            throw new Error('Unexpected response payload')
          }
          fs.writeFileSync(req.fil, JSON.stringify(data))
          done += 1
          fails = 0
          console.log(`[w${id}] ${done}/${total} ${req.fil}`)
        } catch (e) {
          fails += 1
          console.error(`[w${id}] ${req.url} -> ${e.message}`)
          if (req.attempts < MAX_ATTEMPTS) {
            queue.push(req)
          } else {
            gaveUp += 1
          }
          if (fails >= MAX_CONSECUTIVE_FAILS) {
            console.log(`[w${id}] Too many consecutive failures; worker stopping`)
            return
          }
          await session.reset()
        }

        await sleep(jitter(MIN_DELAY))
      }
    } finally {
      await session.context?.close().catch(() => {})
    }
  }

  try {
    const workers = []
    for (let i = 0; i < WORKERS; i++) {
      if (i > 0) await sleep(jitter(LAUNCH_STAGGER))
      workers.push(worker(i))
    }
    await Promise.all(workers)
  } finally {
    console.log(`Finished: ${done} saved, ${gaveUp} gave up, ${queue.length} left in queue. Re-run to resume.`)
    await browser.close()
  }
})

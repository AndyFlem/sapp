const fs = require('fs');
const { DateTime } = require("luxon")
const axios = require('axios').default

const market = 4
// const cats=[5,18,19,22]
const prefs=['dam','fpm','fpw','idm']

const base_url=`http://www.sappmarket.com/Home/GetPriceAndTurnOverData`

if (market===4) {
    from=DateTime.fromISO(`2020-01-01`)
} else {
    from=DateTime.fromISO(`2016-01-01`)
}

to=from.plus({month: 1}).minus({day: 1})

getData().then(() => {
    console.log('OK')
})

async function getData() {

    while (to <  DateTime.local().endOf('month')) {
    
        const path = '../input/monthly/' + prefs[market-1] + '_' + from.toFormat('yyyy_LL') + '.json'

        if (!fs.existsSync(path) || (to >  DateTime.local().startOf('month'))) {
            const url=base_url + `?dateFrom=${from.toFormat('dd/LL/yyyy')}&dateTo=${to.toFormat('dd/LL/yyyy')}&aggPeriodId=1&areaId=0&currencyId=1&marketId=` + market
            console.log(url)
            try {
                let response = await axios.get(url)
                const jsd = JSON.parse(response.data.data)
                fs.writeFileSync(path, JSON.stringify(jsd))
            } catch(e) {
                console.error(e)
            }

        }
        from=from.plus({month: 1})
        to=from.plus({month: 1}).minus({day: 1})
    }
    return Promise.resolve()
}


const fs = require('fs');
const { DateTime } = require("luxon")
const axios = require('axios').default

const market = 3
const cats=[5,18,19,22]
const prefs=['dam','fpm','fpw']

const base_url=`http://www.sappmarket.com/Home/GetPriceAndTurnOverData`

from=DateTime.fromISO(`2016-01-01`)
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
            let response = await axios.get(url)
            const jsd = JSON.parse(response.data.data)

            fs.writeFileSync(path, JSON.stringify(jsd))
        }
        from=from.plus({month: 1})
        to=from.plus({month: 1}).minus({day: 1})
    }
    return Promise.resolve()
}


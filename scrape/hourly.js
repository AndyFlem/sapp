const fs = require('fs');
const { DateTime } = require("luxon")

var pg = require('pg')
pg.types.setTypeParser(1082, (value) => DateTime.fromISO(value))

const knex = require('knex')({
  client: 'pg',
  version: '10',
  debug:false,
  connection: {
    host: '127.0.0.1',
    user: 'postgres',
    password: 'extramild20',
    database: 'sapp'
  }
})


let rawdata = fs.readFileSync('../raw/DAM-Hourly.json');
let data = JSON.parse(JSON.parse(rawdata).data)
console.log(data[0])
Promise.all(data.map((d,indx) => {
  if (indx>0){
    if (d[0].length==18) {
      const date=DateTime.fromFormat(d[0].split(' ')[0].slice(1,11),'yyyy/LL/dd')
      const hour=parseInt(d[0].split(' ')[1].slice(0,2))
      const price = d[1]
      const turnover = d[2]
      console.log(d,date.toISODate(),hour, price, turnover)
      oIns={market: 1, tradedate: date.toISODate(), hour: hour, price: price, volume: turnover}
      return knex('hourly')
        .insert(oIns)      
    }
  }

})).then(() => {console.log('OKO')})

